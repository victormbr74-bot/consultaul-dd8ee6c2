const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_BASE_URL = "https://api.macvendors.com";

const normalizeMac = (value: unknown) => String(value ?? "").trim().replace(/[^0-9A-Fa-f]/g, "").toUpperCase();

const formatMac = (value: string) => {
  const pairs = value.match(/.{1,2}/g);
  return (pairs || [value]).join(":");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const normalizedMac = normalizeMac(body?.mac);

    if (normalizedMac.length < 6 || normalizedMac.length > 12 || normalizedMac.length % 2 !== 0) {
      return new Response(
        JSON.stringify({
          found: false,
          status: 400,
          mac: String(body?.mac || ""),
          normalized_mac: normalizedMac,
          formatted_mac: normalizedMac ? formatMac(normalizedMac) : "",
          vendor: null,
          message: "Informe ao menos 6 caracteres hexadecimais validos.",
          source: "macvendors",
          lookup_url: normalizedMac ? `${API_BASE_URL}/${normalizedMac}` : API_BASE_URL,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const response = await fetch(`${API_BASE_URL}/${normalizedMac}`, {
      method: "GET",
      headers: { Accept: "text/plain" },
      signal: AbortSignal.timeout(15000),
    });

    if (response.status === 404) {
      return new Response(
        JSON.stringify({
          found: false,
          status: 404,
          mac: String(body?.mac || ""),
          normalized_mac: normalizedMac,
          formatted_mac: formatMac(normalizedMac),
          vendor: null,
          message: "MAC Address nao encontrado na base do MAC Vendors.",
          source: "macvendors",
          lookup_url: `${API_BASE_URL}/${normalizedMac}`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (response.status === 429) {
      return new Response(
        JSON.stringify({
          found: false,
          status: 429,
          mac: String(body?.mac || ""),
          normalized_mac: normalizedMac,
          formatted_mac: formatMac(normalizedMac),
          vendor: null,
          message: "Limite de consultas do MAC Vendors atingido. Tente novamente mais tarde.",
          source: "macvendors",
          lookup_url: `${API_BASE_URL}/${normalizedMac}`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({
          found: false,
          status: response.status,
          mac: String(body?.mac || ""),
          normalized_mac: normalizedMac,
          formatted_mac: formatMac(normalizedMac),
          vendor: null,
          message: `Servico externo retornou ${response.status}: ${errorText || "erro desconhecido"}`,
          source: "macvendors",
          lookup_url: `${API_BASE_URL}/${normalizedMac}`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const vendor = (await response.text()).trim();

    return new Response(
      JSON.stringify({
        found: true,
        status: 200,
        mac: String(body?.mac || ""),
        normalized_mac: normalizedMac,
        formatted_mac: formatMac(normalizedMac),
        vendor: vendor || null,
        message: vendor ? "Fabricante localizado com sucesso." : "Resposta recebida sem nome do fabricante.",
        source: "macvendors",
        lookup_url: `${API_BASE_URL}/${normalizedMac}`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("mac-vendor-lookup error:", error);
    return new Response(
      JSON.stringify({
        found: false,
        status: 500,
        mac: "",
        normalized_mac: "",
        formatted_mac: "",
        vendor: null,
        message: error instanceof Error ? error.message : String(error),
        source: "macvendors",
        lookup_url: API_BASE_URL,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
