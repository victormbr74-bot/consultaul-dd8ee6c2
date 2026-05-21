// Edge function: envia dados resumidos de uma UL para o webhook do Jirayab (n8n).
// Disparada pelo frontend após alterações aprovadas / edições diretas.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  cod_ul?: string;
  event?: string; // ex: "update", "approved_change", "manual"
  source?: string;
  extra?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "unauthorized" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsError } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsError || !claims?.claims?.sub) {
      return json({ error: "unauthorized" }, 401);
    }

    const body = (await req.json().catch(() => ({}))) as Payload;
    const codUl = String(body.cod_ul || "").trim();
    if (!codUl) return json({ error: "cod_ul é obrigatório" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE);

    // URL configurada pelo admin em app_settings.value_text (key=jirayab_webhook_url)
    const { data: setting } = await admin
      .from("app_settings")
      .select("value_text, value_boolean")
      .eq("key", "jirayab_webhook_url")
      .maybeSingle();

    const webhookUrl = String((setting as any)?.value_text || "").trim();
    if (!webhookUrl) {
      return json({ ok: false, skipped: true, reason: "webhook não configurado" }, 200);
    }
    if ((setting as any)?.value_boolean === false) {
      return json({ ok: false, skipped: true, reason: "webhook desabilitado" }, 200);
    }

    const { data: row, error: rowError } = await admin
      .from("lotericas")
      .select(
        "cod_ul,nome_loterica,cidade,uf,ccto_oi,ccto_oemp,designacao_nova,ip_nat,ip_wan,loopback_wan,loopback_lan,operadora,status,contato,endereco,raw_data,updated_at",
      )
      .eq("cod_ul", codUl)
      .maybeSingle();
    if (rowError) return json({ error: rowError.message }, 500);
    if (!row) return json({ error: "unidade não encontrada" }, 404);

    const raw = (row as any).raw_data && typeof (row as any).raw_data === "object"
      ? ((row as any).raw_data as Record<string, unknown>)
      : {};
    const pick = (...keys: string[]) => {
      for (const k of keys) {
        const v = raw[k];
        if (v !== undefined && v !== null && String(v).trim()) return String(v).trim();
      }
      return "";
    };

    const payload = {
      event: body.event || "update",
      source: body.source || "consulta-ul",
      timestamp: new Date().toISOString(),
      user_id: claims.claims.sub,
      unidade: {
        cod_ul: row.cod_ul,
        nome: row.nome_loterica,
        cidade: row.cidade,
        uf: row.uf,
        endereco: row.endereco,
        contato: row.contato,
        status: row.status,
        operadora: row.operadora,
        tecnologia: pick("TECNOLOGIA", "tecnologia", "Tecnologia"),
        ccto_oi: row.ccto_oi,
        ccto_oemp: row.ccto_oemp,
        designacao_nova: row.designacao_nova,
        ip_nat: row.ip_nat,
        ip_wan: row.ip_wan,
        loopback_primario: row.loopback_wan,
        loopback_secundario: row.loopback_lan,
        updated_at: row.updated_at,
      },
      extra: body.extra ?? null,
    };

    const resp = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await resp.text().catch(() => "");

    return json({ ok: resp.ok, status: resp.status, response: text.slice(0, 500) }, 200);
  } catch (e) {
    console.error("notify-jirayab error", e);
    return json({ error: e instanceof Error ? e.message : "erro desconhecido" }, 500);
  }
});

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
