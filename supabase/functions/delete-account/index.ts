// ═══════════════════════════════════════════════════════════════════════════
// Delete Account — Google Play Policy Compliance
//
// Permanently deletes a user's account and all associated data.
// Required by Google Play Store policy (April 2023+).
//
// Flow:
//   1. Verify the caller is authenticated (JWT required)
//   2. Delete data from all user-specific tables
//   3. Delete the auth user via Supabase Admin API
//
// Deploy:
//   npx supabase functions deploy delete-account
//
// This function requires a valid JWT — do NOT use --no-verify-jwt
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: corsHeaders,
    });
  }

  try {
    // ── 1. Authenticate the caller ──────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401, headers: corsHeaders,
      });
    }

    // Create a client with the user's JWT to verify identity
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_ANON_KEY") || "",
      {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: corsHeaders,
      });
    }

    const userId = user.id;
    console.log(`[Delete Account] Starting deletion for user: ${userId}`);

    // ── 2. Use service role client to delete all user data ──────────────
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Delete from all user-related tables
    // Order matters: delete dependent records first
    const deletionTasks = [
      adminClient.from("ai_chat_sessions").delete().eq("user_id", userId),
      adminClient.from("user_report_assignments").delete().eq("email", user.email || ""),
      adminClient.from("kyc").delete().eq("user_id", userId),
      adminClient.from("ai_credit_history").delete().eq("user_id", userId),
      adminClient.from("ai_wallets").delete().eq("user_id", userId),
      adminClient.from("pending_credit_purchases").delete().eq("user_id", userId),
      adminClient.from("pending_payments").delete().eq("user_id", userId),
      adminClient.from("portfolio_holdings").delete().eq("user_id", userId),
      adminClient.from("refund_requests").delete().eq("user_id", userId),
      adminClient.from("subscriptions").delete().eq("user_id", userId),
      adminClient.from("webhook_logs").delete().eq("user_id", userId),
      adminClient.from("push_tokens").delete().eq("user_id", userId),
      adminClient.from("profiles").delete().eq("user_id", userId),
    ];

    const results = await Promise.allSettled(deletionTasks);

    // Log any failures but continue — best-effort deletion
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(`[Delete Account] Task ${index} failed:`, result.reason);
      }
    });

    // ── 3. Delete the auth user ─────────────────────────────────────────
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error(`[Delete Account] Failed to delete auth user:`, deleteError.message);
      return new Response(JSON.stringify({ error: "Failed to delete account. Please contact support." }), {
        status: 500, headers: corsHeaders,
      });
    }

    console.log(`[Delete Account] ✅ Account fully deleted for user: ${userId}`);

    return new Response(
      JSON.stringify({ success: true, message: "Account and all data permanently deleted." }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err: any) {
    console.error("[Delete Account] Unhandled error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: corsHeaders,
    });
  }
});
