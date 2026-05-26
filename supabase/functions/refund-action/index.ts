// ═══════════════════════════════════════════════════════════════════════════
// Refund Action — Supabase Edge Function (Telegram Bot Integration)
// ═══════════════════════════════════════════════════════════════════════════
//
// This function handles TWO things:
//   1. POST /refund-action  — called by the app when a user submits a refund request
//      → Sends instant message notification to Telegram chat with Approve/Reject links
//
//   2. GET /refund-action?action=approve&id=xxx&token=xxx  — clicked by admin from Telegram
//      → Approves or rejects the refund request + deactivates subscription if approved
//
// Deploy:
//   npx supabase functions deploy refund-action --no-verify-jwt
//
// Environment variables (set in Supabase Dashboard → Edge Functions → Secrets):
//   SUPABASE_URL              — auto-injected
//   SUPABASE_SERVICE_ROLE_KEY — auto-injected
//   TELEGRAM_BOT_TOKEN        — Telegram Bot HTTP API Token (from @BotFather)
//   TELEGRAM_CHAT_ID          — Your numeric Telegram Chat/User ID (from @userinfobot)
//   REFUND_SECRET             — A random string used to sign admin action links
//
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

// ─── Config ───────────────────────────────────────────────────────────────────
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") || "tikonacapital@gmail.com";

const PLAN_NAMES: Record<string, string> = {
  midcap_wealth: "Mid Cap Wealth Builders",
  smallcap_alpha: "Smallcap Alpha Picks",
  sme_emerging: "SME Emerging Business",
  all_in_growth: "All In Growth Bundle",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// ─── Generate HMAC token for secure action links ──────────────────────────────
async function generateToken(requestId: string, action: string): Promise<string> {
  const secret = Deno.env.get("REFUND_SECRET") || "default-refund-secret";
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const data = `${requestId}:${action}`;
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyToken(requestId: string, action: string, token: string): Promise<boolean> {
  const expected = await generateToken(requestId, action);
  if (expected.length !== token.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  }
  return mismatch === 0;
}

// ─── Supabase client ──────────────────────────────────────────────────────────
function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ─── Format INR ───────────────────────────────────────────────────────────────
function formatINR(amount: number): string {
  return "₹" + amount.toLocaleString("en-IN");
}

// ─── Send Admin Notification via Telegram ─────────────────────────────────────
async function sendAdminTelegram(request: any): Promise<boolean> {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");

  if (!botToken || !chatId) {
    console.warn("[Refund] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — skipping Telegram notification");
    return false;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const functionUrl = `${supabaseUrl}/functions/v1/refund-action`;

  // Generate secure tokens for approve/reject links
  const approveToken = await generateToken(request.id, "approve");
  const rejectToken = await generateToken(request.id, "reject");

  const approveUrl = `${functionUrl}?action=approve&id=${request.id}&token=${approveToken}`;
  const rejectUrl = `${functionUrl}?action=reject&id=${request.id}&token=${rejectToken}`;

  const planName = PLAN_NAMES[request.plan] || request.plan;

  // Format message using Telegram's supported HTML tags
  const messageText = `<b>🔄 New Refund Request</b>
━━━━━━━━━━━━━━━━━━
<b>Plan:</b> ${planName}
<b>Total Paid:</b> ${formatINR(request.total_paid)}
<b>Refund Amount:</b> <b>${formatINR(request.refund_amount)}</b> (Pro-rata)
<b>User UPI ID:</b> <code>${request.upi_id}</code> <i>(Tap to copy)</i>
<b>User ID:</b> <code>${request.user_id}</code>
<b>Months Used:</b> ${request.months_used} months
<b>Months Remaining:</b> ${request.months_remaining} months

${request.reason ? `<b>User's Reason:</b>\n<i>"${request.reason}"</i>` : `<b>User's Reason:</b> None`}
━━━━━━━━━━━━━━━━━━
👉 <a href="${approveUrl}"><b>Approve Refund</b></a>
👉 <a href="${rejectUrl}"><b>Reject Refund</b></a>`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[Refund] Telegram API error:", errText);
      return false;
    }

    console.log("[Refund] ✅ Telegram notification sent successfully");
    return true;
  } catch (err) {
    console.error("[Refund] Telegram dispatch failed:", err);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main handler
// ═══════════════════════════════════════════════════════════════════════════════

serve(async (req: Request) => {
  // ── CORS preflight ──
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // ════════════════════════════════════════════════════════════════════════════
  // GET — Admin clicks approve/reject from Telegram message
  // ════════════════════════════════════════════════════════════════════════════
  if (req.method === "GET") {
    const action = url.searchParams.get("action"); // "approve" or "reject"
    const requestId = url.searchParams.get("id");
    const token = url.searchParams.get("token");

    if (!action || !requestId || !token) {
      return new Response(renderResultPage("error", "Missing parameters", "The link appears to be invalid or incomplete."), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/html" },
      });
    }

    if (action !== "approve" && action !== "reject") {
      return new Response(renderResultPage("error", "Invalid Action", "Action must be 'approve' or 'reject'."), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/html" },
      });
    }

    // Verify HMAC token
    const valid = await verifyToken(requestId, action, token);
    if (!valid) {
      return new Response(renderResultPage("error", "Invalid Token", "This link has expired or is invalid. Please check Telegram for the latest link."), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "text/html" },
      });
    }

    const supabase = getSupabase();

    // Fetch the request
    const { data: refundReq, error: fetchErr } = await supabase
      .from("refund_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (fetchErr || !refundReq) {
      return new Response(renderResultPage("error", "Request Not Found", "This refund request could not be found."), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "text/html" },
      });
    }

    // Check if already processed
    if (refundReq.status !== "pending") {
      return new Response(renderResultPage("info", "Already Processed", `This request was already <strong>${refundReq.status}</strong> on ${new Date(refundReq.reviewed_at).toLocaleString("en-IN")}.`), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/html" },
      });
    }

    const newStatus = action === "approve" ? "approved" : "rejected";

    // Update refund request status
    const { error: updateErr } = await supabase
      .from("refund_requests")
      .update({
        status: newStatus,
        reviewed_by: ADMIN_EMAIL,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (updateErr) {
      console.error("[Refund] Update error:", updateErr);
      return new Response(renderResultPage("error", "Update Failed", "Failed to update the refund request. Please try again or update manually in Supabase."), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "text/html" },
      });
    }

    // If APPROVED → deactivate the subscription
    if (action === "approve") {
      const { error: subErr } = await supabase
        .from("subscriptions")
        .update({ is_active: false })
        .eq("id", refundReq.subscription_id);

      if (subErr) {
        console.error("[Refund] Subscription deactivation error:", subErr);
        // Don't fail the entire flow — log the issue
      } else {
        console.log("[Refund] ✅ Subscription deactivated:", refundReq.subscription_id);
      }
    }

    const planName = PLAN_NAMES[refundReq.plan] || refundReq.plan;

    if (action === "approve") {
      // Generate UPI Deep Link
      // Ensure the exact amount has 2 decimal places as required by UPI specification
      const upiLink = `upi://pay?pa=${refundReq.upi_id}&pn=Tikona%20User&am=${refundReq.refund_amount.toFixed(2)}&cu=INR&tn=Refund%20for%20${encodeURIComponent(planName)}`;

      return new Response(
        renderResultPage("success", "Refund Approved ✅", `
          <p>The refund of <strong>${formatINR(refundReq.refund_amount)}</strong> for <strong>${planName}</strong> has been approved.</p>
          <p>The user's subscription has been automatically deactivated.</p>
          
          <div style="margin:32px 0;padding:24px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
            <p style="margin:0 0 16px;color:#475569;font-weight:600;font-size:14px;">HOW TO PROCESS PAYMENT:</p>
            <p style="margin:0 0 20px;color:#64748b;font-size:13px;">User's UPI ID: <strong>${refundReq.upi_id}</strong></p>
            
            <a href="${upiLink}" style="display:inline-block;background:#0ea5e9;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;width:100%;box-sizing:border-box;margin-bottom:12px;">
              📲 Pay ${formatINR(refundReq.refund_amount)} via UPI App
            </a>
            
            <p style="margin:0 0 12px;color:#94a3b8;font-size:12px;">— OR IF ON DESKTOP —</p>
            
            <a href="https://dashboard.razorpay.com/app/payments" target="_blank" style="display:inline-block;background:#1e293b;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;width:100%;box-sizing:border-box;">
              💻 Open Razorpay Dashboard
            </a>
            
            <p style="margin:16px 0 0;color:#94a3b8;font-size:11px;">(UPI button only works on smartphones with GPay, PhonePe, Paytm, etc. installed.)</p>
          </div>
        `),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html" } }
      );
    } else {
      return new Response(
        renderResultPage("rejected", "Refund Rejected ❌", `
          <p>The refund request for <strong>${planName}</strong> (${formatINR(refundReq.refund_amount)}) has been rejected.</p>
          <p>The user's subscription remains active.</p>
        `),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html" } }
      );
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // POST — Called by the mobile app to notify admin
  // ════════════════════════════════════════════════════════════════════════════
  if (req.method === "POST") {
    try {
      const body = await req.json();
      const { request_id, user_id } = body;

      if (!request_id || !user_id) {
        return new Response(
          JSON.stringify({ error: "Missing request_id or user_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch the full request from DB and verify it belongs to the claimed user_id
      // This prevents any caller from triggering admin messages for arbitrary refund IDs
      const supabase = getSupabase();
      const { data: refundReq, error: fetchErr } = await supabase
        .from("refund_requests")
        .select("*")
        .eq("id", request_id)
        .eq("user_id", user_id)   // ← ownership check
        .eq("status", "pending")  // ← only fresh requests
        .single();

      if (fetchErr || !refundReq) {
        console.warn("[Refund] POST: request not found or ownership mismatch for id:", request_id);
        return new Response(
          JSON.stringify({ error: "Refund request not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const telegramSent = await sendAdminTelegram(refundReq);

      return new Response(
        JSON.stringify({ success: true, telegram_sent: telegramSent }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err: any) {
      console.error("[Refund] POST error:", err);
      return new Response(
        JSON.stringify({ error: err.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  return new Response(
    JSON.stringify({ error: "Method not allowed" }),
    { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// Beautiful HTML result page shown to admin after clicking approve/reject
// ═══════════════════════════════════════════════════════════════════════════════

function renderResultPage(type: "success" | "rejected" | "error" | "info", title: string, body: string): string {
  const colors: Record<string, { bg: string; accent: string; icon: string }> = {
    success: { bg: "#ECFDF5", accent: "#059669", icon: "✅" },
    rejected: { bg: "#FEF2F2", accent: "#DC2626", icon: "❌" },
    error: { bg: "#FEF2F2", accent: "#DC2626", icon: "⚠️" },
    info: { bg: "#EFF6FF", accent: "#3A5BA0", icon: "ℹ️" },
  };
  const c = colors[type] || colors.info;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Tikona Capital</title>
  <style>
    body { margin:0; padding:0; background:${c.bg}; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; min-height:100vh; display:flex; align-items:center; justify-content:center; }
    .card { background:#fff; border-radius:20px; padding:48px 40px; max-width:480px; width:90%; text-align:center; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
    .icon { font-size:48px; margin-bottom:16px; }
    h1 { color:#111827; font-size:24px; margin:0 0 16px; }
    .body { color:#374151; font-size:15px; line-height:1.6; }
    .body p { margin:8px 0; }
    .footer { margin-top:32px; color:#9ca3af; font-size:12px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${c.icon}</div>
    <h1>${title}</h1>
    <div class="body">${body}</div>
    <div class="footer">Tikona Capital — Refund Management System</div>
  </div>
</body>
</html>`;
}
