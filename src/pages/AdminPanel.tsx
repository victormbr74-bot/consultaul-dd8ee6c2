import { Fragment, FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_USER_SEED } from "@/data/defaultUsers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Users, UserPlus, Trash2, Pencil, Save, RotateCcw, Check, X, RefreshCw, Eye } from "lucide-react";

type UserRow = {
  id: string;
  name: string;
  user_code: string | null;
  role: "admin" | "user";
  active: boolean;
  created_at?: string;
};

type AdminAction =
  | { action: "create_user"; payload: { name: string; user_code: string; role: "admin" | "user"; password?: string } }
  | { action: "update_user"; payload: { user_id: string; name?: string; user_code?: string; role?: "admin" | "user"; active?: boolean; password?: string } }
  | { action: "delete_user"; payload: { user_id: string } }
  | { action: "seed_users"; payload: { users: Array<{ name: string; user_code: string; role?: "admin" | "user" }>; default_password?: string } };

type ChangeRequestRow = {
  id: string;
  cod_ul: string;
  status: string;
  proposed_by: string;
  proposed_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  before_data: any;
  after_data: any;
};

type ChangeRequestViewRow = ChangeRequestRow & {
  loterica_name?: string;
  proposer_name?: string;
  proposer_code?: string | null;
  changed_fields?: string[];
};

const AdminPanel = ({ section }: { section: "data" | "users" }) => {
  const { isAdmin, loading: authLoading, user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);

  const [changeRequests, setChangeRequests] = useState<ChangeRequestViewRow[]>([]);
  const [changesLoading, setChangesLoading] = useState(true);
  const [changesSaving, setChangesSaving] = useState(false);
  const [changesError, setChangesError] = useState<string | null>(null);
  const [expandedChangeId, setExpandedChangeId] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "user">("user");
  const [newPassword, setNewPassword] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editRole, setEditRole] = useState<"admin" | "user">("user");
  const [editActive, setEditActive] = useState(true);
  const [editPassword, setEditPassword] = useState("");

  const fetchChangeRequests = async () => {
    setChangesLoading(true);
    setChangesError(null);
    try {
      const { data: reqs, error } = await (supabase as any)
        .from("loterica_change_requests")
        .select("*")
        .eq("status", "pending")
        .order("proposed_at", { ascending: false })
        .limit(200);

      if (error) {
        const msg = String((error as any)?.message || "");
        if (msg.includes("loterica_change_requests") && msg.includes("Could not find the table")) {
          setChangeRequests([]);
          setChangesError(
            "Banco desatualizado: falta a tabela loterica_change_requests.\n" +
              "Aplique a migracao Supabase '20260213173000_approval_workflow_and_loopback_fix.sql'.",
          );
          return;
        }
        throw new Error(msg);
      }

      const base = (reqs || []) as unknown as ChangeRequestRow[];
      const proposerIds = Array.from(new Set(base.map((r) => r.proposed_by).filter(Boolean)));
      const codUls = Array.from(new Set(base.map((r) => r.cod_ul).filter(Boolean)));

      const profileMap = new Map<string, { id: string; name: string; user_code: string | null }>();
      if (proposerIds.length) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id,name,user_code")
          .in("id", proposerIds);
        if (profilesError) {
          console.error("Erro ao carregar perfis dos solicitantes", profilesError);
        } else {
          (profiles || []).forEach((p) => profileMap.set(p.id, p));
        }
      }

      const lotericaMap = new Map<string, string>();
      if (codUls.length) {
        const { data: lotericas, error: lotericasError } = await supabase
          .from("lotericas")
          .select("cod_ul,nome_loterica")
          .in("cod_ul", codUls);
        if (lotericasError) {
          console.error("Erro ao carregar nomes das lotericas", lotericasError);
        } else {
          (lotericas || []).forEach((l) => lotericaMap.set(l.cod_ul, l.nome_loterica || ""));
        }
      }

      const view: ChangeRequestViewRow[] = base.map((r) => {
        const proposer = profileMap.get(r.proposed_by);
        const before = r.before_data && typeof r.before_data === "object" ? r.before_data : {};
        const after = r.after_data && typeof r.after_data === "object" ? r.after_data : {};
        const changedFields: string[] = [];

        for (const key of Object.keys(after || {})) {
          if (key !== "raw_data") {
            changedFields.push(key);
            continue;
          }

          const beforeRaw = (before as any).raw_data && typeof (before as any).raw_data === "object" ? (before as any).raw_data : {};
          const afterRaw = (after as any).raw_data && typeof (after as any).raw_data === "object" ? (after as any).raw_data : {};
          const allRawKeys = Array.from(new Set([...Object.keys(beforeRaw), ...Object.keys(afterRaw)])).sort((a, b) =>
            a.localeCompare(b, "pt-BR"),
          );

          for (const rawKey of allRawKeys) {
            if (JSON.stringify(beforeRaw[rawKey]) !== JSON.stringify(afterRaw[rawKey])) {
              changedFields.push(`raw_data.${rawKey}`);
            }
          }
        }
        return {
          ...r,
          proposer_name: proposer?.name || "",
          proposer_code: proposer?.user_code ?? null,
          loterica_name: lotericaMap.get(r.cod_ul) || "",
          changed_fields: changedFields,
        };
      });

      setChangeRequests(view);
    } catch (err) {
      console.error("Erro ao carregar solicitações de alteração", err);
      setChangeRequests([]);
      setChangesError(err instanceof Error ? err.message : "Erro ao carregar aprovações.");
    } finally {
      setChangesLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) {
      navigate("/");
      return;
    }
    if (section === "users") {
      void fetchUsers();
    } else {
      void fetchChangeRequests();
    }
  }, [authLoading, isAdmin, navigate, section]);

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [users],
  );

  const invokeAdminUsers = async (request: AdminAction) => {
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: request,
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: profiles, error: profilesError } = await supabase.from("profiles").select("*");
      const { data: roles, error: rolesError } = await supabase.from("user_roles").select("*");

      if (profilesError || rolesError) {
        console.error("Erro ao carregar usuarios", { profilesError, rolesError });
        setUsers([]);
        return;
      }

      const merged: UserRow[] = (profiles || []).map((p) => ({
        id: p.id,
        name: p.name,
        user_code: p.user_code,
        active: p.active,
        created_at: p.created_at,
        role: (roles?.find((r) => r.user_id === p.id)?.role || "user") as "admin" | "user",
      }));

      setUsers(merged);
    } catch (error) {
      console.error("Falha inesperada ao carregar usuarios", error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const approveChangeRequest = async (req: ChangeRequestViewRow) => {
    if (!user?.id) {
      alert("Sessão inválida. Faça login novamente.");
      return;
    }
    const confirmApprove = window.confirm(
      `Aprovar e aplicar a alteração da lotérica ${req.cod_ul}?`,
    );
    if (!confirmApprove) return;

    setChangesSaving(true);
    try {
      const updates = req.after_data && typeof req.after_data === "object" ? (req.after_data as Record<string, unknown>) : {};

      const { error: updateError } = await supabase
        .from("lotericas")
        .update({ ...updates, updated_by: req.proposed_by, updated_at: new Date().toISOString() })
        .eq("cod_ul", req.cod_ul);

      if (updateError) throw new Error(updateError.message);

      const { error: reqError } = await (supabase as any)
        .from("loterica_change_requests")
        .update({
          status: "approved",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", req.id);

      if (reqError) throw new Error(reqError.message);

      setExpandedChangeId(null);
      await fetchChangeRequests();
      alert("Alteração aprovada e aplicada no banco.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao aprovar alteração.");
    } finally {
      setChangesSaving(false);
    }
  };

  const rejectChangeRequest = async (req: ChangeRequestViewRow) => {
    if (!user?.id) {
      alert("Sessão inválida. Faça login novamente.");
      return;
    }
    const confirmReject = window.confirm(
      `Rejeitar a alteração da lotérica ${req.cod_ul}?`,
    );
    if (!confirmReject) return;

    setChangesSaving(true);
    try {
      const { error: reqError } = await (supabase as any)
        .from("loterica_change_requests")
        .update({
          status: "rejected",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", req.id);

      if (reqError) throw new Error(reqError.message);

      setExpandedChangeId(null);
      await fetchChangeRequests();
      alert("Alteração rejeitada.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao rejeitar alteração.");
    } finally {
      setChangesSaving(false);
    }
  };

  const startEdit = (user: UserRow) => {
    setEditId(user.id);
    setEditName(user.name);
    setEditCode(user.user_code || "");
    setEditRole(user.role);
    setEditActive(user.active);
    setEditPassword("");
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditName("");
    setEditCode("");
    setEditRole("user");
    setEditActive(true);
    setEditPassword("");
  };

  const createUser = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await invokeAdminUsers({
        action: "create_user",
        payload: {
          name: newName,
          user_code: newCode,
          role: newRole,
          password: newPassword || undefined,
        },
      });

      setNewName("");
      setNewCode("");
      setNewRole("user");
      setNewPassword("");
      await fetchUsers();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao criar usuário.");
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!editId) return;
    setSaving(true);
    try {
      await invokeAdminUsers({
        action: "update_user",
        payload: {
          user_id: editId,
          name: editName,
          user_code: editCode,
          role: editRole,
          active: editActive,
          password: editPassword || undefined,
        },
      });
      cancelEdit();
      await fetchUsers();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao atualizar usuário.");
    } finally {
      setSaving(false);
    }
  };

  const removeUser = async (user: UserRow) => {
    const confirmDelete = window.confirm(`Excluir usuário ${user.name} (${user.user_code || "-"})?`);
    if (!confirmDelete) return;
    setSaving(true);
    try {
      await invokeAdminUsers({
        action: "delete_user",
        payload: { user_id: user.id },
      });
      await fetchUsers();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao excluir usuário.");
    } finally {
      setSaving(false);
    }
  };

  const seedDefaultUsers = async () => {
    const confirmSeed = window.confirm(
      "Importar a lista padrao de usuarios agora? Usuarios existentes serao atualizados, novos serao criados e a senha dos nao-admin sera redefinida para Oi@12345.",
    );
    if (!confirmSeed) return;

    setSeedLoading(true);
    try {
      const result = await invokeAdminUsers({
        action: "seed_users",
        payload: {
          users: DEFAULT_USER_SEED,
          default_password: "Oi@12345",
        },
      });
      await fetchUsers();
      alert(
        `Seed concluído.\nTotal: ${result.total}\nCriados: ${result.created}\nAtualizados: ${result.updated}\nFalhas: ${result.failed}`,
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao importar usuários.");
    } finally {
      setSeedLoading(false);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  }

  if (!isAdmin) return null;

  return (
    <div className="bg-background">
      <main className="container px-4 py-6 max-w-6xl">
        <Tabs value={section === "data" ? "approvals" : "users"} className="space-y-4">

          <TabsContent value="approvals" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" /> Aprovações Pendentes ({changeRequests.length})
                </CardTitle>
                <Button variant="outline" onClick={fetchChangeRequests} disabled={changesLoading || changesSaving}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${changesLoading ? "animate-spin" : ""}`} />
                  Atualizar
                </Button>
              </CardHeader>
              {!!changesError && (
                <CardContent className="pt-0">
                  <div className="text-sm text-destructive">{changesError}</div>
                </CardContent>
              )}
            </Card>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium text-muted-foreground">Data</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">UL</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Lotérica</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Solicitante</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Campos</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {changesLoading ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-muted-foreground">Carregando...</td>
                        </tr>
                      ) : changeRequests.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhuma aprovação pendente.</td>
                        </tr>
                      ) : (
                        changeRequests.map((r) => (
                          <Fragment key={r.id}>
                            <tr className="border-b align-top">
                              <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                                {new Date(r.proposed_at).toLocaleString("pt-BR")}
                              </td>
                              <td className="p-3 font-mono text-xs">{r.cod_ul}</td>
                              <td className="p-3">{r.loterica_name || "-"}</td>
                              <td className="p-3">
                                <div className="font-medium">{r.proposer_name || "-"}</div>
                                <div className="text-xs text-muted-foreground">{r.proposer_code || "-"}</div>
                              </td>
                              <td className="p-3 text-xs">
                                <Badge variant="secondary">{r.changed_fields?.length || 0}</Badge>
                              </td>
                              <td className="p-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setExpandedChangeId(expandedChangeId === r.id ? null : r.id)}
                                  >
                                    <Eye className="w-4 h-4 mr-1" /> Ver
                                  </Button>
                                  <Button size="sm" onClick={() => void approveChangeRequest(r)} disabled={changesSaving}>
                                    <Check className="w-4 h-4 mr-1" /> Aprovar
                                  </Button>
                                  <Button size="sm" variant="destructive" onClick={() => void rejectChangeRequest(r)} disabled={changesSaving}>
                                    <X className="w-4 h-4 mr-1" /> Rejeitar
                                  </Button>
                                </div>
                              </td>
                            </tr>

                            {expandedChangeId === r.id && (
                              <tr className="border-b bg-muted/20">
                                <td colSpan={6} className="p-4">
                                  {(r.changed_fields || []).length === 0 ? (
                                    <div className="text-sm text-muted-foreground">Sem detalhes de alteração.</div>
                                  ) : (
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      {(r.changed_fields || []).map((k) => {
                                        const isRaw = k.startsWith("raw_data.");
                                        const rawKey = isRaw ? k.slice("raw_data.".length) : "";
                                        const beforeObj = r.before_data && typeof r.before_data === "object" ? r.before_data : {};
                                        const afterObj = r.after_data && typeof r.after_data === "object" ? r.after_data : {};
                                        const beforeVal = isRaw ? (beforeObj as any)?.raw_data?.[rawKey] : (beforeObj as any)?.[k];
                                        const afterVal = isRaw ? (afterObj as any)?.raw_data?.[rawKey] : (afterObj as any)?.[k];
                                        const label = isRaw ? `raw_data: ${rawKey}` : k;

                                        return (
                                          <div key={k} className="rounded-lg border bg-background p-3">
                                            <div className="text-xs font-medium text-foreground">{label}</div>
                                            <div className="mt-1 text-xs text-muted-foreground">
                                              <span className="text-destructive line-through">
                                                {String(beforeVal ?? "") || "-"}
                                              </span>
                                              {" -> "}
                                              <span className="text-green-700">
                                                {String(afterVal ?? "") || "-"}
                                              </span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" /> Gerenciamento de Usuários ({users.length})
                </CardTitle>
                <Button variant="outline" onClick={seedDefaultUsers} disabled={seedLoading || saving}>
                  {seedLoading ? "Importando..." : "Importar Lista Base"}
                </Button>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5" /> Adicionar Usuário
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={createUser} className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div className="md:col-span-2 space-y-1">
                    <Label>Nome</Label>
                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} required />
                  </div>
                  <div className="space-y-1">
                    <Label>ID Colaborador</Label>
                    <Input value={newCode} onChange={(e) => setNewCode(e.target.value.replace(/\D/g, ""))} required />
                  </div>
                  <div className="space-y-1">
                    <Label>Papel</Label>
                    <Select value={newRole} onValueChange={(v) => setNewRole(v as "admin" | "user")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Usuário</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Senha (opcional)</Label>
                    <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                  </div>
                  <div className="md:col-span-5">
                    <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Adicionar"}</Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium text-muted-foreground">Nome</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Código</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Papel</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Carregando...</td></tr>
                      ) : sortedUsers.length === 0 ? (
                        <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhum usuário encontrado.</td></tr>
                      ) : sortedUsers.map((u) => (
                        <tr key={u.id} className="border-b align-top">
                          <td className="p-3">
                            {editId === u.id ? (
                              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                            ) : (
                              <span className="font-medium">{u.name}</span>
                            )}
                          </td>
                          <td className="p-3 font-mono">
                            {editId === u.id ? (
                              <Input value={editCode} onChange={(e) => setEditCode(e.target.value.replace(/\D/g, ""))} />
                            ) : (
                              u.user_code || "-"
                            )}
                          </td>
                          <td className="p-3">
                            {editId === u.id ? (
                              <Select value={editRole} onValueChange={(v) => setEditRole(v as "admin" | "user")}>
                                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="user">Usuário</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant={u.role === "admin" ? "default" : "secondary"}>{u.role === "admin" ? "Admin" : "Usuário"}</Badge>
                            )}
                          </td>
                          <td className="p-3">
                            {editId === u.id ? (
                              <Select value={editActive ? "ativo" : "inativo"} onValueChange={(v) => setEditActive(v === "ativo")}>
                                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="ativo">Ativo</SelectItem>
                                  <SelectItem value="inativo">Inativo</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant={u.active ? "default" : "destructive"}>{u.active ? "Ativo" : "Inativo"}</Badge>
                            )}
                          </td>
                          <td className="p-3 space-y-2">
                            {editId === u.id ? (
                              <>
                                <Input
                                  type="password"
                                  placeholder="Nova senha (opcional)"
                                  value={editPassword}
                                  onChange={(e) => setEditPassword(e.target.value)}
                                />
                                <div className="flex items-center gap-2">
                                  <Button size="sm" onClick={saveEdit} disabled={saving}>
                                    <Save className="w-4 h-4 mr-1" /> Salvar
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={cancelEdit}>
                                    <RotateCcw className="w-4 h-4 mr-1" /> Cancelar
                                  </Button>
                                </div>
                              </>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Button size="sm" variant="outline" onClick={() => startEdit(u)}>
                                  <Pencil className="w-4 h-4 mr-1" /> Editar
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => removeUser(u)}>
                                  <Trash2 className="w-4 h-4 mr-1" /> Excluir
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminPanel;
