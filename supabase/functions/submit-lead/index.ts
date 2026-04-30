import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const RATE_LIMIT_MS = 5 * 60 * 1000;

serve(async (req: Request) => {
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

    // ----- 1. HONEYPOT -----
    if (body.company && body.company.trim().length > 0) {
      console.warn("[submit-lead] Honeypot triggered");
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // ----- 2. EXTRACT & VALIDATE -----
    const phone = (body.phone || "").trim();
    const name = (body.name || "").trim();
    const email = (body.email || "").trim() || null;
    const vertical = body.vertical || "כללי";
    const categorySlug = body.category_slug || "general";
    const quizId = body.quiz_id || null;
    const answers = body.answers || {};
    const sourceUrl = body.source_url || null;
    const articleSlug = body.article_slug || null;
    const utmSource = body.utm_source || null;
    const utmCampaign = body.utm_campaign || null;

    if (!name || name.length < 2) {
      return new Response(JSON.stringify({ error: "שם מלא הוא שדה חובה" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    const phoneNormalized = phone.replace(/[\s-]/g, "");
    if (!phone || phoneNormalized.length < 9) {
      return new Response(JSON.stringify({ error: "מספר טלפון אינו תקין" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // ----- 3. RATE LIMIT -----
    const rateLimitCutoff = new Date(Date.now() - RATE_LIMIT_MS).toISOString();
    const { data: recentLeads } = await supabase
      .from("leads").select("id").eq("phone", phone).gte("created_at", rateLimitCutoff).limit(1);

    if (recentLeads && recentLeads.length > 0) {
      return new Response(JSON.stringify({ error: "הבקשה כבר נשלחה. נציג יחזור אליך בהקדם." }), {
        status: 429,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // ----- 4. INSERT LEAD -----
    const { data: insertedLead, error: insertError } = await supabase
      .from("leads")
      .insert({
        vertical, category_slug: categorySlug, name, phone, email, answers,
        source_url: sourceUrl, article_slug: articleSlug,
        utm_source: utmSource, utm_campaign: utmCampaign,
        status: "new", webhook_status: "pending", affiliate_status: "pending",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[submit-lead] Insert error:", insertError);
      return new Response(JSON.stringify({ error: "שגיאה בשליחת הטופס. נסה שוב." }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const leadId = insertedLead.id;
    console.log(`[submit-lead] Lead ${leadId} saved`);

    // ----- 5. LOAD QUIZ CONFIG (for affiliate_config + webhook_url) -----
    // Prefer lookup by quiz_id (when quiz was opened by ID), fall back to category_slug
    let quizConfig: { webhook_url?: string; affiliate_config?: any } | null = null;
    if (quizId) {
      const { data } = await supabase
        .from("quiz_configs")
        .select("webhook_url, affiliate_config")
        .eq("id", quizId)
        .eq("is_active", true)
        .single();
      quizConfig = data;
    }
    if (!quizConfig) {
      const { data } = await supabase
        .from("quiz_configs")
        .select("webhook_url, affiliate_config")
        .eq("category_slug", categorySlug)
        .eq("is_active", true)
        .single();
      quizConfig = data;
    }

    // ----- 6. PER-QUIZ AFFILIATE API -----
    let affiliateStatus = "no_config";

    const affiliateCfg = quizConfig?.affiliate_config;
    if (affiliateCfg?.enabled && affiliateCfg?.url) {
      try {
        // Build payload using field_mapping: { theirField: ourField }
        const mapping: Record<string, string> = affiliateCfg.field_mapping || {};
        const ourData: Record<string, string | null> = {
          name, phone, email, vertical, category_slug: categorySlug,
          article_slug: articleSlug, utm_source: utmSource, utm_campaign: utmCampaign,
          source_url: sourceUrl, lead_id: leadId,
        };

        const affiliatePayload: Record<string, string | null> = {};
        if (Object.keys(mapping).length > 0) {
          for (const [theirField, ourField] of Object.entries(mapping)) {
            affiliatePayload[theirField] = ourData[ourField] ?? null;
          }
        } else {
          // No mapping defined — send our standard fields
          Object.assign(affiliatePayload, ourData);
        }

        // Merge any static fields (e.g. public_key_token, camp_id, emedia, eid)
        const staticFields: Record<string, string> = affiliateCfg.static_fields || {};
        for (const [k, v] of Object.entries(staticFields)) {
          affiliatePayload[k] = v;
        }

        // Determine content type: "form" for x-www-form-urlencoded, default JSON
        const useForm = affiliateCfg.content_type === "form";
        const affiliateHeaders: Record<string, string> = {
          "Content-Type": useForm
            ? "application/x-www-form-urlencoded"
            : "application/json",
        };
        if (affiliateCfg.auth_header) {
          affiliateHeaders["Authorization"] = affiliateCfg.auth_header;
        }

        let affiliateBody: string;
        if (useForm) {
          const params = new URLSearchParams();
          for (const [k, v] of Object.entries(affiliatePayload)) {
            if (v !== null && v !== undefined) params.append(k, String(v));
          }
          affiliateBody = params.toString();
        } else {
          affiliateBody = JSON.stringify(affiliatePayload);
        }

        const affiliateRes = await fetch(affiliateCfg.url, {
          method: affiliateCfg.method || "POST",
          headers: affiliateHeaders,
          body: affiliateBody,
        });

        const affiliateRespText = await affiliateRes.text().catch(() => "");
        affiliateStatus = affiliateRes.ok ? "sent" : `failed_${affiliateRes.status}`;
        console.log(`[submit-lead] Affiliate dispatch: ${affiliateStatus} for lead ${leadId}. Response: ${affiliateRespText.slice(0, 200)}`);
      } catch (e) {
        affiliateStatus = "error";
        console.error(`[submit-lead] Affiliate dispatch error for lead ${leadId}:`, e);
      }
    } else {
      // Fallback: global AFFILIATE_WEBHOOK_URL env var
      const globalAffiliateUrl = Deno.env.get("AFFILIATE_WEBHOOK_URL");
      if (globalAffiliateUrl) {
        fetch(globalAffiliateUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, phone, category_slug: categorySlug, utm_source: utmSource }),
        }).then(r => {
          console.log(`[submit-lead] Global affiliate dispatch: HTTP ${r.status}`);
        }).catch(e => {
          console.error(`[submit-lead] Global affiliate dispatch failed:`, e);
        });
        affiliateStatus = "dispatched_global";
      }
    }

    // ----- 7. LEGACY WEBHOOK -----
    let webhookStatus = "no_webhook";
    if (quizConfig?.webhook_url) {
      try {
        const webhookRes = await fetch(quizConfig.webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lead_id: leadId, name, phone, email, vertical, category_slug: categorySlug,
            answers, source_url: sourceUrl, article_slug: articleSlug,
            utm_source: utmSource, utm_campaign: utmCampaign,
            timestamp: new Date().toISOString(),
          }),
        });
        webhookStatus = webhookRes.ok ? "sent" : "failed";
        console.log(`[submit-lead] Webhook: ${webhookStatus} for lead ${leadId}`);
      } catch {
        webhookStatus = "failed";
      }
    }

    // ----- 8. UPDATE STATUSES -----
    await supabase
      .from("leads")
      .update({ webhook_status: webhookStatus, affiliate_status: affiliateStatus })
      .eq("id", leadId);

    // ----- 9. SUCCESS -----
    return new Response(JSON.stringify({ success: true, message: "הטופס נשלח בהצלחה" }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[submit-lead] Unhandled error:", err);
    return new Response(JSON.stringify({ error: "שגיאה פנימית. נסה שוב מאוחר יותר." }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
