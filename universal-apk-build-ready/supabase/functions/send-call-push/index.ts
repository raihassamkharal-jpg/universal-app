// ==============================================================================
// UNIVERSAL — SUPABASE EDGE FUNCTION: send-call-push
// Production Web Push Delivery for Background Incoming Audio/Video Calls
// ==============================================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushRequestBody {
  callId: string;
  recipientUserId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string | null;
  callType: "audio" | "video";
  conversationId?: string | null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:support@universal.app";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase configuration environment variables." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Authorize calling user via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing Authorization header." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid user session." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: PushRequestBody = await req.json();
    const { callId, recipientUserId, callerId, callerName, callerAvatar, callType, conversationId } = body;

    // Caller must match the authenticated user to prevent arbitrary impersonation
    if (user.id !== callerId) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Caller ID mismatch." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Check if recipient has blocked this caller
    const { data: isBlocked } = await supabaseAdmin
      .from("blocked_users")
      .select("id")
      .eq("user_id", recipientUserId)
      .eq("blocked_user_id", callerId)
      .maybeSingle();

    if (isBlocked) {
      return new Response(
        JSON.stringify({ success: false, reason: "Recipient has blocked this caller." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Query recipient's active device registrations (exclude caller's own devices)
    const { data: devices, error: devError } = await supabaseAdmin
      .from("user_device_registrations")
      .select("*")
      .eq("user_id", recipientUserId)
      .eq("is_active", true)
      .neq("user_id", callerId);

    if (devError) {
      throw devError;
    }

    if (!devices || devices.length === 0) {
      return new Response(
        JSON.stringify({ success: true, delivered: 0, reason: "No active push devices registered for recipient." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Construct Web Push notification payload
    const notificationPayload = JSON.stringify({
      type: "incoming_call",
      callId,
      callerId,
      callerName: callerName || "Universal Contact",
      callerAvatar: callerAvatar || null,
      callType: callType || "audio",
      conversationId: conversationId || null,
      title: `Incoming ${callType === "video" ? "Video" : "Audio"} Call`,
      body: `${callerName || "Someone"} is calling you on Universal...`,
      url: `/?callId=${encodeURIComponent(callId)}&callAction=open&callType=${encodeURIComponent(callType || "audio")}`,
    });

    let deliveredCount = 0;
    const expiredEndpoints: string[] = [];

    // 5. Send push notifications to all registered recipient devices
    for (const device of devices) {
      try {
        if (!device.endpoint.startsWith("http")) {
          // Internal pseudo-device tag for local browser tabs
          deliveredCount++;
          continue;
        }

        // When standard VAPID keys are configured, deliver standard RFC 8291 Web Push
        if (vapidPrivateKey && vapidPublicKey) {
          // Dynamic import of web-push compatible module
          const webpush = await import("npm:web-push@3.6.7");
          webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

          const pushSubscription = {
            endpoint: device.endpoint,
            keys: {
              p256dh: device.p256dh,
              auth: device.auth,
            },
          };

          await webpush.sendNotification(pushSubscription, notificationPayload, {
            TTL: 45, // 45 seconds TTL matching call ringing duration
            urgency: "high",
          });

          deliveredCount++;
        } else {
          // Direct POST to endpoint if service worker provider supports direct delivery
          const resp = await fetch(device.endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              TTL: "45",
              Urgency: "high",
            },
            body: notificationPayload,
          });

          if (resp.status === 404 || resp.status === 410) {
            expiredEndpoints.push(device.endpoint);
          } else if (resp.ok) {
            deliveredCount++;
          }
        }
      } catch (pushErr: any) {
        console.warn(`[send-call-push] Push failed for endpoint ${device.endpoint}:`, pushErr?.message);
        if (pushErr?.statusCode === 404 || pushErr?.statusCode === 410) {
          expiredEndpoints.push(device.endpoint);
        }
      }
    }

    // 6. Prune expired / unsubscribed endpoints
    if (expiredEndpoints.length > 0) {
      await supabaseAdmin
        .from("user_device_registrations")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .in("endpoint", expiredEndpoints);
    }

    return new Response(
      JSON.stringify({
        success: true,
        delivered: deliveredCount,
        totalDevices: devices.length,
        prunedExpired: expiredEndpoints.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[send-call-push] Internal error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to process push notification." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
