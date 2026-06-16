import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Loader2, PencilLine, Plus, Save, Search, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { parseKnowledgeBaseFile, type KnowledgeBaseRow } from "@/lib/knowledgeBase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const emptyForm = {
  title: "",
  category: "",
  tags: "",
  content: "",
};

const normalize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const parseTags = (value: string) =>
  Array.from(
    new Set(
      value
        .split(/[,;\n]+/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );

const KnowledgeBase = () => {
  const { user, isAdmin } = useAuth();
  const [rows, setRows] = useState<KnowledgeBaseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("knowledge_base")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1000);
    setLoading(false);

    if (error) {
      toast.error("Falha ao carregar base de conhecimento", { description: String(error.message || error) });
      setRows([]);
      return;
    }

    setRows((data as KnowledgeBaseRow[]) || []);
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const filteredRows = useMemo(() => {
    const term = normalize(query);
    if (!term) return rows;

    return rows.filter((row) => {
      const haystack = normalize([row.title, row.category, row.content, ...(row.tags || [])].join(" "));
      return haystack.includes(term);
    });
  }, [query, rows]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const saveProcedure = async () => {
    if (!user?.id) {
      toast.error("Sessao expirada.");
      return;
    }

    const title = form.title.trim();
    const content = form.content.trim();
    if (!title || !content) {
      toast.error("Preencha titulo e procedimento.");
      return;
    }

    const payload = {
      title,
      category: form.category.trim() || null,
      content,
      tags: parseTags(form.tags),
      updated_at: new Date().toISOString(),
    };

    setSaving(true);
    const request = editingId
      ? (supabase as any).from("knowledge_base").update(payload).eq("id", editingId)
      : (supabase as any)
          .from("knowledge_base")
          .insert({ ...payload, created_by: user.id } as any);

    const { error } = await request;
    setSaving(false);

    if (error) {
      toast.error("Falha ao salvar procedimento", { description: String(error.message || error) });
      return;
    }

    toast.success(editingId ? "Procedimento atualizado" : "Procedimento cadastrado");
    resetForm();
    void loadRows();
  };

  const startEdit = (row: KnowledgeBaseRow) => {
    setEditingId(row.id);
    setForm({
      title: row.title || "",
      category: row.category || "",
      tags: (row.tags || []).join(", "),
      content: row.content || "",
    });
  };

  const deleteProcedure = async (row: KnowledgeBaseRow) => {
    if (!isAdmin && row.created_by !== user?.id) {
      toast.error("Sem permissao para excluir este procedimento.");
      return;
    }

    if (!window.confirm(`Excluir o procedimento "${row.title}"?`)) return;

    setDeletingId(row.id);
    const { error } = await (supabase as any).from("knowledge_base").delete().eq("id", row.id);
    setDeletingId(null);

    if (error) {
      toast.error("Falha ao excluir procedimento", { description: String(error.message || error) });
      return;
    }

    toast.success("Procedimento excluido");
    if (editingId === row.id) resetForm();
    setRows((current) => current.filter((item) => item.id !== row.id));
  };

  const importProcedures = async (file: File) => {
    if (!user?.id) {
      toast.error("Sessao expirada.");
      return;
    }

    setImporting(true);
    try {
      const items = await parseKnowledgeBaseFile(file);
      if (!items.length) {
        toast.error("Nenhum procedimento valido encontrado.", {
          description: "Confira se o arquivo segue o modelo XLSX/DOCX.",
        });
        return;
      }

      const now = new Date().toISOString();
      const payload = items.map((item) => ({
        title: item.title,
        category: item.category,
        tags: item.tags,
        content: item.content,
        created_by: user.id,
        updated_at: now,
      }));

      const { error } = await (supabase as any).from("knowledge_base").insert(payload);
      if (error) throw error;

      toast.success(`${payload.length} procedimento(s) importado(s).`);
      void loadRows();
    } catch (error) {
      toast.error("Falha ao importar base", { description: String((error as Error).message || error) });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="container px-4 py-6 space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Plus className="h-5 w-5" />
            {editingId ? "Editar Procedimento" : "Novo Procedimento"}
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href="/templates/base_conhecimento_modelo.xlsx" download>
                <Download className="h-4 w-4" />
                Modelo XLSX
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="/templates/base_conhecimento_modelo.docx" download>
                <Download className="h-4 w-4" />
                Modelo DOCX
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Importar base
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.docx"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importProcedures(file);
              }}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_220px_260px]">
            <div className="space-y-1.5">
              <Label>Titulo</Label>
              <Input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Ex.: Reset de senha do roteador"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Input
                value={form.category}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                placeholder="Ex.: Roteador"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tags</Label>
              <Input
                value={form.tags}
                onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
                placeholder="acesso, senha, backup"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Procedimento</Label>
            <Textarea
              value={form.content}
              onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
              rows={8}
              className="font-mono text-xs"
              placeholder="Descreva os passos do procedimento..."
            />
          </div>

          <div className="flex justify-end gap-2">
            {editingId ? (
              <Button variant="outline" onClick={resetForm} disabled={saving}>
                <X className="h-4 w-4" />
                Cancelar
              </Button>
            ) : null}
            <Button onClick={() => void saveProcedure()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editingId ? "Atualizar" : "Cadastrar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="text-lg">Base de Conhecimento</CardTitle>
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar procedimento..."
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Total: {rows.length}</Badge>
                <Badge variant="secondary">Exibidos: {filteredRows.length}</Badge>
              </div>

              {filteredRows.map((row) => {
                const canManage = isAdmin || row.created_by === user?.id;
                return (
                  <article key={row.id} className="rounded-md border p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-semibold text-foreground">{row.title}</h2>
                          {row.category ? <Badge variant="outline">{row.category}</Badge> : null}
                        </div>
                        {row.tags?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {row.tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-[10px]">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                        <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{row.content}</p>
                        <p className="text-xs text-muted-foreground">
                          Atualizado em {new Date(row.updated_at || row.created_at).toLocaleString("pt-BR")}
                        </p>
                      </div>

                      {canManage ? (
                        <div className="flex shrink-0 justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => startEdit(row)} aria-label="Editar procedimento">
                            <PencilLine className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => void deleteProcedure(row)}
                            disabled={deletingId === row.id}
                            className="text-destructive hover:text-destructive"
                            aria-label="Excluir procedimento"
                          >
                            {deletingId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}

              {filteredRows.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Nenhum procedimento encontrado.
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default KnowledgeBase;
