import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Store,
  Search,
  FileText,
  FileCheck,
  Terminal,
  Wifi,
  LogOut,
  User,
  Users,
  Download,
  Upload,
  KeyRound,
  Palette,
  Database,
  ListChecks,
  Activity,
  BookOpen,
  PlusCircle,
  Wrench,
  ChevronDown,
  Layers,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useSidebarActions } from "@/contexts/SidebarActionsContext";
import { projectModules } from "@/lib/projectModules";
import { WORLD_CUP_2026_TEAM_BY_ID } from "@/data/worldCup2026Teams";
import { BRASILEIRAO_SERIE_A_TEAM_BY_ID } from "@/data/brasileiraoSerieATeams";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

export function AppSidebar() {
  const appVersionLabel = `v${__APP_VERSION__}`;
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin, profile, signOut } = useAuth();
  const { color, worldCupTeam, brasileiraoTeam } = useTheme();

  // TODO: Remover apos a Copa do Mundo 2026 (fim previsto: julho 2026)
  const worldCupFlagImg =
    color === "world-cup"
      ? WORLD_CUP_2026_TEAM_BY_ID[worldCupTeam].flagImg
      : color === "brazil"
        ? WORLD_CUP_2026_TEAM_BY_ID.brazil.flagImg
        : null;
  const brasileiraoBadge = color === "brasileirao" ? BRASILEIRAO_SERIE_A_TEAM_BY_ID[brasileiraoTeam] : null;
  const {
    onExport,
    onImportClick,
    lotericaTab,
    setLotericaTab,
    consultaSearch,
  } = useSidebarActions();
  const [pendingChangeCount, setPendingChangeCount] = useState(0);

  const isLotericaRoute = location.pathname.startsWith("/loterica/");
  const isDashboardToolView = location.pathname === "/" && (lotericaTab === "pingao" || lotericaTab === "script-router-sct");
  const isConsultaUlActive =
    (location.pathname === "/" && !isDashboardToolView) ||
    (isLotericaRoute && lotericaTab === "consulta");
  const isScriptRouterActive =
    lotericaTab === "script-router-sct" && (location.pathname === "/" || isLotericaRoute);
  const isProjectRoute = (projectId: string) => location.pathname.startsWith(`/projetos/${projectId}/`);
  const hasPendingChanges = pendingChangeCount > 0;
  const codUlSegment = isLotericaRoute
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
    { id: "mascara", label: "Mascara", icon: FileText },
    { id: "testes", label: "Testes", icon: Terminal },
  ];

  const openConsultaUl = useCallback(() => {
    setLotericaTab("consulta");
    if (!isLotericaRoute) {
      navigate("/");
    }
  }, [isLotericaRoute, navigate, setLotericaTab]);

  const handleGlobalImport = useCallback(() => {
    if (onImportClick) {
      onImportClick();
      return;
    }

    setLotericaTab("consulta");
    navigate("/");
    toast.info("Importacao disponivel na Consulta UL.", {
      description: "Aguarde a tela carregar e clique em Importar novamente.",
    });
  }, [navigate, onImportClick, setLotericaTab]);

  const handleGlobalExport = useCallback(() => {
    if (onExport) {
      onExport();
      return;
    }

    setLotericaTab("consulta");
    navigate("/");
    toast.info("Exportacao disponivel na Consulta UL.", {
      description: "Aguarde a tela carregar e clique em Exportar novamente.",
    });
  }, [navigate, onExport, setLotericaTab]);

  const warnNoConsulta = useCallback(() => {
    toast.warning("Nenhuma consulta carregada", {
      description: "Acesse o menu Consulta UL e realize uma consulta antes de utilizar esta opcao.",
    });
  }, []);

  const openLotericaTab = useCallback((tabId: string) => {
    if (!isLotericaRoute || !codUlFromDetailRoute) {
      warnNoConsulta();
      return;
    }
    setLotericaTab(tabId);
  }, [codUlFromDetailRoute, isLotericaRoute, setLotericaTab, warnNoConsulta]);

  const handlePing99Click = useCallback((event: React.MouseEvent) => {
    if (!ping99SeedTerm) {
      event.preventDefault();
      warnNoConsulta();
    }
  }, [ping99SeedTerm, warnNoConsulta]);

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
  }, [fetchPendingChangeCount, isAdmin, profile?.user_code, navigate]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            {worldCupFlagImg ? (
              <img src={worldCupFlagImg} alt="Bandeira" className="w-6 h-4 object-cover rounded-sm" />
            ) : brasileiraoBadge ? (
              <img src={brasileiraoBadge.imageUrl} alt={brasileiraoBadge.label} className="h-6 w-6 object-contain" />
            ) : (
              <Store className="w-4 h-4 text-primary-foreground" />
            )}
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="font-bold text-sm text-sidebar-foreground">Consulta Lotericas</span>
            <span className="order-last text-[9px] text-sidebar-foreground/40">Versao {appVersionLabel}</span>
            <span className="text-[10px] text-sidebar-foreground/50">Gestao de unidades</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegacao</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={openConsultaUl}
                  className={isConsultaUlActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : ""}
                >
                  <Search className="mr-2 h-4 w-4" />
                  <span>Consulta UL</span>
                </SidebarMenuButton>
              </SidebarMenuItem>



              {lotericaTabs.map((tab) => (
                <SidebarMenuItem key={tab.id}>
                  <SidebarMenuButton
                    onClick={() => openLotericaTab(tab.id)}
                    className={isLotericaRoute && lotericaTab === tab.id ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : ""}
                  >
                    <tab.icon className="mr-2 h-4 w-4" />
                    <span>{tab.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

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
                  <NavLink to="/validacao" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                    <FileCheck className="mr-2 h-4 w-4" />
                    <span>Validacao</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to={ping99Path} onClick={handlePing99Click} activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
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
                    <span>Pingao NAT</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/pingao-rota" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                    <Activity className="mr-2 h-4 w-4" />
                    <span>Pingao Rota</span>
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
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/relatorio-roteador" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                    <Wrench className="mr-2 h-4 w-4" />
                    <span>Config. Roteador</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/base-conhecimento" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                    <BookOpen className="mr-2 h-4 w-4" />
                    <span>Base Conhecimento</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>


              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => openLotericaTab("script-router-sct")}
                    className={isScriptRouterActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : ""}
                  >
                    <Terminal className="mr-2 h-4 w-4" />
                    <span>Script Router SCT</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Projetos</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {projectModules.map((project) => (
                <Collapsible key={project.id} asChild defaultOpen={isProjectRoute(project.id)}>
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        tooltip={project.label}
                        className={isProjectRoute(project.id) ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : ""}
                      >
                        <Layers className="mr-2 h-4 w-4" />
                        <span>{project.label}</span>
                        <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/menu-item:rotate-180" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {project.items.map((item) => (
                          <SidebarMenuSubItem key={item.id}>
                            <SidebarMenuSubButton asChild size="sm">
                              <NavLink
                                to={`/projetos/${project.id}/${item.id}`}
                                activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                              >
                                <span>{item.label}</span>
                              </NavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Dados</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleGlobalImport}>
                  <Upload className="mr-2 h-4 w-4" />
                  <span>Importar</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleGlobalExport}>
                  <Download className="mr-2 h-4 w-4" />
                  <span>Exportar</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administracao</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/admin/dados" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                      <Database className="mr-2 h-4 w-4" />
                      <span>Gerenciar Dados</span>
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
                      <span>Gerenciar Usuarios</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/admin/import-nat" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                      <Upload className="mr-2 h-4 w-4" />
                      <span>Importar IPs NAT</span>
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
                    <span>Aparencia</span>
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
            <p className="text-[10px] text-sidebar-foreground/50">{profile?.user_code || "Usuario"}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={signOut} title="Sair">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
