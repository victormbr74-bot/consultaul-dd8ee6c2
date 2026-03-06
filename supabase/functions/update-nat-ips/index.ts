import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NatRow {
  designation: string;
  ip_nat: string | null;
  ip_wan: string | null;
  ip_lan: string | null;
  cidade: string | null;
  uf: string | null;
}

interface RequestBody {
  rows: NatRow[];
  chunkIndex?: number;
  chunkCount?: number;
}

function normalizeIpCommas(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim().replace(/,/g, ".");
  if (!text) return null;
  const match = text.match(/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})/);
  if (!match) return null;
  return match.slice(1, 5).map((p) => parseInt(p, 10)).join(".");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  const body = (await req.json()) as RequestBody;
  const rows = body.rows;

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return new Response(JSON.stringify({ error: "No rows provided" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  try {
    // Collect all unique designations from the input
    const designations = rows
      .map((r) => r.designation?.trim())
      .filter(Boolean) as string[];

    if (designations.length === 0) {
      return new Response(
        JSON.stringify({ updated: 0, inserted: 0, not_matched: 0, errors: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Also create variants without spaces for matching
    const allVariants = new Set<string>();
    for (const d of designations) {
      allVariants.add(d);
      allVariants.add(d.replace(/\s+/g, ""));
    }

    // Fetch existing lotericas matching by ccto_oi or designacao_nova
    const variantsList = Array.from(allVariants);
    const matchedByOi = new Map<string, string>(); // normalized designation -> cod_ul
    const matchedByDesig = new Map<string, string>();

    // Query in batches of 500
    const BATCH = 500;
    for (let i = 0; i < variantsList.length; i += BATCH) {
      const chunk = variantsList.slice(i, i + BATCH);

      const [resOi, resDesig] = await Promise.all([
        supabase
          .from("lotericas")
          .select("cod_ul,ccto_oi")
          .in("ccto_oi", chunk),
        supabase
          .from("lotericas")
          .select("cod_ul,designacao_nova")
          .in("designacao_nova", chunk),
      ]);

      if (resOi.data) {
        for (const row of resOi.data) {
          if (row.ccto_oi) {
            matchedByOi.set(row.ccto_oi.trim().toUpperCase(), row.cod_ul);
            matchedByOi.set(
              row.ccto_oi.trim().replace(/\s+/g, "").toUpperCase(),
              row.cod_ul,
            );
          }
        }
      }
      if (resDesig.data) {
        for (const row of resDesig.data) {
          if (row.designacao_nova) {
            matchedByDesig.set(
              row.designacao_nova.trim().toUpperCase(),
              row.cod_ul,
            );
            matchedByDesig.set(
              row.designacao_nova.trim().replace(/\s+/g, "").toUpperCase(),
              row.cod_ul,
            );
          }
        }
      }
    }

    let updated = 0;
    let inserted = 0;
    let notMatched = 0;
    let errors = 0;

    // Process rows: update existing or insert new
    const updateBatch: { cod_ul: string; ip_nat: string | null; ip_wan: string | null }[] = [];
    const insertBatch: Record<string, unknown>[] = [];

    for (const row of rows) {
      const desig = row.designation?.trim();
      if (!desig) continue;

      const upper = desig.toUpperCase();
      const upperNoSpace = desig.replace(/\s+/g, "").toUpperCase();

      const codUl =
        matchedByOi.get(upper) ||
        matchedByOi.get(upperNoSpace) ||
        matchedByDesig.get(upper) ||
        matchedByDesig.get(upperNoSpace);

      const ipNat = normalizeIpCommas(row.ip_nat);
      const ipWan = normalizeIpCommas(row.ip_wan);

      if (codUl) {
        // Update existing record
        updateBatch.push({ cod_ul: codUl, ip_nat: ipNat, ip_wan: ipWan });
      } else {
        // Insert new record using designation as cod_ul
        insertBatch.push({
          cod_ul: desig.replace(/\s+/g, ""),
          ccto_oi: desig,
          designacao_nova: desig,
          ip_nat: ipNat,
          ip_wan: ipWan,
          cidade: row.cidade?.trim() || null,
          uf: row.uf?.trim() || null,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        });
      }
    }

    // Execute updates in batches
    for (let i = 0; i < updateBatch.length; i += 50) {
      const batch = updateBatch.slice(i, i + 50);
      for (const item of batch) {
        const updateData: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        };
        if (item.ip_nat !== null) updateData.ip_nat = item.ip_nat;
        if (item.ip_wan !== null) updateData.ip_wan = item.ip_wan;

        const { error } = await supabase
          .from("lotericas")
          .update(updateData)
          .eq("cod_ul", item.cod_ul);

        if (error) {
          console.error(`Update error for ${item.cod_ul}:`, error);
          errors++;
        } else {
          updated++;
        }
      }
    }

    // Execute inserts in batches
    for (let i = 0; i < insertBatch.length; i += 200) {
      const batch = insertBatch.slice(i, i + 200);
      const { error } = await supabase
        .from("lotericas")
        .upsert(batch, { onConflict: "cod_ul" });

      if (error) {
        console.error("Insert batch error:", error);
        errors += batch.length;
      } else {
        inserted += batch.length;
      }
    }

    notMatched = insertBatch.length;

    return new Response(
      JSON.stringify({
        updated,
        inserted,
        not_matched: notMatched,
        errors,
        total: rows.length,
        chunkIndex: body.chunkIndex ?? 0,
        chunkCount: body.chunkCount ?? 1,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
