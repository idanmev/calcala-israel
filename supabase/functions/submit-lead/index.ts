import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Israeli phone regex: 05X-XXXXXXX, 05XXXXXXXX, +9725XXXXXXXX, etc.
const PHONE_REGEX = /^(\+972|0)5\d[\s-]?\d{3}[\s-]?\d{4}$/;

// Rate limit window: reject same phone within this period
const RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();

    // ----- 1. HONEYPOT CHECK -----
    // The "company" field is hidden via CSS on the frontend.
    // Legitimate users never fill it. Bots auto-fill all fields.
    if (body.company && body.company.trim().length > 0) {
      console.warn("[submit-lead] Honeypot triggered, rejecting");
      // Return 200 to not tip off the bot
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // ----- 2. EXTRACT & VALIDATE FIELDS -----
    const phone = (body.phone || "").trim();
    const name = (body.name || "").trim();
    const email = (body.email || "").trim() || null;
    const vertical = body.vertical || "כללי";
    const categorySlug = body.category_slug || "taxation";
    const answers = body.answers || {};
    const sourceUrl = body.source_url || null;
    const articleSlug = body.article_slug || null;
    const utmSource = body.utm_source || null;
    const utmCampaign = body.utm_campaign || null;

    if (!name || name.length < 2) {
      return new Response(
        JSON.stringify({ error: "שם מלא הוא שדה חובה" }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // Normalize phone: remove spaces and dashes for validation
    const phoneNormalized = phone.replace(/[\s-]/g, "");
    if (!phone || phoneNormalized.length < 9) {
      return new Response(
        JSON.stringify({ error: "מספר טלפון אינו תקין" }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // ----- 3. RATE LIMITING (same phone within 5 minutes) -----
    const rateLimitCutoff = new Date(Date.now() - RATE_LIMIT_MS).toISOString();

    const { data: recentLeads } = await supabase
      .from("leads")
      .select("id")
      .eq("phone", phone)
      .gte("created_at", rateLimitCutoff)
      .limit(1);

    if (recentLeads && recentLeads.length > 0) {
      return new Response(
        JSON.stringify({
          error: "הבקשה כבר נשלחה. נציג יחזור אליך בהקדם.",
        }),
        {
          status: 429,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // ----- 4. INSERT LEAD (database-first — lead is safe before webhook) -----
    const leadData = {
      vertical,
      category_slug: categorySlug,
      name,
      phone,
      email,
      answers,
      source_url: sourceUrl,
      article_slug: articleSlug,
      utm_source: utmSource,
      utm_campaign: utmCampaign,
      status: "new",
      webhook_status: "pending",
    };

    const { data: insertedLead, error: insertError } = await supabase
      .from("leads")
      .insert(leadData)
      .select("id")
      .single();

    if (insertError) {
      console.error("[submit-lead] Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "שגיאה בשליחת הטופס. נסה שוב." }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const leadId = insertedLead.id;
    console.log(`[submit-lead] Lead ${leadId} saved successfully`);

    // ----- 5. FETCH WEBHOOK URL (server-side, never exposed to client) -----
    let webhookStatus = "no_webhook";

    const { data: quizConfig } = await supabase
      .from("quiz_configs")
      .select("webhook_url")
      .eq("category_slug", categorySlug)
      .eq("is_active", true)
      .single();

    if (quizConfig?.webhook_url) {
      // ----- 6. DISPATCH WEBHOOK (server-side) -----
      try {
        const webhookPayload = {
          lead_id: leadId,
          name,
          phone,
          email,
          vertical,
          category_slug: categorySlug,
          answers,
          source_url: sourceUrl,
          article_slug: articleSlug,
          utm_source: utmSource,
          utm_campaign: utmCampaign,
          timestamp: new Date().toISOString(),
        };

        const webhookResponse = await fetch(quizConfig.webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(webhookPayload),
        });

        if (webhookResponse.ok) {
          webhookStatus = "sent";
          console.log(`[submit-lead] Webhook dispatched for lead ${leadId}`);
        } else {
          webhookStatus = "failed";
          console.error(
            `[submit-lead] Webhook failed for lead ${leadId}: HTTP ${webhookResponse.status}`
          );
        }
      } catch (webhookErr) {
        webhookStatus = "failed";
        console.error(
          `[submit-lead] Webhook exception for lead ${leadId}:`,
          webhookErr
        );
      }
    }

    // ----- 7. UPDATE WEBHOOK STATUS -----
    await supabase
      .from("leads")
      .update({ webhook_status: webhookStatus })
      .eq("id", leadId);

    // ----- 8. RETURN SUCCESS (no sensitive data exposed) -----
    return new Response(
      JSON.stringify({
        success: true,
        message: "הטופס נשלח בהצלחה",
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("[submit-lead] Unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "שגיאה פנימית. נסה שוב מאוחר יותר." }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }
});
