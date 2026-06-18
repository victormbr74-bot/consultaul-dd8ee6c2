import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Users, History, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/modules/controle-reparo/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ProfileRow = {
  id: string;
  nome: string | null;
  email: string | null;
  criado_em: string;
};

type RoleRow = {
  user_id: string;
  role: AppRole;
};

type AuditRow = {
  id: string;
  data_hora: string;
  codigo_loterica: string;
  usuario: string | null;
  campo: string;
  valor_anterior: string | null;
  valor_novo: string | null;
};

const ROLE_PRIORITY: AppRole[] = ["administrador_master", "administrador", "operacao", "consulta"];

const ROLE_LABEL: Record<AppRole, string> = {
  administrador_master: "ADM Master",
  administrador: "Administrador",
  operacao: "Operação",
  consulta: "Consulta",
};

const ROLE_TONE: Record<AppRole, string> = {
  administrador_master: "bg-primary text-primary-foreground",
  administrador: "bg-faixa-atencao text-faixa-atencao-foreground",
  operacao: "bg-faixa-medio text-faixa-medio-foreground",
  consulta: "bg-muted text-muted-foreground",
};

function norm(v: string | null | undefined): string {
  return (v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function highestRole(roles: RoleRow[]): AppRole {
  for (const role of ROLE_PRIORITY) {
    if (roles.some((r) => r.role === role)) return role;
  }
  return "consulta";
}

function matriculaFromEmail(email: string | null): string {
  return email?.split("@")[0] ?? "-";
}

export default function AdminMasterPage() {
  const { isAdminMaster, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdminMaster) {
    return (
      <div className="p-6 lg:p-8">
        <Card className="max-w-xl p-6">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-muted-foreground" />
            <div>
              <h1 className="text-xl font-bold">Acesso restrito</h1>
              <p className="text-sm text-muted-foreground">
                Apenas o ADM Master pode acessar usuários, perfis e auditoria geral.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return <AdminMasterContent currentUserId={user?.id ?? null} />;
}

function AdminMasterContent({ currentUserId }: { currentUserId: string | null }) {
  const queryClient = useQueryClient();
  const [userSearch, setUserSearch] = useState("");
  const [auditSearch, setAuditSearch] = useState("");

  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ["admin-master-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,nome,email,criado_em")
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });

  const { data: roles = [], isLoading: loadingRoles } = useQuery({
    queryKey: ["admin-master-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id,role");
      if (error) throw error;
      return (data ?? []) as RoleRow[];
    },
  });

  const { data: audit = [], isLoading: loadingAudit } = useQuery({
    queryKey: ["admin-master-audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("historico_tratativas")
        .select("id,data_hora,codigo_loterica,usuario,campo,valor_anterior,valor_novo")
        .order("data_hora", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
  });

  const roleByUser = useMemo(() => {
    const map = new Map<string, AppRole>();
    for (const profile of profiles) {
      map.set(profile.id, highestRole(roles.filter((r) => r.user_id === profile.id)));
    }
    return map;
  }, [profiles, roles]);

  const filteredProfiles = useMemo(() => {
    const q = norm(userSearch);
    if (!q) return profiles;
    return profiles.filter((p) => {
      const role = roleByUser.get(p.id) ?? "consulta";
      return norm(`${p.nome ?? ""} ${p.email ?? ""} ${matriculaFromEmail(p.email)} ${ROLE_LABEL[role]}`).includes(q);
    });
  }, [profiles, roleByUser, userSearch]);

  const filteredAudit = useMemo(() => {
    const q = norm(auditSearch);
    if (!q) return audit;
    return audit.filter((a) =>
      norm(`${a.codigo_loterica} ${a.usuario ?? ""} ${a.campo} ${a.valor_anterior ?? ""} ${a.valor_novo ?? ""}`).includes(q),
    );
  }, [audit, auditSearch]);

  const roleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.rpc("set_user_app_role", {
        _target_user_id: userId,
        _role: role,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-master-roles"] });
      toast.success("Perfil atualizado");
    },
    onError: (error) => {
      toast.error("Falha ao atualizar perfil", {
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
    },
  });

  const loadingUsers = loadingProfiles || loadingRoles;

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ShieldCheck className="h-6 w-6 text-primary" />
          Admin Master
        </h1>
        <p className="text-sm text-muted-foreground">
          Gestão de usuários, perfis e auditoria geral de alterações.
        </p>
      </div>

      <Tabs defaultValue="usuarios">
        <TabsList className="max-w-full overflow-x-auto">
          <TabsTrigger value="usuarios" className="gap-2">
            <Users className="h-4 w-4" />
            Usuários e Perfis
          </TabsTrigger>
          <TabsTrigger value="auditoria" className="gap-2">
            <History className="h-4 w-4" />
            Auditoria Geral
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="mt-6">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
              <div>
                <h2 className="font-semibold">Usuários cadastrados</h2>
                <p className="text-sm text-muted-foreground">
                  {filteredProfiles.length} de {profiles.length} usuários
                </p>
              </div>
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Buscar usuário, ID ou perfil"
                  className="pl-8"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-muted/70 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Nome</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Perfil atual</th>
                    <th className="px-4 py-3">Alterar perfil</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingUsers ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                        Carregando usuários...
                      </td>
                    </tr>
                  ) : filteredProfiles.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                        Nenhum usuário encontrado.
                      </td>
                    </tr>
                  ) : (
                    filteredProfiles.map((profile) => {
                      const profileRole = roleByUser.get(profile.id) ?? "consulta";
                      const isCurrentUser = profile.id === currentUserId;
                      const changingThisUser =
                        roleMutation.isPending && roleMutation.variables?.userId === profile.id;

                      return (
                        <tr key={profile.id} className="border-t">
                          <td className="px-4 py-3 font-medium">{matriculaFromEmail(profile.email)}</td>
                          <td className="px-4 py-3">{profile.nome ?? "-"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{profile.email ?? "-"}</td>
                          <td className="px-4 py-3">
                            <Badge className={ROLE_TONE[profileRole]}>{ROLE_LABEL[profileRole]}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Select
                              value={profileRole}
                              disabled={isCurrentUser || changingThisUser}
                              onValueChange={(nextRole) =>
                                roleMutation.mutate({
                                  userId: profile.id,
                                  role: nextRole as AppRole,
                                })
                              }
                            >
                              <SelectTrigger className="w-56">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ROLE_PRIORITY.map((role) => (
                                  <SelectItem key={role} value={role}>
                                    {ROLE_LABEL[role]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="auditoria" className="mt-6">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
              <div>
                <h2 className="font-semibold">Alterações registradas</h2>
                <p className="text-sm text-muted-foreground">
                  {filteredAudit.length} registros exibidos dos últimos {audit.length}
                </p>
              </div>
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Buscar código, usuário ou campo"
                  className="pl-8"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-sm">
                <thead className="bg-muted/70 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Data/Hora</th>
                    <th className="px-4 py-3">Usuário</th>
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Campo</th>
                    <th className="px-4 py-3">Valor anterior</th>
                    <th className="px-4 py-3">Valor novo</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingAudit ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                        Carregando auditoria...
                      </td>
                    </tr>
                  ) : filteredAudit.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                        Nenhuma alteração encontrada.
                      </td>
                    </tr>
                  ) : (
                    filteredAudit.map((item) => (
                      <tr key={item.id} className="border-t align-top">
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {new Date(item.data_hora).toLocaleString("pt-BR")}
                        </td>
                        <td className="px-4 py-3">{item.usuario ?? "-"}</td>
                        <td className="px-4 py-3 font-medium">{item.codigo_loterica}</td>
                        <td className="px-4 py-3">{item.campo}</td>
                        <td className="max-w-[260px] px-4 py-3 text-muted-foreground">
                          <span className="line-through">{item.valor_anterior || "vazio"}</span>
                        </td>
                        <td className="max-w-[260px] px-4 py-3 font-medium">
                          {item.valor_novo || "vazio"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
