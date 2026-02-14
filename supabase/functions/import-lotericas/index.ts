import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Verify auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const body = await req.json();
  const rows = body.rows as any[];

  if (!rows || !Array.isArray(rows)) {
    return new Response(JSON.stringify({ error: "Invalid data" }), { status: 400, headers: corsHeaders });
  }

  let inserted = 0;
  let errors = 0;
  const batchSize = 100;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize).map((row: any) => ({
      cod_ul: String(row["cod_ul"] || "").trim(),
      nome_loterica: row["NOME UL"] || row["nome_loterica"] || "",
      ccto_oi: row["CCTO OI"] || row["ccto_oi"] || "",
      ccto_oemp: row["CCTO OEMP"] || row["ccto_oemp"] || "",
      operadora: row["OPERADORA 4G"] || row["operadora"] || "",
      ip_nat: row["IP NAT"] || row["ip_nat"] || "",
      ip_wan: row["IP WAN"] || row["ip_wan"] || "",
      loopback_wan: row["LOOPBACK PRINCIPAL"] || row["loopback_wan"] || "",
      // BUGFIX: "Loopback secundario" was mistakenly mapped from "REDE LAN".
      // Keep "REDE LAN" only in raw_data; map loopback_lan from the proper column.
      loopback_lan: row["LOOPBACK SECUNDARIO"] || row["LOOPBACK SECUND?RIO"] || row["loopback_lan"] || "",
      endereco: row["ENDEREÇO"] || row["endereco"] || "",
      contato: row["CONTATO"] || row["contato"] || "",
      status: row["STATUS UL"] || row["status"] || "",
      cidade: row["MUNICIPIO"] || row["cidade"] || "",
      uf: row["UF"] || row["uf"] || "",
      designacao_nova: row["DESIGINACAO NOVA"] || row["designacao_nova"] || "",
      raw_data: row,
      updated_by: user.id,
    })).filter((r: any) => r.cod_ul);

    const { error } = await supabase.from("lotericas").upsert(batch, { onConflict: "cod_ul" });
    if (error) {
      console.error("Batch error:", error);
      errors += batch.length;
    } else {
      inserted += batch.length;
    }
  }

  return new Response(JSON.stringify({ inserted, errors, total: rows.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
