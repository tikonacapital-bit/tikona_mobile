// ═══════════════════════════════════════════════════════════════════════════
// Razorpay Payment Webhook (via Tradebox) — Supabase Edge Function
// ═══════════════════════════════════════════════════════════════════════════
//
// Tradebox uses YOUR Razorpay account to process payments.
// So Razorpay fires a webhook directly to this function whenever
// a payment is captured (user paid successfully on Tradebox).
//
// Deploy:
//   npx supabase functions deploy tradebox-webhook --no-verify-jwt
//
// Environment variables — set in Supabase Dashboard → Edge Functions → Secrets:
//   RAZORPAY_WEBHOOK_SECRET   — from Razorpay Dashboard → Webhooks → Secret
//   SUPABASE_URL              — auto-injected
//   SUPABASE_SERVICE_ROLE_KEY — auto-injected
//
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

// ─── Plan mapping by amount (in paise) ───────────────────────────────────────
// Razorpay amounts are in paise (1 INR = 100 paise)
// ₹24,999 → midcap_wealth | ₹29,999 → smallcap_alpha | ₹35,999 → sme_emerging | ₹74,999 → all_in_growth
const AMOUNT_TO_PLAN: Record<number, string> = {
  100: "sme_emerging",           // ₹1.00 (Testing Amount)
  101: "smallcap_alpha",       // ₹1.01 (Testing Amount)
  102: "sme_emerging",         // ₹1.02 (Testing Amount)
  103: "all_in_growth",        // ₹1.03 (Testing Amount)
  2499900: "midcap_wealth",    // ₹24,999
  2999900: "smallcap_alpha",   // ₹29,999
  3599900: "sme_emerging",     // ₹35,999
  7499900: "all_in_growth",    // ₹74,999
};

// ─── CORS headers ─────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-razorpay-signature, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Verify Razorpay webhook signature ────────────────────────────────────────
// Razorpay signs every webhook body with HMAC-SHA256 using your webhook secret.
// The signature is sent in the `x-razorpay-signature` header.
async function verifyRazorpaySignature(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison to prevent timing attacks
  if (computed.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < computed.length; i++) {
    mismatch |= computed.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

// ─── Razorpay webhook payload shape ───────────────────────────────────────────
interface RazorpayWebhookPayload {
  entity: string;
  account_id: string;
  event: string;           // e.g. "payment.captured"
  contains: string[];      // e.g. ["payment"]
  payload: {
    payment?: {
      entity: {
        id: string;              // payment_id e.g. "pay_abc123"
        amount: number;          // in paise e.g. 2499900
        currency: string;        // "INR"
        status: string;          // "captured"
        description?: string;    // order description (may contain plan info)
        email: string;           // payer's email
        contact: string;         // payer's phone
        notes?: {
          // Tradebox may pass custom metadata here
          user_id?: string;      // if we embed user_id in Razorpay notes
          plan?: string;         // if we embed plan in Razorpay notes
          [key: string]: string | undefined;
        };
        order_id?: string;
        created_at: number;      // unix timestamp
      };
    };
  };
}

serve(async (req: Request) => {
  // ── CORS preflight ─────────────────────────────────────────────────────
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
    const rawBody = await req.text();

    // ── Verify Razorpay signature ───────────────────────────────────────
    const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET") || "";
    const signature = req.headers.get("x-razorpay-signature") || "";

    if (webhookSecret) {
      if (!signature) {
        console.error("[Webhook] Missing x-razorpay-signature header");
        return new Response(
          JSON.stringify({ error: "Missing signature" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const valid = await verifyRazorpaySignature(rawBody, signature, webhookSecret);
      if (!valid) {
        console.error("[Webhook] Invalid Razorpay signature");
        return new Response(
          JSON.stringify({ error: "Invalid signature" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      console.warn("[Webhook] RAZORPAY_WEBHOOK_SECRET not set — skipping verification (dev mode)");
    }

    // ── Parse payload ───────────────────────────────────────────────────
    let webhookData: RazorpayWebhookPayload;
    try {
      webhookData = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[Webhook] Received event:", webhookData.event);

    // ── Only handle payment.captured ────────────────────────────────────
    // "payment.captured" = money is successfully received in your account
    if (webhookData.event !== "payment.captured") {
      return new Response(
        JSON.stringify({ received: true, action: "ignored", event: webhookData.event }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Extract payment details ─────────────────────────────────────────
    const payment = webhookData.payload?.payment?.entity;
    if (!payment) {
      return new Response(
        JSON.stringify({ error: "Missing payment entity in payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { amount, email, id: paymentId, notes } = payment;
    console.log("[Webhook] Payment:", { paymentId, amount, email, notes });

    // ── Resolve plan from amount ────────────────────────────────────────
    // Each plan has a unique price, so amount is a reliable plan identifier.
    let plan = notes?.plan || AMOUNT_TO_PLAN[amount] || "";

    if (!plan) {
      console.error("[Webhook] Cannot resolve plan from amount:", amount);
      // Log it and return 200 so Razorpay doesn't keep retrying
      plan = "midcap_wealth"; // fallback — remove this if you want strict mode
      // OR: return 400 for strict mode
    }

    // ── Set up Supabase client ──────────────────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── Resolve user_id ─────────────────────────────────────────────────
    // Priority order:
    //   1. notes.user_id  (if Razorpay notes carry the Clerk user_id)
    //   2. Look up by email in the 'profiles' table (fallback)
    let userId = notes?.user_id || "";

    if (!userId && email) {
      // Try to find user by email in Clerk via profiles table
      // (the profiles table stores user_id + email via Clerk webhooks)
      const { data: profileData } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", email)
        .maybeSingle();

      if (profileData?.user_id) {
        userId = profileData.user_id;
        console.log("[Webhook] Resolved user_id from email:", email, "→", userId);
      }
    }

    if (!userId) {
      // Can't find the user. Log it, return 200 so Razorpay doesn't retry.
      console.error("[Webhook] Could not resolve user_id for email:", email);
      await supabase.from("webhook_logs").insert({
        source: "razorpay",
        event: webhookData.event,
        payload: webhookData,
        user_id: null,
        processed: false,
        error_message: `Could not resolve user_id for email: ${email}`,
      });
      return new Response(
        JSON.stringify({ received: true, action: "pending", reason: "user not found — logged for manual review" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Calculate subscription period (1 year) ─────────────────────────
    const startsAt = new Date();
    const expiresAt = new Date(startsAt);
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    // ── Upsert subscription ─────────────────────────────────────────────
    const { data, error } = await supabase
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          plan: plan,
          is_active: true,
          started_at: startsAt.toISOString(),
          expires_at: expiresAt.toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (error) {
      console.error("[Webhook] Supabase upsert error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to save subscription", detail: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[Webhook] ✅ Subscription saved:", data);

    // ── Audit log ───────────────────────────────────────────────────────
    await supabase.from("webhook_logs").insert({
      source: "razorpay",
      event: webhookData.event,
      payload: webhookData,
      user_id: userId,
      processed: true,
    });

    return new Response(
      JSON.stringify({
        received: true,
        action: "subscription_created",
        subscription: {
          user_id: userId,
          plan: plan,
          expires_at: expiresAt.toISOString(),
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[Webhook] Unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
