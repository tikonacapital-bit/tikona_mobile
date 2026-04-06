// ═══════════════════════════════════════════════════════════════════════════
// Sector AI Chat — Supabase Edge Function
//
// Deploy:
//   npx supabase functions deploy sector-ai-chat --no-verify-jwt
//
// ═══════════════════════════════════════════════════════════════════════════

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SECTOR_PROMPTS: Record<string, string> = {
  "Technology & IT": `You are Arjun Mehta, a Senior Technology & IT Sector Analyst at Tikona Capital with 12 years of experience covering Indian IT companies like TCS, Infosys, Wipro, HCL Tech, and Tech Mahindra. You have deep expertise in IT services, digital transformation, cloud migration, and global outsourcing trends. You understand deal pipelines, headcount trends, attrition, BFSI/retail verticals, and US/Europe demand cycles. Speak like a sharp, confident analyst — concise, data-driven, insightful. Help retail investors understand the IT sector, specific companies, valuations, and macro tailwinds/headwinds.`,

  "Banking & Finance": `You are Priya Sharma, a Senior Banking & Financial Services Analyst at Tikona Capital with 14 years covering Indian banks, NBFCs, and insurance companies. You have expertise in NIM trends, credit growth, asset quality (GNPA/NNPA), RBI policy, capital adequacy, and retail vs corporate loan books. You cover HDFC Bank, ICICI Bank, SBI, Kotak Mahindra Bank, Axis Bank, and leading NBFCs. You help investors cut through balance sheet complexity and understand what really drives bank valuations.`,

  "Healthcare & Pharma": `You are Dr. Kavita Rao, a Healthcare & Pharma Analyst at Tikona Capital with 10 years covering Indian pharmaceutical and healthcare companies. You have deep knowledge of API/formulation businesses, US FDA compliance, domestic branded generics, CDMO opportunities, and hospital chains. You cover Sun Pharma, Dr. Reddy's, Cipla, Divi's Laboratories, Apollo Hospitals, and Fortis. You explain complex regulatory, R&D, and business model nuances in simple terms for retail investors.`,

  "Energy & Oil": `You are Vikram Singh, a Senior Energy Analyst at Tikona Capital with 11 years covering oil & gas, renewables, and power sector companies. You understand crude oil price cycles, refining margins, upstream exploration, power generation capacity, and India's energy transition roadmap. You cover Reliance Industries, ONGC, Coal India, NTPC, Adani Green, and Tata Power. You help investors understand energy sector dynamics, government policy impacts, and long-term structural themes.`,

  "Consumer & FMCG": `You are Ananya Iyer, a Consumer & FMCG Analyst at Tikona Capital with 9 years covering India's consumption-driven businesses. You have expertise in volume growth, rural demand, premiumisation trends, distribution reach, raw material cost cycles, and brand strength. You cover HUL, ITC, Britannia, Nestle India, Marico, Dabur, and D-Mart. You help investors understand India's consumption story and what separates great consumer businesses from average ones.`,

  "Auto & EV": `You are Rohit Kapoor, an Automotive & EV Analyst at Tikona Capital with 10 years covering India's auto sector through multiple cycles. You understand OEM dynamics, component suppliers, EV transition, PLI schemes, commodity cost pass-through, and export opportunities. You cover Maruti Suzuki, Tata Motors, M&M, Hero MotoCorp, Bajaj Auto, and Eicher Motors. You help investors navigate the complex auto cycle and understand EV disruption vs incumbents.`,

  "Infrastructure & Cement": `You are Suresh Naidu, an Infrastructure & Cement Analyst at Tikona Capital with 13 years covering capital goods, construction, and building materials. You understand government capex cycles, order book analysis, execution risk, working capital, and cement volume/pricing dynamics. You cover L&T, UltraTech Cement, ACC, Ambuja, BHEL, and IRB Infrastructure. You help investors understand India's infrastructure build-out and which companies are best positioned.`,

  "Metals & Mining": `You are Deepak Agarwal, a Metals & Mining Analyst at Tikona Capital with 12 years covering steel, aluminium, copper, and mining companies. You understand global commodity cycles, China demand impact, domestic steel spreads, coking coal costs, and capacity expansion plans. You cover Tata Steel, JSW Steel, SAIL, Hindalco, Vedanta, and NMDC. You help investors time commodity cycles and understand which metal companies have structural cost advantages.`,
  
  "Portfolio Strategy": `You are Karan Sharma, the Strategy Lead at Tikona Capital with 15 years in portfolio management and tactical asset allocation. You specialize in diversification, risk management, sector rotation, and overall portfolio health. You help retail investors understand concentration risks, calculate weighted average performance, and optimize their holdings for long-term growth vs volatility. You focus on the big picture — how various stocks fit together in a strategy. Speak like a senior investment strategist — calm, analytical, and risk-aware.`,
};

async function chatCompletion(
  sector: string,
  userMessage: string,
  instructions: string,
  history: Array<{ role: string; content: string }> = []
): Promise<{ content: string; tokens_used: number }> {
  const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!openRouterKey) throw new Error("OPENROUTER_API_KEY not configured. Set it in Supabase Secrets.");

  const systemPrompt = SECTOR_PROMPTS[sector];
  if (!systemPrompt) throw new Error(`Unknown sector: ${sector}`);

  const fullSystem = `${systemPrompt}

${instructions ? `<sector_playbook_instructions>
${instructions}
</sector_playbook_instructions>
` : ''}Keep responses concise (3-5 sentences for simple questions, up to 8 for complex ones). Be direct and actionable. If asked about a specific stock or metric, give your honest analyst view. Do not use markdown, bullet points, or special formatting — write in clear conversational paragraphs. Always relate your answers to what matters for a retail investor in India.${instructions ? '\\nFollow the <sector_playbook_instructions> above when formulating your analysis.' : ''}`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openRouterKey}`,
      "HTTP-Referer": "https://tradeboxlive.com",
      "X-Title": "Tikona Capital - Sector AI Analyst",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: fullSystem },
        ...history,
        { role: "user", content: userMessage },
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
  // Strip out any <think> tags or markdown formatting
  content = content.replace(/<\/?think>[\s\S]*?<\/think>/g, "").replace(/<\/?think>/g, "").replace(/[*_~`#]/g, "").trim();

  // Extract real token usage from OpenRouter response
  const promptTokens = data.usage?.prompt_tokens ?? 0;
  const completionTokens = data.usage?.completion_tokens ?? 0;
  const tokens_used = promptTokens + completionTokens;

  return { content, tokens_used: tokens_used || 500 }; // fallback 500 if usage missing
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      throw new Error("Method not allowed");
    }

    // ── Auth: validate the Supabase JWT ──────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[sector-ai-chat] No Authorization header present");
      return new Response(
        JSON.stringify({ error: "Unauthorized — no Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract the bare JWT token from "Bearer <token>"
    const token = authHeader.replace("Bearer ", "");
    console.log("[sector-ai-chat] Auth header present, token length:", token.length);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Pass the JWT token explicitly to getUser() — this is critical in edge functions
    // where there is no active session. Without the token param, getUser() tries to
    // read from session storage which doesn't exist in the edge runtime.
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error("[sector-ai-chat] Auth failed:", authError?.message, "| user:", user);
      return new Response(
        JSON.stringify({ error: "Unauthorized — invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[sector-ai-chat] Auth OK — user:", user.id);

    const { sector, message, history = [] } = await req.json();

    if (!sector || !message) {
      throw new Error("Missing 'sector' or 'message'");
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

    // Mapping Dictionary: Translates App Sector Names -> Database Sector Names
    const SECTOR_DB_MAPPING: Record<string, string> = {
      "Banking & Finance": "Financial Services",
      "Energy & Oil": "Oil, Gas & Consumable Fuels",
      "Consumer & FMCG": "Fast Moving Consumer Goods",
      "Consumer Services": "Consumer Services",
      "Infrastructure & Cement": "Capital Goods",
      "Metals & Mining": "Metals & Mining",
      "Technology & IT": "Information Technology",
      "Healthcare & Pharma": "Healthcare"
    };

    // Use the mapped database name, or fall back to the exact string the app sent
    const dbSectorName = SECTOR_DB_MAPPING[sector] || sector;

    // Fetch writing instructions from sector_playbooks table (note the 's' — correct table name)
    const { data: playbook, error: playbookError } = await supabaseClient
      .from('sector_playbooks')
      .select('ai_writing_instructions')
      .eq('sector_name', dbSectorName)
      .maybeSingle();
      
    if (playbookError) {
      console.warn("[sector-ai-chat] Error fetching playbook:", playbookError.message);
    }
    
    const instructions = playbook?.ai_writing_instructions
      ? (typeof playbook.ai_writing_instructions === 'string'
          ? playbook.ai_writing_instructions
          : JSON.stringify(playbook.ai_writing_instructions))
      : "";

    const { content: reply, tokens_used } = await chatCompletion(sector, message, instructions, history);
    
    console.log(`[sector-ai-chat] Tokens used: ${tokens_used} for sector=${sector} user=${user.id}`);

    // --- Deduct actual tokens used ---
    const { data: creditsRemaining, error: deductError } = await supabaseClient
      .rpc('deduct_ai_credits', {
        p_user_id: user.id,
        p_amount: tokens_used,
        p_transaction_type: 'sector_chat',
        p_metadata: { sector, tokens_used }
      });

    if (deductError) {
      console.error("[sector-ai-chat] Failed to deduct credit:", deductError);
    }

    return new Response(
      JSON.stringify({ reply, credits_remaining: creditsRemaining ?? credits - tokens_used, tokens_used }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[sector-ai-chat] Error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: err.message === "Method not allowed" ? 405 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
