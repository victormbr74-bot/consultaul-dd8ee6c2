import { MapPin, Search, FileText, Terminal, Wifi, LogOut, User, Users, Download, Upload, KeyRound, Palette } from "lucide-react";
import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebarActions } from "@/contexts/SidebarActionsContext";
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

export function AppSidebar() {
  const location = useLocation();
  const { isAdmin, profile, signOut } = useAuth();
  const { onExport, onImportClick, lotericaTab, setLotericaTab, showLotericaTabs } = useSidebarActions();

  const isDashboardRoute = location.pathname === "/";
  const isLotericaRoute = location.pathname.startsWith("/loterica/");
  const shouldShowLotericaTabs = showLotericaTabs || isLotericaRoute;

  const lotericaTabs = [
    { id: "consulta", label: "Consulta", icon: Search },
    { id: "mascara", label: "M\u00E1scara", icon: FileText },
    { id: "testes", label: "Testes", icon: Terminal },
    { id: "ping99", label: "Ping 99", icon: Wifi },
  ];

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <MapPin className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm text-sidebar-foreground">{"Consulta Lot\u00E9ricas"}</span>
            <span className="text-[10px] text-sidebar-foreground/50">{"Gest\u00E3o de unidades"}</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{"Navega\u00E7\u00E3o"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/" end activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                    <Search className="mr-2 h-4 w-4" />
                    <span>Dashboard</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {shouldShowLotericaTabs && (
          <SidebarGroup>
            <SidebarGroupLabel>{"Lot\u00E9rica"}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {lotericaTabs.map((tab) => (
                  <SidebarMenuItem key={tab.id}>
                    <SidebarMenuButton
                      onClick={() => setLotericaTab(tab.id)}
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

        {isDashboardRoute && (
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
        )}

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>{"Administra\u00E7\u00E3o"}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/admin" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                      <Users className="mr-2 h-4 w-4" />
                      <span>{"Gerenciar Usu\u00E1rios"}</span>
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
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{profile?.name}</p>
            <p className="text-[10px] text-sidebar-foreground/50">{profile?.user_code || "Usu\u00E1rio"}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={signOut} title="Sair">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
