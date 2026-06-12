import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DATA_URL =
  "https://consultaul.lovable.app/__l5e/assets-v1/18dc291f-f288-4b7a-8848-ae5c36d3d6b8/principal-data.json";

interface PrincipalRow {
  ccto_oi: string | null;
  loopback_wan: string | null;
  modelo: string | null;
  ip99: string | null;
  ipsw: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `fetch failed: ${res.status}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = (await res.json()) as Record<string, PrincipalRow>;
    const entries = Object.entries(data);

    let processed = 0;
    let updated = 0;
    let errors = 0;
    const BATCH = 400;

    for (let i = 0; i < entries.length; i += BATCH) {
      const slice = entries.slice(i, i + BATCH);
      const values = slice
        .map(([cod, r]) => {
          const esc = (v: string | null) =>
            v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`;
          return `(${esc(cod)},${esc(r.ccto_oi)},${esc(r.loopback_wan)},${esc(r.modelo)},${esc(r.ip99)},${esc(r.ipsw)})`;
        })
        .join(",");

      const sql = `
        UPDATE public.lotericas l SET
          ccto_oi = COALESCE(t.ccto_oi, l.ccto_oi),
          loopback_wan = COALESCE(t.loopback_wan, l.loopback_wan),
          raw_data = l.raw_data
            || jsonb_build_object('MODELO ROTEADOR',
                CASE
                  WHEN t.modelo IS NULL THEN l.raw_data->>'MODELO ROTEADOR'
                  WHEN (l.raw_data->>'MODELO ROTEADOR') ILIKE '%/ SCT %'
                    THEN t.modelo || ' / SCT ' || split_part(l.raw_data->>'MODELO ROTEADOR',' / SCT ',2)
                  ELSE t.modelo
                END)
            || jsonb_build_object('REDE LAN', COALESCE(t.ip99, l.raw_data->>'REDE LAN'))
            || jsonb_build_object('IP SWITCH', COALESCE(t.ipsw, l.raw_data->>'IP SWITCH')),
          updated_at = now()
        FROM (VALUES ${values}) AS t(cod_ul, ccto_oi, loopback_wan, modelo, ip99, ipsw)
        WHERE l.cod_ul = t.cod_ul
        RETURNING l.cod_ul;
      `;

      const { data: rows, error } = await supabase.rpc("exec_sql_returning", { p_sql: sql });
      if (error) {
        // Fallback: try via direct query through PostgREST is not available;
        // Use a per-row upsert as last resort
        console.error("rpc error", error);
        errors += slice.length;
      } else {
        updated += Array.isArray(rows) ? rows.length : 0;
      }
      processed += slice.length;
    }

    return new Response(JSON.stringify({ processed, updated, errors, total: entries.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
