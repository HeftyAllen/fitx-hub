// FatSecret OAuth2 proxy. Holds the client_credentials token in memory
// across warm invocations and exposes a tiny REST surface the frontend uses:
//   POST /fatsecret { action: "search", query, page? }
//   POST /fatsecret { action: "barcode", barcode }
//   POST /fatsecret { action: "food", food_id }
//   POST /fatsecret { action: "autocomplete", query }
//
// All upstream calls go through https://platform.fatsecret.com/rest/server.api

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const CLIENT_ID = Deno.env.get("FATSECRET_CLIENT_ID");
const CLIENT_SECRET = Deno.env.get("FATSECRET_CLIENT_SECRET");
const TOKEN_URL = "https://oauth.fatsecret.com/connect/token";
const API_URL = "https://platform.fatsecret.com/rest/server.api";

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("FatSecret credentials are not configured");
  }
  const basic = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
  const body = new URLSearchParams({ grant_type: "client_credentials", scope: "basic" });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token request failed: ${res.status} ${text}`);
  }
  const json = await res.json();
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return cachedToken.value;
}

async function callApi(params: Record<string, string>) {
  const token = await getAccessToken();
  const search = new URLSearchParams({ ...params, format: "json" });
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: search,
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    throw new Error(`FatSecret ${res.status}: ${text.slice(0, 200)}`);
  }
  // FatSecret returns 200 OK with an error object on API-level failures.
  if (data && typeof data === "object" && data.error && (data.error.message || data.error.code)) {
    const code = data.error.code;
    const msg = String(data.error.message || "FatSecret error");
    if (code === 21 || /invalid ip/i.test(msg)) {
      throw new Error(
        "FatSecret rejected our server IP. Disable IP restrictions in your FatSecret Platform account (Manage IPs → allow all)."
      );
    }
    throw new Error(`FatSecret error ${code ?? ""}: ${msg}`.trim());
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "").trim();

    let data: unknown;
    switch (action) {
      case "search": {
        const query = String(body.query || "").trim();
        if (!query) throw new Error("query is required");
        const page = Number(body.page ?? 0);
        const max = Math.min(Number(body.max ?? 25), 50);
        data = await callApi({
          method: "foods.search",
          search_expression: query,
          page_number: String(page),
          max_results: String(max),
        });
        break;
      }
      case "autocomplete": {
        const query = String(body.query || "").trim();
        if (!query) throw new Error("query is required");
        data = await callApi({ method: "foods.autocomplete", expression: query, max_results: "8" });
        break;
      }
      case "barcode": {
        const barcode = String(body.barcode || "").trim();
        if (!barcode) throw new Error("barcode is required");
        // GTIN-13 required by API. Pad UPC-A (12) with leading zero.
        const gtin = barcode.length === 12 ? `0${barcode}` : barcode;
        const idRes: any = await callApi({ method: "food.find_id_for_barcode", barcode: gtin });
        const foodId = idRes?.food_id?.value || idRes?.food_id;
        if (!foodId || foodId === "0") {
          data = { found: false };
        } else {
          const food = await callApi({ method: "food.get.v4", food_id: String(foodId) });
          data = { found: true, food };
        }
        break;
      }
      case "food": {
        const foodId = String(body.food_id || "").trim();
        if (!foodId) throw new Error("food_id is required");
        data = await callApi({ method: "food.get.v4", food_id: foodId });
        break;
      }
      default:
        throw new Error(`Unknown action: ${action || "(empty)"}`);
    }

    return new Response(JSON.stringify({ ok: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
