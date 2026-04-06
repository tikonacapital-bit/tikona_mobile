// ═══════════════════════════════════════════════════════════════════════════
// Razorpay Webhook — AI Credits Only
//
// Handles `payment_link.paid` events for AI credit purchases.
// Does NOT handle subscriptions (that's tradebox-webhook).
//
// Features:
//   ✅ HMAC SHA-256 signature verification
//   ✅ Idempotent — skips if webhook_logs already has this payment_id
//   ✅ Full audit trail in webhook_logs table
//   ✅ Updates pending_credit_purchases status
//   ✅ Grants credits via increment_ai_credits RPC
//
// Deploy:
//   npx supabase functions deploy razorpay-webhook --no-verify-jwt
//
// Secrets (Supabase Dashboard → Edge Functions → Secrets):
//   RAZORPAY_WEBHOOK_SECRET — from Razorpay Dashboard → Webhooks
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-razorpay-signature, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Credit Plans (1 credit = 1 token, 2x margin, must match create-razorpay-link) ──
const CREDIT_PLANS: Record<string, { credits: number }> = {
  pack_100:  { credits: 50000 },
  pack_500:  { credits: 250000 },
  pack_2000: { credits: 1000000 },
};

// ─── HMAC Signature Verification ───────────────────────────────────────────
async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison
  if (computed.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < computed.length; i++) {
    mismatch |= computed.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

// ─── Helper: log to webhook_logs ───────────────────────────────────────────
async function logWebhook(
  supabase: any,
  event: string,
  payload: any,
  userId: string | null,
  processed: boolean,
  errorMessage: string | null = null
) {
  try {
    await supabase.from("webhook_logs").insert({
      source: "razorpay_credits",
      event,
      payload,
      user_id: userId,
      processed,
      error_message: errorMessage,
    });
  } catch (e) {
    console.error("[Razorpay Webhook] Failed to write webhook_log:", e);
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: corsHeaders,
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  let rawBody = "";

  try {
    rawBody = await req.text();

    // ── 1. Verify Razorpay HMAC signature ───────────────────────────────
    const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
    if (!secret) {
      console.error("[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET not configured");
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
        status: 500, headers: corsHeaders,
      });
    }

    const signature = req.headers.get("x-razorpay-signature") || "";
    if (!signature || !(await verifySignature(rawBody, signature, secret))) {
      console.error("[Razorpay Webhook] Invalid signature — rejecting");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401, headers: corsHeaders,
      });
    }

    const webhookData = JSON.parse(rawBody);
    const event = webhookData.event;

    // ── 2. Only process payment_link.paid ─────────────────────────────
    // NOTE: Do NOT add "payment.captured" here — Razorpay sends BOTH events
    // for the same payment, which would grant credits twice.
    if (event !== "payment_link.paid") {
      console.log(`[Razorpay Webhook] Ignoring event: ${event}`);
      await logWebhook(supabase, event, webhookData, null, false, "ignored_event");
      return new Response(JSON.stringify({ received: true, action: "ignored_event" }), {
        status: 200, headers: corsHeaders,
      });
    }

    // ── 3. Extract payment + notes ──────────────────────────────────────
    const paymentLinkEntity = webhookData.payload?.payment_link?.entity;
    const paymentEntity = webhookData.payload?.payment?.entity;

    // Get notes from the payment link entity (primary source for payment_link.paid)
    const notes = paymentLinkEntity?.notes || paymentEntity?.notes || {};
    const userId = notes.user_id;
    const planId = notes.plan_id;
    const type = notes.type;
    const purchaseId = notes.purchase_id;

    // Get the payment ID for idempotency
    const paymentId = paymentEntity?.id || paymentLinkEntity?.payments?.[0]?.payment_id || `evt_${webhookData.event_id || Date.now()}`;

    // ── 4. Skip non-credit payments (let tradebox-webhook handle subscriptions)
    if (type !== "ai_credits") {
      console.log(`[Razorpay Webhook] Not an AI credits payment (type=${type}), ignoring.`);
      await logWebhook(supabase, event, { type, notes }, userId || null, false, "not_ai_credits");
      return new Response(JSON.stringify({ received: true, action: "ignored_not_ai_credits" }), {
        status: 200, headers: corsHeaders,
      });
    }

    if (!userId || !planId) {
      console.error("[Razorpay Webhook] Missing user_id or plan_id in notes");
      await logWebhook(supabase, event, webhookData, null, false, "missing_user_id_or_plan_id");
      return new Response(JSON.stringify({ error: "Missing user_id or plan_id in payment notes" }), {
        status: 400, headers: corsHeaders,
      });
    }

    const plan = CREDIT_PLANS[planId];
    if (!plan) {
      console.error(`[Razorpay Webhook] Unknown plan_id: ${planId}`);
      await logWebhook(supabase, event, webhookData, userId, false, `unknown_plan_id: ${planId}`);
      return new Response(JSON.stringify({ error: "Unknown plan_id" }), {
        status: 400, headers: corsHeaders,
      });
    }

    // ── 5. Idempotency check — skip if this payment was ALREADY processed
    //    Match on payment_id alone (not event type) to prevent any duplicate grants.
    const { data: existingLog } = await supabase
      .from("webhook_logs")
      .select("id")
      .eq("source", "razorpay_credits")
      .eq("user_id", userId)
      .eq("processed", true)
      .filter("payload->>razorpay_payment_id", "eq", paymentId)
      .maybeSingle();

    if (existingLog) {
      console.log(`[Razorpay Webhook] Duplicate webhook for payment ${paymentId} — skipping`);
      return new Response(JSON.stringify({ received: true, action: "already_processed" }), {
        status: 200, headers: corsHeaders,
      });
    }

    // ── 5b. Also check pending_credit_purchases — skip if already paid
    if (purchaseId) {
      const { data: existingPurchase } = await supabase
        .from("pending_credit_purchases")
        .select("status")
        .eq("id", purchaseId)
        .maybeSingle();

      if (existingPurchase?.status === "paid") {
        console.log(`[Razorpay Webhook] Purchase ${purchaseId} already paid — skipping`);
        return new Response(JSON.stringify({ received: true, action: "already_paid" }), {
          status: 200, headers: corsHeaders,
        });
      }
    }

    // ── 6. Grant credits via RPC ─────────────────────────────────────
    const { data: newBalance, error: rpcError } = await supabase.rpc("increment_ai_credits", {
      p_user_id: userId,
      p_amount: plan.credits,
      p_transaction_type: "top_up",
      p_metadata: {
        plan_id: planId,
        razorpay_payment_id: paymentId,
        purchase_id: purchaseId || null,
        credits_granted: plan.credits,
      },
    });

    if (rpcError) {
      console.error("[Razorpay Webhook] RPC increment_ai_credits error:", rpcError.message);
      await logWebhook(supabase, event, { razorpay_payment_id: paymentId, plan_id: planId, notes }, userId, false, rpcError.message);
      return new Response(JSON.stringify({ error: "Credit grant failed" }), {
        status: 500, headers: corsHeaders,
      });
    }

    // ── 7. Update pending_credit_purchases ───────────────────────────
    if (purchaseId) {
      await supabase
        .from("pending_credit_purchases")
        .update({
          status: "paid",
          razorpay_payment_id: paymentId,
          paid_at: new Date().toISOString(),
        })
        .eq("id", purchaseId);
    }

    // ── 8. Audit log ─────────────────────────────────────────────────
    await logWebhook(
      supabase,
      event,
      {
        razorpay_payment_id: paymentId,
        plan_id: planId,
        credits_granted: plan.credits,
        new_balance: newBalance,
        purchase_id: purchaseId || null,
      },
      userId,
      true
    );

    console.log(`[Razorpay Webhook] ✅ ${plan.credits} credits granted → user=${userId} plan=${planId} payment=${paymentId} newBalance=${newBalance}`);

    return new Response(
      JSON.stringify({
        received: true,
        action: "credits_granted",
        credits: plan.credits,
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err: any) {
    console.error("[Razorpay Webhook] Unhandled error:", err);
    await logWebhook(supabase, "error", { raw: rawBody?.substring(0, 500) }, null, false, err.message);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: corsHeaders,
    });
  }
});
