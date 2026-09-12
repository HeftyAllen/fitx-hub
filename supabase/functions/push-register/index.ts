import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.25.76";
import { getFirebaseAdminRole, verifyFirebaseToken } from "../_shared/firebase-auth.ts";

const BodySchema = z.object({
  idToken: z.string().min(100),
  action: z.enum(["register", "unregister", "preferences"]),
  token: z.string().min(20).max(4096),
  preferences: z.record(z.boolean()).optional(),
});

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

    const { idToken, action, token, preferences = {} } = parsed.data;
    const identity = await verifyFirebaseToken(idToken);
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) throw new Error("Push storage is not configured");
    const admin = createClient(supabaseUrl, serviceKey);

    if (action === "unregister") {
      const { error } = await admin.from("push_subscriptions").delete()
        .eq("firebase_uid", identity.uid).eq("token", token);
      if (error) throw error;
      return json({ ok: true, enabled: false });
    }

    const role = await getFirebaseAdminRole(identity.uid, idToken).catch(() => null);
    const safePreferences = {
      workoutReminders: preferences.workoutReminders !== false,
      challengeAlerts: preferences.challengeAlerts !== false,
      progressUpdates: preferences.progressUpdates !== false,
      weeklyReport: preferences.weeklyReport === true,
      adminRole: role,
    };
    const { error } = await admin.from("push_subscriptions").upsert({
      firebase_uid: identity.uid,
      token,
      platform: "web",
      enabled: true,
      preferences: safePreferences,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: "token" });
    if (error) throw error;
    return json({ ok: true, enabled: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Push registration failed";
    const unauthorized = /token|jwt|signature|issuer|audience/i.test(message);
    return json({ error: unauthorized ? "Your session could not be verified" : message }, unauthorized ? 401 : 500);
  }
});