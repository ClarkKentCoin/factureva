// Send invoice email — V1.
// Receives the invoice id and a base64 PDF from the client, validates tenant
// membership server-side, sends via Resend (if configured), and writes a row
// in invoice_email_logs. Falls back gracefully when no provider is configured.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Payload = {
  invoice_id: string;
  recipient: string;
  cc?: string | null;
  subject: string;
  body: string;
  pdf_base64: string;
  pdf_filename: string;
};

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const isEmail = (s: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return json(500, { error: "server_misconfigured" });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return json(401, { error: "unauthenticated" });
  }

  // Parse + validate body.
  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }
  const { invoice_id, recipient, cc, subject, body: emailBody, pdf_base64, pdf_filename } = body ?? {};
  if (!invoice_id || typeof invoice_id !== "string") return json(400, { error: "invoice_id_required" });
  if (!recipient || !isEmail(recipient)) return json(400, { error: "recipient_invalid" });
  if (cc && !isEmail(cc)) return json(400, { error: "cc_invalid" });
  if (!subject || typeof subject !== "string" || subject.length > 300) return json(400, { error: "subject_invalid" });
  if (!emailBody || typeof emailBody !== "string" || emailBody.length > 20000) return json(400, { error: "body_invalid" });
  if (!pdf_base64 || typeof pdf_base64 !== "string" || pdf_base64.length > 8_000_000) return json(400, { error: "pdf_invalid" });
  if (!pdf_filename || typeof pdf_filename !== "string") return json(400, { error: "filename_invalid" });

  // Auth: verify the JWT and resolve the user.
  const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json(401, { error: "unauthenticated" });
  const userId = userData.user.id;

  // Service-role client for trusted reads/writes.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Load invoice + verify tenant membership.
  const { data: inv, error: invErr } = await admin
    .from("invoices")
    .select("id, tenant_id, invoice_number, status")
    .eq("id", invoice_id)
    .maybeSingle();
  if (invErr || !inv) return json(404, { error: "invoice_not_found" });

  const { data: isMember, error: memErr } = await admin.rpc("is_tenant_member", {
    _tenant_id: inv.tenant_id,
    _user_id: userId,
  });
  if (memErr || !isMember) return json(403, { error: "not_authorized" });

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const FROM_ADDRESS = Deno.env.get("INVOICE_EMAIL_FROM") ?? "Facturly <onboarding@resend.dev>";

  // Pre-insert a queued log row.
  const { data: logRow } = await admin
    .from("invoice_email_logs")
    .insert({
      tenant_id: inv.tenant_id,
      invoice_id: inv.id,
      recipient,
      cc: cc ?? null,
      subject,
      body: emailBody,
      status: "queued",
      provider: RESEND_API_KEY ? "resend" : null,
      sent_by: userId,
    })
    .select("id")
    .single();
  const logId = logRow?.id as string | undefined;

  // Provider missing → graceful failure, persist as 'failed' with explanatory error.
  if (!RESEND_API_KEY) {
    if (logId) {
      await admin
        .from("invoice_email_logs")
        .update({ status: "failed", error_message: "email_provider_not_configured" })
        .eq("id", logId);
    }
    return json(503, { error: "email_provider_not_configured" });
  }

  // Send via Resend.
  try {
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [recipient],
        cc: cc ? [cc] : undefined,
        subject,
        html: emailBody.replace(/\n/g, "<br/>"),
        attachments: [{ filename: pdf_filename, content: pdf_base64 }],
      }),
    });
    const resendJson = await resendRes.json().catch(() => ({}));
    if (!resendRes.ok) {
      const errMsg = (resendJson?.message || resendJson?.error || `http_${resendRes.status}`).toString().slice(0, 500);
      if (logId) {
        await admin
          .from("invoice_email_logs")
          .update({ status: "failed", error_message: errMsg })
          .eq("id", logId);
      }
      return json(502, { error: "provider_error", detail: errMsg });
    }
    const messageId = resendJson?.id ?? null;
    if (logId) {
      await admin
        .from("invoice_email_logs")
        .update({ status: "sent", provider_message_id: messageId })
        .eq("id", logId);
    }
    await admin
      .from("invoices")
      .update({ last_sent_at: new Date().toISOString(), last_sent_to: recipient })
      .eq("id", inv.id);
    return json(200, { ok: true, message_id: messageId });
  } catch (e) {
    const errMsg = (e instanceof Error ? e.message : "unknown_error").slice(0, 500);
    if (logId) {
      await admin
        .from("invoice_email_logs")
        .update({ status: "failed", error_message: errMsg })
        .eq("id", logId);
    }
    return json(500, { error: "send_failed", detail: errMsg });
  }
});
