import { corsHeaders } from "@supabase/supabase-js/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth validation
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userId = claimsData.claims.sub;

    // Parse and validate body
    const body = await req.json();
    const { tipo_teste, host_alvo, tacacs_username, tacacs_password, packet_count } = body;

    if (!tipo_teste || !host_alvo || !tacacs_username || !tacacs_password) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatorios: tipo_teste, host_alvo, tacacs_username, tacacs_password" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Forward to external ping executor
    const executorUrl = Deno.env.get("PING_EXECUTOR_URL");
    const executorApiKey = Deno.env.get("PING_EXECUTOR_API_KEY");

    if (!executorUrl) {
      return new Response(
        JSON.stringify({
          success: false,
          provider: "internal",
          status_final: "ERRO DE EXECUCAO",
          resultado_bruto: "Servidor de execucao de ping nao configurado (PING_EXECUTOR_URL).",
          perda_percentual: null,
          tempo_medio: null,
          etapa_que_falhou: "configuracao",
          packets_sent: null,
          packets_received: null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const executorResponse = await fetch(`${executorUrl}/api/ping/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(executorApiKey ? { "x-api-key": executorApiKey } : {}),
      },
      body: JSON.stringify({
        tipo_teste,
        host_alvo,
        tacacs_username,
        tacacs_password,
        packet_count: packet_count ?? 2,
      }),
      signal: AbortSignal.timeout(90_000),
    });

    let result;
    if (executorResponse.ok) {
      result = await executorResponse.json();
    } else {
      const errText = await executorResponse.text();
      result = {
        success: false,
        provider: "internal",
        status_final: "ERRO DE EXECUCAO",
        resultado_bruto: `Servidor retornou ${executorResponse.status}: ${errText}`,
        perda_percentual: null,
        tempo_medio: null,
        etapa_que_falhou: "servidor_externo",
        packets_sent: null,
        packets_received: null,
      };
    }

    // Save to history
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    await adminClient.from("ping_automation_results").insert({
      input_term: host_alvo,
      page_type: tipo_teste,
      source: "backend",
      status: result.status_final ?? "ERRO DE EXECUCAO",
      raw_log: result.resultado_bruto ?? "",
      summary_json: result,
      ips: [host_alvo],
      created_by: userId,
    });

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("ping-executor error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        provider: "internal",
        status_final: "ERRO DE EXECUCAO",
        resultado_bruto: String(err),
        perda_percentual: null,
        tempo_medio: null,
        etapa_que_falhou: "proxy",
        packets_sent: null,
        packets_received: null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
