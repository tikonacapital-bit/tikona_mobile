// ═══════════════════════════════════════════════════════════════════════════
// Report AI Chat — Supabase Edge Function
// ═══════════════════════════════════════════════════════════════════════════
//
// Provides speech-to-speech AI assistant for research reports using Sarvam AI.
//
// Endpoints:
//   POST /report-ai-chat   { action: "stt", audio: base64, language_code? }
//   POST /report-ai-chat   { action: "chat", message, report_context }
//   POST /report-ai-chat   { action: "tts", text, language_code? }
//   POST /report-ai-chat   { action: "speech_to_speech", audio: base64, report_context, language_code? }
//
// Environment variables (set in Supabase Dashboard → Edge Functions → Secrets):
//   SARVAM_API_KEY — from Sarvam AI Dashboard → API Keys
//   OPENROUTER_API_KEY — from openrouter.ai
//
// Deploy:
//   npx supabase functions deploy report-ai-chat --no-verify-jwt
//
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SARVAM_BASE = "https://api.sarvam.ai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getApiKey(): string {
  const key = Deno.env.get("SARVAM_API_KEY");
  if (!key) throw new Error("SARVAM_API_KEY not configured");
  return key;
}

function getOpenRouterApiKey(): string {
  const key = Deno.env.get("OPENROUTER_API_KEY");
  if (!key) throw new Error("OPENROUTER_API_KEY not configured");
  return key;
}

// ─── Speech-to-Text ──────────────────────────────────────────────────────────
async function speechToText(
  audioBase64: string,
  languageCode: string = "en-IN"
): Promise<{ transcript: string; language_code: string }> {
  const apiKey = getApiKey();

  // Convert base64 to blob for multipart form
  const audioBytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
  const audioBlob = new Blob([audioBytes], { type: "audio/wav" });

  const formData = new FormData();
  formData.append("file", audioBlob, "audio.wav");
  formData.append("model", "saaras:v3");
  formData.append("language_code", languageCode);
  formData.append("mode", "transcribe");

  const res = await fetch(`${SARVAM_BASE}/speech-to-text`, {
    method: "POST",
    headers: {
      "api-subscription-key": apiKey,
    },
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[STT] Error:", res.status);
    throw new Error(`STT failed: ${res.status} ${errText}`);
  }

  const data = await res.json();
  return {
    transcript: data.transcript || "",
    language_code: data.language_code || languageCode,
  };
}

// ─── Chat Completion (LLM via OpenRouter) ───────────────────────────────────
async function chatCompletion(
  userMessage: string,
  reportContext: string,
  history: Array<{ role: string; content: string }> = []
): Promise<{ content: string; tokens_used: number }> {
  const openRouterKey = getOpenRouterApiKey();

  const systemPrompt = `You are an intelligent financial research assistant for Tikona Capital. You help users understand equity research reports by answering their questions clearly, accurately, and with deep analytical insight.

You are given the context of a specific research report below. Answer the user's question ONLY based on the report context provided. If the answer is not in the report context, politely say you don't have that information in this report.

Be concise, professional, and highly intelligent. Use simple language that retail investors can understand, but don't shy away from explaining complex financial metrics clearly if asked. DO NOT use markdown, asterisks, bolding, special symbols, or lists. Your output will be spoken aloud by a text-to-speech engine, so write EXACTLY how it should be read as a conversational paragraph.

--- REPORT CONTEXT ---
${reportContext}
--- END REPORT CONTEXT ---`;

  const res = await fetch(`https://openrouter.ai/api/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openRouterKey}`,
      "HTTP-Referer": "https://tradeboxlive.com",
      "X-Title": "Tikona Capital App",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: userMessage },
      ],
      temperature: 0.2,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[OpenRouter LLM] Error:", res.status);
    throw new Error(`OpenRouter Chat failed: ${res.status} ${errText}`);
  }

  const data = await res.json();
  let content = data.choices?.[0]?.message?.content || "I couldn't generate a response.";

  // Remove literal <think> and </think> tags
  content = content.replace(/<\/?think>/g, "").trim();

  // Strip out markdown formatting that might cause TTS bugs
  content = content.replace(/[*_~`#]/g, "");

  // Extract real token usage from OpenRouter response
  const promptTokens = data.usage?.prompt_tokens ?? 0;
  const completionTokens = data.usage?.completion_tokens ?? 0;
  const tokens_used = promptTokens + completionTokens;

  return { content, tokens_used: tokens_used || 500 }; // fallback 500 if usage missing
}

// ─── WAV Concatenation ───────────────────────────────────────────────────────
function concatenateWAVBuffers(wavBase64Array: string[]): string {
  if (wavBase64Array.length === 0) return "";
  if (wavBase64Array.length === 1) return wavBase64Array[0];

  const buffers = wavBase64Array.map((b64) =>
    Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  );

  // WAV header is 44 bytes; copy header from first buffer
  const header = buffers[0].slice(0, 44);
  const pcmChunks = buffers.map((buf) => buf.slice(44));
  const totalPCMSize = pcmChunks.reduce((sum, chunk) => sum + chunk.length, 0);

  const wavBuffer = new Uint8Array(44 + totalPCMSize);
  wavBuffer.set(header, 0);

  // Patch RIFF chunk size (bytes 4–7)
  const riffSize = 36 + totalPCMSize;
  wavBuffer[4] = riffSize & 0xff;
  wavBuffer[5] = (riffSize >> 8) & 0xff;
  wavBuffer[6] = (riffSize >> 16) & 0xff;
  wavBuffer[7] = (riffSize >> 24) & 0xff;

  // Patch data chunk size (bytes 40–43)
  wavBuffer[40] = totalPCMSize & 0xff;
  wavBuffer[41] = (totalPCMSize >> 8) & 0xff;
  wavBuffer[42] = (totalPCMSize >> 16) & 0xff;
  wavBuffer[43] = (totalPCMSize >> 24) & 0xff;

  // Copy all PCM data
  let offset = 44;
  for (const chunk of pcmChunks) {
    wavBuffer.set(chunk, offset);
    offset += chunk.length;
  }

  let binary = "";
  for (let i = 0; i < wavBuffer.length; i++) {
    binary += String.fromCharCode(wavBuffer[i]);
  }
  return btoa(binary);
}

// ─── Text-to-Speech ─────────────────────────────────────────────────────────
async function textToSpeech(
  text: string,
  languageCode: string = "en-IN"
): Promise<string> {
  const apiKey = getApiKey();

  // Sarvam TTS has a 500 char limit for REST — chunk if needed
  const chunks: string[] = [];
  const MAX_CHARS = 490;
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= MAX_CHARS) {
      chunks.push(remaining);
      break;
    }
    // Find a good break point (sentence end or space)
    let breakIdx = remaining.lastIndexOf(". ", MAX_CHARS);
    if (breakIdx === -1 || breakIdx < MAX_CHARS / 2) {
      breakIdx = remaining.lastIndexOf(" ", MAX_CHARS);
    }
    if (breakIdx === -1) breakIdx = MAX_CHARS;
    chunks.push(remaining.slice(0, breakIdx + 1));
    remaining = remaining.slice(breakIdx + 1);
  }

  const allAudioChunks: string[] = [];

  for (const chunk of chunks) {
    const res = await fetch(`${SARVAM_BASE}/text-to-speech`, {
      method: "POST",
      headers: {
        "api-subscription-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: [chunk],
        target_language_code: languageCode,
        model: "bulbul:v3",
        speaker: "priya",
        sample_rate: 24000,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[TTS] Error:", res.status);
      throw new Error(`TTS failed: ${res.status} ${errText}`);
    }

    const data = await res.json();
    if (data.audios?.[0]) {
      allAudioChunks.push(data.audios[0]);
    }
  }

  return allAudioChunks.length === 1
    ? allAudioChunks[0]
    : concatenateWAVBuffers(allAudioChunks);
}

// ─── Main Handler ───────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const token = authHeader.replace("Bearer ", "");

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Pass token explicitly — edge functions have no session storage
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error("[report-ai-chat] Auth failed:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized — invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action } = body;

    switch (action) {
      // ── Speech to Text ──────────────────────────────────────────────
      case "stt": {
        const { audio, language_code } = body;
        if (!audio) {
          return new Response(
            JSON.stringify({ error: "Missing 'audio' field (base64)" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const result = await speechToText(audio, language_code || "en-IN");
        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ── Chat Completion ─────────────────────────────────────────────
      case "chat": {
        const { message, report_context, history = [] } = body;
        if (!message || !report_context) {
          return new Response(
            JSON.stringify({ error: "Missing 'message' or 'report_context'" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // --- Check AI Credits ---
        let credits = 0;
        const { data: walletData } = await supabaseClient
          .from('ai_wallets')
          .select('credits_balance')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!walletData) {
          const { data: newWallet } = await supabaseClient
            .from('ai_wallets')
            .insert({ user_id: user.id, credits_balance: 50000 })
            .select('credits_balance')
            .single();
          credits = newWallet?.credits_balance ?? 50000;
        } else {
          credits = walletData.credits_balance;
        }

        if (credits < 100) {
          return new Response(
            JSON.stringify({ error: "Insufficient AI credits. Please top up to continue." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { content: reply, tokens_used } = await chatCompletion(message, report_context, history);

        console.log(`[report-ai-chat] Tokens used: ${tokens_used} for user=${user.id}`);

        // --- Deduct actual tokens used ---
        const { data: creditsRemaining, error: deductError } = await supabaseClient
          .rpc('deduct_ai_credits', {
            p_user_id: user.id,
            p_amount: tokens_used,
            p_transaction_type: 'report_chat',
            p_metadata: { action: 'chat', tokens_used }
          });

        if (deductError) {
          console.error("[report-ai-chat] Failed to deduct credit:", deductError);
        }

        return new Response(
          JSON.stringify({ reply, credits_remaining: creditsRemaining ?? credits - tokens_used, tokens_used }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ── Text to Speech ──────────────────────────────────────────────
      case "tts": {
        const { text, language_code } = body;
        if (!text) {
          return new Response(
            JSON.stringify({ error: "Missing 'text' field" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const audioBase64 = await textToSpeech(text, language_code || "en-IN");
        return new Response(
          JSON.stringify({ audio: audioBase64 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ── Full Speech-to-Speech pipeline ──────────────────────────────
      case "speech_to_speech": {
        const { audio, report_context, language_code, history = [] } = body;
        if (!audio || !report_context) {
          return new Response(
            JSON.stringify({ error: "Missing 'audio' or 'report_context'" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const lang = language_code || "en-IN";

        // Step 1: STT
        const sttResult = await speechToText(audio, lang);

        // Step 2: Chat (use detected language from STT, with history)
        const detectedLang = sttResult.language_code || lang;
        const { content: aiReply, tokens_used } = await chatCompletion(sttResult.transcript, report_context, history);

        // Step 3: TTS
        const responseAudio = await textToSpeech(aiReply, detectedLang);

        return new Response(
          JSON.stringify({
            user_transcript: sttResult.transcript,
            ai_reply: aiReply,
            audio: responseAudio,
            tokens_used,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}. Use 'stt', 'chat', 'tts', or 'speech_to_speech'` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (err) {
    console.error("[report-ai-chat] Error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
