import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.25.76";
import { getFirebaseAdminRole, verifyFirebaseToken } from "../_shared/firebase-auth.ts";

const BodySchema = z.object({
  idToken: z.string().min(100),
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(400),
  audience: z.enum(["all", "active", "admins"]),
  path: z.string().max(300).optional(),
});

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";
const ALLOWED_ROLES = new Set(["admin", "moderator", "staff"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { idToken, title, body, audience, path } = parsed.data;
    const identity = await verifyFirebaseToken(idToken);
    const role = await getFirebaseAdminRole(identity.uid, idToken);
    if (!role || !ALLOWED_ROLES.has(role)) return json({ error: "You cannot send push notifications" }, 403);

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const connectionKey = Deno.env.get("FIREBASE_MESSAGING_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!lovableKey || !connectionKey || !supabaseUrl || !serviceKey) {
      throw new Error("Push delivery is not fully configured");
    }

    const admin = createClient(supabaseUrl, serviceKey);
    let subscriptionsQuery = admin.from("push_subscriptions")
      .select("token, preferences").eq("enabled", true).limit(2000);
    if (audience === "admins") subscriptionsQuery = subscriptionsQuery.not("preferences->>adminRole", "is", null);
    const { data: subscriptions, error } = await subscriptionsQuery;
    if (error) throw error;

    const safePath = path?.startsWith("/") ? path : "/dashboard";
    let delivered = 0;
    let failed = 0;
    const staleTokens: string[] = [];
    const headers = {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectionKey,
      "Content-Type": "application/json",
    };

    for (let index = 0; index < (subscriptions ?? []).length; index += 20) {
      const batch = (subscriptions ?? []).slice(index, index + 20);
      const results = await Promise.all(batch.map(async ({ token }) => {
        const response = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            message: {
              token,
              notification: { title, body },
              data: { path: safePath },
              webpush: { fcm_options: { link: safePath } },
            },
          }),
        });
        if (response.ok) return { ok: true, token };
        const details = await response.text();
        console.error(`FCM send failed [${response.status}]: ${details}`);
        return { ok: false, token, stale: response.status === 404 || (response.status === 400 && /UNREGISTERED|INVALID_ARGUMENT/i.test(details)) };
      }));
      for (const result of results) {
        if (result.ok) delivered += 1;
        else {
          failed += 1;
          if (result.stale) staleTokens.push(result.token);
        }
      }
    }

    if (staleTokens.length) await admin.from("push_subscriptions").delete().in("token", staleTokens);
    return json({ ok: true, delivered, failed, recipients: subscriptions?.length ?? 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Push delivery failed";
    console.error(message);
    return json({ error: message }, 500);
  }
});