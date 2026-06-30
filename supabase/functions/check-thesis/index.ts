// ═══════════════════════════════════════════════════════════════════════════
// Check Thesis — Supabase Edge Function
//
// Deploy:
//   npx supabase functions deploy check-thesis --no-verify-jwt
//
// ═══════════════════════════════════════════════════════════════════════════

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

async function chatCompletion(
  symbol: string,
  userThesis: string
): Promise<{ content: string; tokens_used: number }> {
  const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!openRouterKey) throw new Error("OPENROUTER_API_KEY not configured. Set it in Supabase Secrets.");

  const systemPrompt = `You are a Senior Equity Research Analyst at Tikona Capital. A retail investor is sharing their investment thesis for buying or selling a specific Indian stock (${symbol}). Your job is to objectively review their thesis against current market conditions, real-world thesis for that company, macro trends, and recent events. Tell them if their thesis is still valid, if anything new has happened that they should consider, or if there are structural changes that affect their rationale. Be concise, direct, and data-driven avoiding financial jargon.`;

  const fullSystem = `${systemPrompt}\n\nDo not use markdown, bullet points, or special formatting — write in clear conversational paragraphs. Always relate your answers to what matters for a retail investor.`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openRouterKey}`,
      "HTTP-Referer": "https://tradeboxlive.com",
      "X-Title": "Tikona Capital - Thesis Checker",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: fullSystem },
        { role: "user", content: `Stock: ${symbol}\nMy Thesis: ${userThesis}` },
      ],
      temperature: 0.3,
      max_tokens: 512,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter chat failed: ${res.status} ${errText}`);
  }

  const data = await res.json();
  let content = data.choices?.[0]?.message?.content || "I couldn't generate a response right now.";
  content = content.replace(/<\/?think>[\s\S]*?<\/think>/g, "").replace(/<\/?think>/g, "").replace(/[*_~`#]/g, "").trim();

  const promptTokens = data.usage?.prompt_tokens ?? 0;
  const completionTokens = data.usage?.completion_tokens ?? 0;
  const tokens_used = promptTokens + completionTokens;

  return { content, tokens_used: tokens_used || 500 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      throw new Error("Method not allowed");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized — no Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized — invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { symbol, thesis } = await req.json();

    if (!symbol || !thesis) {
      throw new Error("Missing 'symbol' or 'thesis'");
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
        .insert({ user_id: user.id, credits_balance: 25100 })
        .select('credits_balance')
        .single();
      credits = newWallet?.credits_balance ?? 25100;
    } else {
      credits = walletData.credits_balance;
    }

    if (credits < 100) {
      return new Response(
        JSON.stringify({ error: "Insufficient AI credits. Please top up to continue." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { content: reply, tokens_used } = await chatCompletion(symbol, thesis);

    // --- Deduct actual tokens used ---
    const { data: creditsRemaining, error: deductError } = await supabaseClient
      .rpc('deduct_ai_credits', {
        p_user_id: user.id,
        p_amount: tokens_used,
        p_transaction_type: 'check_thesis',
        p_metadata: { symbol, tokens_used }
      });

    if (deductError) {
      console.error("[check-thesis] Failed to deduct credit:", deductError);
    }

    return new Response(
      JSON.stringify({ reply, credits_remaining: creditsRemaining ?? credits - tokens_used, tokens_used }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[check-thesis] Error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: err.message === "Method not allowed" ? 405 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
