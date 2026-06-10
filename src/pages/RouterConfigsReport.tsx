import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2, PencilLine, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { jsonToWorkbook, writeFile } from "@/lib/excelCompat";
import { ROUTER_CONFIG_TIPOS, ROUTER_CONFIG_TYPES } from "@/components/loterica/RouterConfigCard";

type Row = {
  id: string;
  cod_ul: string;
  tipo: string;
  config_type: string;
  observacao: string;
  created_at: string;
  created_by: string;
  reminder_acknowledged_at: string | null;
};

type Profile = { id: string; name: string | null; user_code: string | null };

const RouterConfigsReport = () => {
  const { user, isAdmin } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [savingNew, setSavingNew] = useState(false);
  const [newConfig, setNewConfig] = useState({ cod_ul: "", tipo: "", config_type: "", observacao: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ tipo: "", config_type: "", observacao: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("loterica_router_configs" as never)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) {
      toast.error("Falha ao carregar relatório", { description: error.message });
      setLoading(false);
      return;
    }
    const list = (data as unknown as Row[]) || [];
    setRows(list);

    const ids = Array.from(new Set(list.map((r) => r.created_by)));
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, name, user_code")
        .in("id", ids);
      const map: Record<string, Profile> = {};
      ((profs as Profile[]) || []).forEach((p) => {
        map[p.id] = p;
      });
      setProfiles(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const exportXlsx = async () => {
    if (!rows.length) return;
    setExporting(true);
    try {
      const data = rows.map((r) => ({
        "Código UL": r.cod_ul,
        Tipo: r.tipo,
        Configuração: r.config_type,
        Observação: r.observacao,
        Responsável: profiles[r.created_by]?.name || "-",
        "Código Usuário": profiles[r.created_by]?.user_code || "-",
        "Data/Hora": new Date(r.created_at).toLocaleString("pt-BR"),
        Verificado: r.reminder_acknowledged_at
          ? new Date(r.reminder_acknowledged_at).toLocaleString("pt-BR")
          : "",
      }));
      const wb = jsonToWorkbook([{ name: "Configurações Roteador", data }]);
      await writeFile(wb, `configuracoes-roteador-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Relatório exportado");
    } catch (e) {
      toast.error("Falha ao exportar", { description: (e as Error).message });
    } finally {
      setExporting(false);
    }
  };

  const createConfig = async () => {
    if (!user?.id) {
      toast.error("Sessao expirada.");
      return;
    }

    const codUl = newConfig.cod_ul.trim();
    const observacao = newConfig.observacao.trim();
    if (!codUl || !newConfig.tipo || !newConfig.config_type || !observacao) {
      toast.error("Preencha codigo UL, tipo, configuracao e observacao.");
      return;
    }

    setSavingNew(true);
    const { error } = await supabase.from("loterica_router_configs" as never).insert({
      cod_ul: codUl,
      tipo: newConfig.tipo,
      config_type: newConfig.config_type,
      observacao,
      created_by: user.id,
    } as never);
    setSavingNew(false);

    if (error) {
      toast.error("Falha ao salvar configuracao", { description: error.message });
      return;
    }

    toast.success("Configuracao registrada");
    setNewConfig({ cod_ul: "", tipo: "", config_type: "", observacao: "" });
    void load();
  };

  const startEdit = (row: Row) => {
    setEditingId(row.id);
    setEditDraft({ tipo: row.tipo, config_type: row.config_type, observacao: row.observacao });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({ tipo: "", config_type: "", observacao: "" });
  };

  const saveEdit = async (row: Row) => {
    if (!editDraft.tipo || !editDraft.config_type || !editDraft.observacao.trim()) {
      toast.error("Preencha tipo, configuracao e observacao.");
      return;
    }

    setSavingEdit(true);
    const { error } = await supabase
      .from("loterica_router_configs" as never)
      .update({
        tipo: editDraft.tipo,
        config_type: editDraft.config_type,
        observacao: editDraft.observacao.trim(),
      } as never)
      .eq("id", row.id);
    setSavingEdit(false);

    if (error) {
      toast.error("Falha ao editar configuracao", { description: error.message });
      return;
    }

    toast.success("Configuracao atualizada");
    cancelEdit();
    void load();
  };

  const deleteConfig = async (row: Row) => {
    if (!isAdmin && row.created_by !== user?.id) {
      toast.error("Sem permissao para excluir esta configuracao.");
      return;
    }

    if (!window.confirm(`Excluir a configuracao ${row.tipo} - ${row.config_type} da UL ${row.cod_ul}?`)) {
      return;
    }

    setDeletingId(row.id);
    const { error } = await supabase.from("loterica_router_configs" as never).delete().eq("id", row.id);
    setDeletingId(null);

    if (error) {
      toast.error("Falha ao excluir configuracao", { description: error.message });
      return;
    }

    toast.success("Configuracao excluida");
    if (editingId === row.id) cancelEdit();
    setRows((current) => current.filter((item) => item.id !== row.id));
  };

  const stats = useMemo(() => {
    const byType: Record<string, number> = {};
    rows.forEach((r) => {
      byType[r.config_type] = (byType[r.config_type] || 0) + 1;
    });
    return byType;
  }, [rows]);

  return (
    <div className="container px-4 py-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Nova Configuracao no Roteador</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[180px_180px_240px_minmax(0,1fr)]">
            <div className="space-y-1">
              <Label className="text-xs">Codigo UL</Label>
              <Input
                value={newConfig.cod_ul}
                onChange={(event) => setNewConfig((current) => ({ ...current, cod_ul: event.target.value }))}
                placeholder="21-000000-0"
                className="h-8 text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select value={newConfig.tipo} onValueChange={(value) => setNewConfig((current) => ({ ...current, tipo: value }))}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {ROUTER_CONFIG_TIPOS.map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Configuracao</Label>
              <Select
                value={newConfig.config_type}
                onValueChange={(value) => setNewConfig((current) => ({ ...current, config_type: value }))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {ROUTER_CONFIG_TYPES.map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Observacao</Label>
              <Textarea
                rows={2}
                value={newConfig.observacao}
                onChange={(event) => setNewConfig((current) => ({ ...current, observacao: event.target.value }))}
                className="min-h-8 text-xs"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={createConfig} disabled={savingNew} size="sm">
              {savingNew ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar configuracao
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Relatório de Configurações no Roteador</CardTitle>
          <Button onClick={exportXlsx} disabled={exporting || rows.length === 0} size="sm">
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Exportar XLSX
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Total: {rows.length}</Badge>
            {Object.entries(stats).map(([k, v]) => (
              <Badge key={k} variant="secondary">
                {k}: {v}
              </Badge>
            ))}
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <div className="border rounded-md overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código UL</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Configuração</TableHead>
                    <TableHead>Observação</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const isEditing = editingId === r.id;
                    const canEdit = isAdmin || (!!user?.id && r.created_by === user.id);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.cod_ul}</TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Select value={editDraft.tipo} onValueChange={(value) => setEditDraft((current) => ({ ...current, tipo: value }))}>
                              <SelectTrigger className="h-8 min-w-[130px] text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ROUTER_CONFIG_TIPOS.map((item) => (
                                  <SelectItem key={item} value={item}>{item}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : r.tipo}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Select
                              value={editDraft.config_type}
                              onValueChange={(value) => setEditDraft((current) => ({ ...current, config_type: value }))}
                            >
                              <SelectTrigger className="h-8 min-w-[220px] text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ROUTER_CONFIG_TYPES.map((item) => (
                                  <SelectItem key={item} value={item}>{item}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : r.config_type}
                        </TableCell>
                        <TableCell className="max-w-md whitespace-pre-wrap text-xs">
                          {isEditing ? (
                            <Textarea
                              value={editDraft.observacao}
                              onChange={(event) => setEditDraft((current) => ({ ...current, observacao: event.target.value }))}
                              className="min-h-[70px] text-xs"
                            />
                          ) : r.observacao}
                        </TableCell>
                        <TableCell className="text-xs">
                          {profiles[r.created_by]?.name || "-"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {new Date(r.created_at).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" onClick={() => void saveEdit(r)} disabled={savingEdit}>
                                {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                              </Button>
                              <Button size="icon" variant="ghost" onClick={cancelEdit} disabled={savingEdit}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : canEdit ? (
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" onClick={() => startEdit(r)}>
                                <PencilLine className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => void deleteConfig(r)}
                                disabled={deletingId === r.id}
                                className="text-destructive hover:text-destructive"
                                aria-label="Excluir configuracao"
                              >
                                {deletingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              </Button>
                            </div>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        Nenhuma configuração registrada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RouterConfigsReport;
