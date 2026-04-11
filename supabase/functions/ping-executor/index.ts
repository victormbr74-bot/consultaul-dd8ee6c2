const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const PING_EXECUTOR_URL = Deno.env.get("PING_EXECUTOR_URL") || "";
const PING_EXECUTOR_API_KEY = Deno.env.get("PING_EXECUTOR_API_KEY") || "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Auth check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  // Expected: /ping-executor or /ping-executor/run or /ping-executor/history or /ping-executor/status/:id
  const action = pathParts[1] || "";

  try {
    if (req.method === "POST" && (action === "run" || action === "")) {
      // POST /ping-executor/run - Execute ping
      const body = await req.json();
      const { tipo_teste, host_alvo } = body;

      if (!tipo_teste || !host_alvo) {
        return new Response(
          JSON.stringify({ error: "tipo_teste e host_alvo são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!PING_EXECUTOR_URL) {
        return new Response(
          JSON.stringify({ error: "Servidor de execução de ping não configurado. Configure PING_EXECUTOR_URL." }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Forward to external server
      const response = await fetch(`${PING_EXECUTOR_URL}/api/ping/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(PING_EXECUTOR_API_KEY ? { "x-api-key": PING_EXECUTOR_API_KEY } : {}),
        },
        body: JSON.stringify({ tipo_teste, host_alvo }),
      });

      const result = await response.json();

      // Save to ping_automation_results
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      await supabaseAdmin.from("ping_automation_results").insert({
        input_term: host_alvo,
        page_type: tipo_teste,
        target: host_alvo,
        source: "internal-executor",
        status: result.status_final || "ERRO",
        raw_log: result.resultado_bruto || "",
        summary_json: {
          perda_percentual: result.perda_percentual,
          tempo_medio: result.tempo_medio,
          etapa_que_falhou: result.etapa_que_falhou,
          etapas: result.etapas || [],
          provider: result.provider,
        },
        ips: [host_alvo],
        created_by: user.id,
      });

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET" && action === "history") {
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);
      const pageType = url.searchParams.get("page_type") || "";

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      let query = supabaseAdmin
        .from("ping_automation_results")
        .select("*")
        .eq("source", "internal-executor")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (pageType) {
        query = query.eq("page_type", pageType);
      }

      const { data, error: dbError } = await query;
      if (dbError) throw dbError;

      return new Response(JSON.stringify(data || []), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET" && action === "status") {
      const id = pathParts[2] || "";
      if (!id) {
        return new Response(JSON.stringify({ error: "ID obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      const { data, error: dbError } = await supabaseAdmin
        .from("ping_automation_results")
        .select("*")
        .eq("id", id)
        .single();

      if (dbError || !data) {
        return new Response(JSON.stringify({ error: "Não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET" && action === "health") {
      // Check external server health
      let serverHealth = null;
      if (PING_EXECUTOR_URL) {
        try {
          const resp = await fetch(`${PING_EXECUTOR_URL}/api/ping/health`, {
            headers: PING_EXECUTOR_API_KEY ? { "x-api-key": PING_EXECUTOR_API_KEY } : {},
          });
          serverHealth = await resp.json();
        } catch (e) {
          serverHealth = { error: e.message };
        }
      }

      return new Response(
        JSON.stringify({
          status: "ok",
          executor_configured: !!PING_EXECUTOR_URL,
          server_health: serverHealth,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Rota não encontrada" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
