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
    const errors: string[] = [];
    const BATCH = 500;

    for (let i = 0; i < entries.length; i += BATCH) {
      const slice = entries.slice(i, i + BATCH);
      const payload = slice.map(([cod_ul, r]) => ({
        cod_ul,
        ccto_oi: r.ccto_oi,
        loopback_wan: r.loopback_wan,
        modelo: r.modelo,
        ip99: r.ip99,
        ipsw: r.ipsw,
      }));

      const { data: affected, error } = await supabase.rpc("apply_principal_updates", {
        payload,
      });

      if (error) {
        errors.push(`batch ${i}: ${error.message}`);
      } else {
        updated += Number(affected ?? 0);
      }
      processed += slice.length;
    }

    return new Response(
      JSON.stringify({ processed, updated, errorsCount: errors.length, errors: errors.slice(0, 5) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
