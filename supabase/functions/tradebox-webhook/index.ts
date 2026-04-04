// ═══════════════════════════════════════════════════════════════════════════
// Tradebox / Razorpay Payment Webhook — Supabase Edge Function
//
// Job: when a payment is captured, activate the user's subscription.
// Everything else (plan, discounts, KYC) is handled by Tradebox/Razorpay.
//
// Deploy:
//   npx supabase functions deploy tradebox-webhook --no-verify-jwt
//
// Secrets (Supabase Dashboard → Edge Functions → Secrets):
//   RAZORPAY_WEBHOOK_SECRET   — from Razorpay Dashboard → Webhooks
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

// ─── Fallback: known exact prices (paise) → plan ──────────────────────────
// Only used if pending_payments lookup fails (e.g. user cleared app before paying)
const AMOUNT_TO_PLAN: Record<number, string> = {
  100: "midcap_wealth",      // ₹1.00 test
  101: "smallcap_alpha",     // ₹1.01 test
  102: "sme_emerging",       // ₹1.02 test
  103: "all_in_growth",      // ₹1.03 test
  2499900: "midcap_wealth",  // ₹24,999
  2999900: "smallcap_alpha", // ₹29,999
  3599900: "sme_emerging",   // ₹35,999
  7499900: "all_in_growth",  // ₹74,999
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-razorpay-signature, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const computed = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (computed.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < computed.length; i++) mismatch |= computed.charCodeAt(i) ^ signature.charCodeAt(i);
  return mismatch === 0;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });

  try {
    const rawBody = await req.text();

    // ── Verify Razorpay signature ───────────────────────────────────────
    const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
    if (!secret) {
      console.error("[Webhook] RAZORPAY_WEBHOOK_SECRET is not configured — rejecting request.");
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), { status: 500, headers: corsHeaders });
    }
    const signature = req.headers.get("x-razorpay-signature") || "";
    if (!signature || !(await verifySignature(rawBody, signature, secret))) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401, headers: corsHeaders });
    }

    const webhookData = JSON.parse(rawBody);

    // ── Only care about successful payments ─────────────────────────────
    if (webhookData.event !== "payment.captured") {
      return new Response(JSON.stringify({ received: true, action: "ignored" }), { status: 200, headers: corsHeaders });
    }

    const payment = webhookData.payload?.payment?.entity;
    if (!payment) return new Response(JSON.stringify({ error: "Missing payment entity" }), { status: 400, headers: corsHeaders });

    const { amount, email, notes } = payment;

    // ── Supabase client ─────────────────────────────────────────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ── Resolve user by email ────────────────────────────────────────────
    let userId = notes?.user_id || "";
    if (!userId && email) {
      const { data } = await supabase.from("profiles").select("user_id").eq("email", email).maybeSingle();
      userId = data?.user_id || "";
    }
    if (!userId) {
      console.error("[Webhook] User not found for payment — manual review needed");
      return new Response(
        JSON.stringify({ received: true, action: "pending", reason: "user not found — manual review needed" }),
        { status: 200, headers: corsHeaders }
      );
    }

    // ── Resolve plan ────────────────────────────────────────────────────
    // 1. pending_payments table (set by app when user tapped Subscribe Now)
    // 2. Fallback to exact amount map (full-price payments, no discount)
    let plan = "";

    const { data: pending } = await supabase
      .from("pending_payments")
      .select("plan")
      .eq("user_id", userId)
      .maybeSingle();
    if (pending?.plan) plan = pending.plan;

    if (!plan) plan = AMOUNT_TO_PLAN[amount] || "";

    if (!plan) {
      console.error("[Webhook] Cannot resolve plan — manual review needed");
      return new Response(
        JSON.stringify({ received: true, action: "pending", reason: "plan unknown — manual review needed" }),
        { status: 200, headers: corsHeaders }
      );
    }

    // ── Activate subscription ────────────────────────────────────────────
    const startsAt = new Date();
    const expiresAt = new Date(startsAt);
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    const { error } = await supabase.from("subscriptions").upsert(
      {
        user_id: userId,
        plan,
        is_active: true,
        started_at: startsAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        amount_paid: amount / 100,
      },
      { onConflict: "user_id" }
    );

    if (error) {
      console.error("[Webhook] DB error:", error.message);
      return new Response(JSON.stringify({ error: "DB error" }), { status: 500, headers: corsHeaders });
    }

    // ── Clean up pending payment record ─────────────────────────────────
    await supabase.from("pending_payments").delete().eq("user_id", userId);

    console.log("[Webhook] ✅ Subscription activated for userId:", userId, "plan:", plan);
    return new Response(JSON.stringify({ received: true, action: "subscription_activated", plan }), { status: 200, headers: corsHeaders });

  } catch (err) {
    console.error("[Webhook] Unhandled error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: corsHeaders });
  }
});
