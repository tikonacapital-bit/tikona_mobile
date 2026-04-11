// ═══════════════════════════════════════════════════════════════════════════
// Tradebox / Razorpay Unified Payment Webhook — Supabase Edge Function
//
// Handles `payment.captured` events from Razorpay (via Tradebox).
// Determines whether the payment is for:
//   1. AI Credit top-up  → grants credits via increment_ai_credits RPC
//   2. Subscription plan → activates subscription in subscriptions table
//
// Resolution order:
//   a. Resolve user by email from payment → profiles table
//   b. Check pending_credit_purchases for this user → grant credits
//   c. Check pending_payments for this user → activate subscription
//   d. Fallback: use amount-based mapping for subscriptions
//
// Deploy:
//   npx supabase functions deploy tradebox-webhook --no-verify-jwt
//
// Secrets (Supabase Dashboard → Edge Functions → Secrets):
//   RAZORPAY_WEBHOOK_SECRET   — from Razorpay Dashboard → Webhooks
// ═══════════════════════════════════════════════════════════════════════════

import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Credit Plans (token amounts granted per pack) ─────────────────────────
const CREDIT_PLANS: Record<string, { credits: number }> = {
  pack_299:  { credits: 150000 },
  pack_999:  { credits: 600000 },
  pack_4999: { credits: 3750000 },
};

// ─── Amount-based fallback: paise → credit plan ────────────────────────────
// Used only if pending_credit_purchases lookup fails
const CREDIT_AMOUNT_TO_PLAN: Record<number, string> = {
  29900:  "pack_299",   // ₹299
  99900:  "pack_999",   // ₹999
  499900: "pack_4999",  // ₹4,999
};

// ─── Amount-based fallback: paise → subscription plan ──────────────────────
// Used only if pending_payments lookup fails
const SUB_AMOUNT_TO_PLAN: Record<number, string> = {
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

// ─── HMAC Signature Verification ───────────────────────────────────────────
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

// ─── Helper: log to webhook_logs ───────────────────────────────────────────
async function logWebhook(
  supabase: any,
  source: string,
  event: string,
  payload: any,
  userId: string | null,
  processed: boolean,
  errorMessage: string | null = null
) {
  try {
    await supabase.from("webhook_logs").insert({
      source,
      event,
      payload,
      user_id: userId,
      processed,
      error_message: errorMessage,
    });
  } catch (e) {
    console.error("[Webhook] Failed to write webhook_log:", e);
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  let rawBody = "";

  try {
    rawBody = await req.text();

    // ── 1. Verify Razorpay signature ───────────────────────────────────────
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
    const event = webhookData.event;

    // ── 2. Only care about successful payments ─────────────────────────────
    if (event !== "payment.captured") {
      console.log(`[Webhook] Ignoring event: ${event}`);
      return new Response(JSON.stringify({ received: true, action: "ignored" }), { status: 200, headers: corsHeaders });
    }

    const payment = webhookData.payload?.payment?.entity;
    if (!payment) return new Response(JSON.stringify({ error: "Missing payment entity" }), { status: 400, headers: corsHeaders });

    const { id: paymentId, amount, email, contact } = payment;
    console.log(`[Webhook] payment.captured — paymentId=${paymentId} amount=${amount} email=${email}`);

    // ── 3. Idempotency — skip if this payment was already processed ────────
    const { data: existingLog } = await supabase
      .from("webhook_logs")
      .select("id")
      .eq("source", "tradebox_unified")
      .eq("processed", true)
      .filter("payload->>razorpay_payment_id", "eq", paymentId)
      .maybeSingle();

    if (existingLog) {
      console.log(`[Webhook] Duplicate webhook for payment ${paymentId} — skipping`);
      return new Response(JSON.stringify({ received: true, action: "already_processed" }), { status: 200, headers: corsHeaders });
    }

    // ── 4. Resolve user — multi-strategy ───────────────────────────────────
    // The user may enter a DIFFERENT email on Tradebox than what's in their
    // profile. We try multiple strategies to find them.
    let userId = "";
    let resolveMethod = "";

    // Strategy A: Match payment email → profiles table (fastest, most common)
    if (email) {
      const { data } = await supabase.from("profiles").select("user_id").eq("email", email).maybeSingle();
      if (data?.user_id) {
        userId = data.user_id;
        resolveMethod = "profiles_email";
      }
    }

    // Strategy B: Reverse-lookup via pending_credit_purchases.email
    // The app stores the user's registered email before redirect. If THAT
    // email is different from the Tradebox payment email, we can still find
    // the user because we stored their registered email in the table.
    if (!userId && email) {
      // B1: Check if the payment email is stored as the registered email
      const { data: pendingByEmail } = await supabase
        .from("pending_credit_purchases")
        .select("user_id")
        .eq("email", email)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (pendingByEmail?.user_id) {
        userId = pendingByEmail.user_id;
        resolveMethod = "pending_credit_email_match";
        console.log(`[Webhook] Resolved user via pending_credit_purchases email match — user=${userId}`);
      }
    }

    // Strategy B2: If payment email didn't match, find the most recent
    // pending purchase (any email) — this catches the case where user
    // entered a completely different email on Tradebox
    if (!userId) {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: recentPending } = await supabase
        .from("pending_credit_purchases")
        .select("user_id, email")
        .eq("status", "pending")
        .gte("created_at", fiveMinAgo)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (recentPending?.user_id) {
        userId = recentPending.user_id;
        resolveMethod = "pending_credit_recent";
        console.log(`[Webhook] Resolved user via most recent pending purchase (within 5min) — user=${userId} storedEmail=${recentPending.email} paymentEmail=${email}`);
      }
    }

    // Strategy C: Match payment email → Supabase auth.users
    // (user may have a profile with a different email but auth email matches)
    if (!userId && email) {
      const { data: authUsers } = await supabase.auth.admin.listUsers();
      const matchedAuthUser = authUsers?.users?.find(
        (u: any) => u.email?.toLowerCase() === email.toLowerCase()
      );
      if (matchedAuthUser) {
        userId = matchedAuthUser.id;
        resolveMethod = "auth_users_email";
        console.log(`[Webhook] Resolved user via auth.users email — user=${userId}`);
      }
    }

    // Strategy D: Find pending_credit_purchases by amount + recent (last 30 min)
    // Last resort — if only one user has a pending purchase matching this amount
    if (!userId) {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const creditPlanId = CREDIT_AMOUNT_TO_PLAN[amount];
      if (creditPlanId) {
        const { data: recentPending } = await supabase
          .from("pending_credit_purchases")
          .select("user_id")
          .eq("plan_id", creditPlanId)
          .eq("status", "pending")
          .gte("created_at", thirtyMinAgo)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (recentPending?.user_id) {
          userId = recentPending.user_id;
          resolveMethod = "pending_amount_recent";
          console.log(`[Webhook] Resolved user via recent pending amount match — user=${userId}`);
        }
      }
    }

    if (!userId) {
      console.error(`[Webhook] User not found after all strategies — email=${email} amount=${amount} — manual review needed`);
      await logWebhook(supabase, "tradebox_unified", event, { razorpay_payment_id: paymentId, amount, email, contact }, null, false, "user_not_found_all_strategies");
      return new Response(
        JSON.stringify({ received: true, action: "pending", reason: "user not found — manual review needed" }),
        { status: 200, headers: corsHeaders }
      );
    }

    console.log(`[Webhook] User resolved: userId=${userId} via ${resolveMethod}`);

    // ── 5. Try AI Credits first (pending_credit_purchases table) ───────────
    const { data: pendingCredit } = await supabase
      .from("pending_credit_purchases")
      .select("id, plan_id, credits, status")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingCredit) {
      const plan = CREDIT_PLANS[pendingCredit.plan_id];
      if (plan) {
        console.log(`[Webhook] AI credit purchase found — user=${userId} plan=${pendingCredit.plan_id} credits=${plan.credits}`);

        // Grant credits via RPC
        const { data: newBalance, error: rpcError } = await supabase.rpc("increment_ai_credits", {
          p_user_id: userId,
          p_amount: plan.credits,
          p_transaction_type: "top_up",
          p_metadata: {
            plan_id: pendingCredit.plan_id,
            razorpay_payment_id: paymentId,
            purchase_id: pendingCredit.id,
            credits_granted: plan.credits,
            source: "tradebox",
          },
        });

        if (rpcError) {
          console.error("[Webhook] RPC increment_ai_credits error:", rpcError.message);
          await logWebhook(supabase, "tradebox_unified", event, { razorpay_payment_id: paymentId, plan_id: pendingCredit.plan_id }, userId, false, rpcError.message);
          return new Response(JSON.stringify({ error: "Credit grant failed" }), { status: 500, headers: corsHeaders });
        }

        // Mark pending purchase as paid
        await supabase
          .from("pending_credit_purchases")
          .update({
            status: "paid",
            razorpay_payment_id: paymentId,
            paid_at: new Date().toISOString(),
          })
          .eq("id", pendingCredit.id);

        // Audit log
        await logWebhook(
          supabase, "tradebox_unified", event,
          {
            razorpay_payment_id: paymentId,
            type: "ai_credits",
            plan_id: pendingCredit.plan_id,
            credits_granted: plan.credits,
            new_balance: newBalance,
            purchase_id: pendingCredit.id,
            resolve_method: resolveMethod,
          },
          userId, true
        );

        console.log(`[Webhook] ✅ ${plan.credits} credits granted → user=${userId} plan=${pendingCredit.plan_id} newBalance=${newBalance}`);
        return new Response(
          JSON.stringify({ received: true, action: "credits_granted", credits: plan.credits }),
          { status: 200, headers: corsHeaders }
        );
      }
    }

    // ── 6. Try amount-based credit matching (fallback for credits) ──────────
    const creditPlanId = CREDIT_AMOUNT_TO_PLAN[amount];
    if (creditPlanId) {
      const plan = CREDIT_PLANS[creditPlanId];
      if (plan) {
        console.log(`[Webhook] Amount-based credit match — user=${userId} amount=${amount} plan=${creditPlanId}`);

        const { data: newBalance, error: rpcError } = await supabase.rpc("increment_ai_credits", {
          p_user_id: userId,
          p_amount: plan.credits,
          p_transaction_type: "top_up",
          p_metadata: {
            plan_id: creditPlanId,
            razorpay_payment_id: paymentId,
            credits_granted: plan.credits,
            source: "tradebox_amount_fallback",
          },
        });

        if (rpcError) {
          console.error("[Webhook] RPC increment_ai_credits error (fallback):", rpcError.message);
          await logWebhook(supabase, "tradebox_unified", event, { razorpay_payment_id: paymentId, plan_id: creditPlanId }, userId, false, rpcError.message);
          return new Response(JSON.stringify({ error: "Credit grant failed" }), { status: 500, headers: corsHeaders });
        }

        // Clean up any stale pending records
        await supabase
          .from("pending_credit_purchases")
          .update({ status: "paid", razorpay_payment_id: paymentId, paid_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("status", "pending");

        await logWebhook(
          supabase, "tradebox_unified", event,
          {
            razorpay_payment_id: paymentId,
            type: "ai_credits_amount_fallback",
            plan_id: creditPlanId,
            credits_granted: plan.credits,
            new_balance: newBalance,
          },
          userId, true
        );

        console.log(`[Webhook] ✅ (fallback) ${plan.credits} credits granted → user=${userId} plan=${creditPlanId}`);
        return new Response(
          JSON.stringify({ received: true, action: "credits_granted", credits: plan.credits }),
          { status: 200, headers: corsHeaders }
        );
      }
    }

    // ── 7. Try Subscription (pending_payments table) ────────────────────────
    let subPlan = "";

    const { data: pending } = await supabase
      .from("pending_payments")
      .select("plan")
      .eq("user_id", userId)
      .maybeSingle();
    if (pending?.plan) subPlan = pending.plan;

    // Amount-based fallback for subscriptions
    if (!subPlan) subPlan = SUB_AMOUNT_TO_PLAN[amount] || "";

    if (subPlan) {
      console.log(`[Webhook] Subscription activation — user=${userId} plan=${subPlan}`);

      // Activate subscription
      const startsAt = new Date();
      const expiresAt = new Date(startsAt);
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      const { error } = await supabase.from("subscriptions").upsert(
        {
          user_id: userId,
          plan: subPlan,
          is_active: true,
          started_at: startsAt.toISOString(),
          expires_at: expiresAt.toISOString(),
          amount_paid: amount / 100,
        },
        { onConflict: "user_id" }
      );

      if (error) {
        console.error("[Webhook] DB error (subscription):", error.message);
        await logWebhook(supabase, "tradebox_unified", event, { razorpay_payment_id: paymentId, plan: subPlan }, userId, false, error.message);
        return new Response(JSON.stringify({ error: "DB error" }), { status: 500, headers: corsHeaders });
      }

      // Clean up pending payment record
      await supabase.from("pending_payments").delete().eq("user_id", userId);

      await logWebhook(
        supabase, "tradebox_unified", event,
        {
          razorpay_payment_id: paymentId,
          type: "subscription",
          plan: subPlan,
          amount_paid: amount / 100,
        },
        userId, true
      );

      console.log(`[Webhook] ✅ Subscription activated → user=${userId} plan=${subPlan}`);
      return new Response(JSON.stringify({ received: true, action: "subscription_activated", plan: subPlan }), { status: 200, headers: corsHeaders });
    }

    // ── 8. No match — log for manual review ────────────────────────────────
    console.error(`[Webhook] Cannot resolve payment type — user=${userId} amount=${amount} — manual review needed`);
    await logWebhook(
      supabase, "tradebox_unified", event,
      { razorpay_payment_id: paymentId, amount, email, user_id: userId },
      userId, false, "unresolved_payment_type"
    );
    return new Response(
      JSON.stringify({ received: true, action: "pending", reason: "payment type unknown — manual review needed" }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err: any) {
    console.error("[Webhook] Unhandled error:", err);
    await logWebhook(supabase, "tradebox_unified", "error", { raw: rawBody?.substring(0, 500) }, null, false, err.message);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: corsHeaders });
  }
});
