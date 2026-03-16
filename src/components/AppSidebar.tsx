import { useCallback, useEffect, useState } from "react";
import { Store, Search, FileText, Terminal, Wifi, LogOut, User, Users, Download, Upload, KeyRound, Palette, Database, ListChecks, Activity, PlusCircle } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useSidebarActions } from "@/contexts/SidebarActionsContext";
import { WORLD_CUP_2026_TEAM_BY_ID } from "@/data/worldCup2026Teams";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin, profile, signOut } = useAuth();
  const { color, worldCupTeam } = useTheme();

  // TODO: Remover apos a Copa do Mundo 2026 (fim previsto: julho 2026)
  const worldCupFlagImg = color === "world-cup" ? WORLD_CUP_2026_TEAM_BY_ID[worldCupTeam].flagImg : null;
  const {
    onExport,
    onImportClick,
    onSearchSubmit,
    lotericaTab,
    setLotericaTab,
    consultaSearch,
    setConsultaSearch,
  } = useSidebarActions();
  const [pendingChangeCount, setPendingChangeCount] = useState(0);

  const isDashboardRoute = location.pathname === "/";
  const shouldShowLotericaTabs = true;
  const hasPendingChanges = pendingChangeCount > 0;
  const codUlSegment = location.pathname.startsWith("/loterica/")
    ? location.pathname.replace("/loterica/", "").split("/")[0] || ""
    : "";
  const codUlFromDetailRoute = (() => {
    try {
      return decodeURIComponent(codUlSegment);
    } catch {
      return codUlSegment;
    }
  })();
  const ping99SeedTerm = String(codUlFromDetailRoute || consultaSearch || "").trim();
  const ping99Path = ping99SeedTerm ? `/ping99?q=${encodeURIComponent(ping99SeedTerm)}` : "/ping99";

  const lotericaTabs = [
    { id: "consulta", label: "Consulta", icon: Search },
    { id: "mascara", label: "Máscara", icon: FileText },
    { id: "testes", label: "Testes", icon: Terminal },
    ...(isAdmin ? [{ id: "script-router-sct", label: "Script Router SCT", icon: Terminal }] : []),
  ];

  const fetchPendingChangeCount = useCallback(async () => {
    if (!isAdmin) {
      setPendingChangeCount(0);
      return;
    }

    try {
      const { count, error } = await supabase
        .from("loterica_change_requests" as never)
        .select("id", { head: true, count: "exact" })
        .eq("status", "pending");

      if (error) {
        const msg =
          error && typeof error === "object" && "message" in error
            ? String((error as { message?: string }).message || "")
            : "";
        if (!(msg.includes("loterica_change_requests") && msg.includes("Could not find the table"))) {
          console.error("Erro ao carregar pendencias de alteracao", error);
        }
        setPendingChangeCount(0);
        return;
      }

      setPendingChangeCount(count || 0);
    } catch (error) {
      console.error("Falha inesperada ao carregar pendencias de alteracao", error);
      setPendingChangeCount(0);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) {
      setPendingChangeCount(0);
      return;
    }

    void fetchPendingChangeCount();

    const intervalId = window.setInterval(() => {
      void fetchPendingChangeCount();
    }, 30000);

    const channel = supabase
      .channel("sidebar-loterica-change-requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "loterica_change_requests" },
        () => {
          void fetchPendingChangeCount();
        },
      )
      .subscribe();

    return () => {
      window.clearInterval(intervalId);
      void supabase.removeChannel(channel);
    };
  }, [fetchPendingChangeCount, isAdmin]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          {/* TODO: Remover bloco worldCupFlag apos a Copa do Mundo 2026 */}
            {worldCupFlagImg ? (
              <img src={worldCupFlagImg} alt="Bandeira" className="w-6 h-4 object-cover rounded-sm" />
            ) : (
              <Store className="w-4 h-4 text-primary-foreground" />
            )}
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="font-bold text-sm text-sidebar-foreground">Consulta Lotericas</span>
            <span className="text-[10px] text-sidebar-foreground/50">{"Gestão de unidades"}</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {isDashboardRoute && (
          <div className="px-2 pt-2 group-data-[collapsible=icon]:hidden">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={"Buscar por codigo, nome, CCTO ou cidade..."}
                className="pl-9 bg-sidebar border-sidebar-border"
                value={consultaSearch}
                onChange={(e) => setConsultaSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onSearchSubmit?.();
                  }
                }}
              />
            </div>
          </div>
        )}
        <SidebarGroup>
          <SidebarGroupLabel>{"Navegação"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/" end activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                    <Search className="mr-2 h-4 w-4" />
                    <span>Consulta UL</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/loterica/cadastrar" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                      <PlusCircle className="mr-2 h-4 w-4" />
                      <span>Cadastrar UL</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/consulta-massa" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                    <ListChecks className="mr-2 h-4 w-4" />
                    <span>Consulta Massa</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to={ping99Path} activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                    <Wifi className="mr-2 h-4 w-4" />
                    <span>Ping 99</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/pingao" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                    <Activity className="mr-2 h-4 w-4" />
                    <span>Pingao</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/pingao-nat" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                    <Activity className="mr-2 h-4 w-4" />
                    <span>Pingão NAT</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/comparar-texto" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                    <FileText className="mr-2 h-4 w-4" />
                    <span>Comparar Texto</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {shouldShowLotericaTabs && (
          <SidebarGroup>
            <SidebarGroupLabel>{"Lotérica"}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {lotericaTabs.map((tab) => (
                  <SidebarMenuItem key={tab.id}>
                    <SidebarMenuButton
                      onClick={() => {
                        setLotericaTab(tab.id);
                        if (!location.pathname.startsWith("/loterica/")) {
                          navigate("/");
                        }
                      }}
                      className={lotericaTab === tab.id ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : ""}
                    >
                      <tab.icon className="mr-2 h-4 w-4" />
                      <span>{tab.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Dados</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => onImportClick?.()} disabled={!onImportClick}>
                  <Upload className="mr-2 h-4 w-4" />
                  <span>Importar</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => onExport?.()} disabled={!onExport}>
                  <Download className="mr-2 h-4 w-4" />
                  <span>Exportar</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>


        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>{"Administração"}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/admin/dados" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                      <Database className="mr-2 h-4 w-4" />
                      <span>{"Gerenciar Dados"}</span>
                      {hasPendingChanges && (
                        <span className="ml-auto inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                          {pendingChangeCount > 99 ? "99+" : pendingChangeCount}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/admin/usuarios" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                      <Users className="mr-2 h-4 w-4" />
                      <span>{"Gerenciar Usuários"}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/admin/import-nat" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                      <Upload className="mr-2 h-4 w-4" />
                      <span>{"Importar IPs NAT"}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Conta</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/temas" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                    <Palette className="mr-2 h-4 w-4" />
                    <span>Aparência</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/senha" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                    <KeyRound className="mr-2 h-4 w-4" />
                    <span>Trocar Senha</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center">
            <User className="w-4 h-4 text-sidebar-accent-foreground" />
          </div>
          <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{profile?.name}</p>
            <p className="text-[10px] text-sidebar-foreground/50">{profile?.user_code || "Usuário"}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={signOut} title="Sair">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

