// ═══════════════════════════════════════════════════════════════════════════
// Create Razorpay Payment Link — Supabase Edge Function
//
// Generates a Razorpay payment link for AI credit top-ups.
// Records the intent in `pending_credit_purchases` for webhook reconciliation.
//
// Deploy:
//   npx supabase functions deploy create-razorpay-link --no-verify-jwt
//
// Secrets (Supabase Dashboard → Edge Functions → Secrets):
//   RAZORPAY_KEY_ID        — from Razorpay Dashboard → API Keys
//   RAZORPAY_KEY_SECRET    — from Razorpay Dashboard → API Keys
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Credit Plans ───────────────────────────────────────────────────────────
// `credits` = actual tokens granted. Display shows ₹-equivalent (1 credit ≈ ₹1).
const CREDIT_PLANS: Record<string, { credits: number; amount: number; name: string }> = {
  pack_299:  { credits: 150000,   amount: 29900,  name: "Starter Pack — 299 Credits" },
  pack_999:  { credits: 600000,   amount: 99900,  name: "Pro Pack — 1,099 Credits (+10%)" },
  pack_4999: { credits: 3750000,  amount: 499900, name: "Whale Pack — 6,249 Credits (+25%)" },
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Auth Header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "").trim();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error("[create-razorpay-link] Auth error:", authError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Validate plan ────────────────────────────────────────────────────
    const { plan_id, redirect_url } = await req.json();
    const plan = CREDIT_PLANS[plan_id];
    if (!plan) {
      return new Response(JSON.stringify({ error: "Invalid plan ID" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Razorpay credentials ─────────────────────────────────────────────
    const rzpKeyId = Deno.env.get("RAZORPAY_KEY_ID");
    const rzpKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!rzpKeyId || !rzpKeySecret) {
      console.error("[create-razorpay-link] Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET");
      return new Response(JSON.stringify({ error: "Payment gateway not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Service-role client for DB writes ─────────────────────────────────
    const serviceClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ── Create pending purchase record ───────────────────────────────────
    // Razorpay requires reference_id to be < 40 characters.
    const referenceId = `cr_${Date.now()}_${user.id.substring(0, 8)}`;

    const { data: pendingRow, error: pendingErr } = await serviceClient
      .from("pending_credit_purchases")
      .insert({
        user_id: user.id,
        plan_id: plan_id,
        credits: plan.credits,
        amount_paise: plan.amount,
        status: "pending",
      })
      .select("id")
      .single();

    if (pendingErr) {
      console.error("[create-razorpay-link] DB insert error:", pendingErr.message);
      return new Response(JSON.stringify({ error: "Could not record purchase intent" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Create Razorpay Payment Link ─────────────────────────────────────
    const authString = btoa(`${rzpKeyId}:${rzpKeySecret}`);

    const rzpResponse = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${authString}`,
      },
      body: JSON.stringify({
        amount: plan.amount,
        currency: "INR",
        accept_partial: false,
        reference_id: referenceId,
        description: plan.name,
        customer: {
          email: user.email || undefined,
        },
        notify: { email: true, sms: false },
        reminder_enable: false,
        notes: {
          user_id: user.id,
          plan_id: plan_id,
          type: "ai_credits",
          purchase_id: pendingRow.id,          // links back to our DB row
        },
        callback_url: redirect_url || "tikonamobile://payment-success",
        callback_method: "get",
        expire_by: Math.floor(Date.now() / 1000) + 30 * 60, // 30 min expiry
      }),
    });

    if (!rzpResponse.ok) {
      const errorText = await rzpResponse.text();
      console.error("[create-razorpay-link] Razorpay API error:", errorText);
      return new Response(JSON.stringify({ error: "Failed to create payment link" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rzpData = await rzpResponse.json();

    // ── Update pending record with Razorpay link ID ──────────────────────
    await serviceClient
      .from("pending_credit_purchases")
      .update({ razorpay_link_id: rzpData.id })
      .eq("id", pendingRow.id);

    console.log(`[create-razorpay-link] ✅ Payment link created for user=${user.id} plan=${plan_id} link=${rzpData.id}`);

    return new Response(
      JSON.stringify({
        payment_link: rzpData.short_url,
        purchase_id: pendingRow.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[create-razorpay-link] Unhandled error:", error);
    return new Response(JSON.stringify({ error: error.message ?? "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
