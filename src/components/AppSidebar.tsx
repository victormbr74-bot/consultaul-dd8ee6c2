import { MapPin, Search, FileText, Terminal, Wifi, LogOut, User, Users, Download, Upload } from "lucide-react";
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
  const { isAdmin, profile, signOut } = useAuth();
  const { onExport, onImportClick, lotericaTab, setLotericaTab, showLotericaTabs } = useSidebarActions();

  const lotericaTabs = [
    { id: "consulta", label: "Consulta", icon: Search },
    { id: "mascara", label: "Máscara", icon: FileText },
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
            <span className="font-bold text-sm text-sidebar-foreground">Consulta Lotéricas</span>
            <span className="text-[10px] text-sidebar-foreground/50">Gestão de unidades</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
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

        {showLotericaTabs && (
          <SidebarGroup>
            <SidebarGroupLabel>Lotérica</SidebarGroupLabel>
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

        <SidebarGroup>
          <SidebarGroupLabel>Dados</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {onImportClick && (
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={onImportClick}>
                    <Upload className="mr-2 h-4 w-4" />
                    <span>Importar</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {onExport && (
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={onExport}>
                    <Download className="mr-2 h-4 w-4" />
                    <span>Exportar</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administração</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/admin" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                      <Users className="mr-2 h-4 w-4" />
                      <span>Gerência de Usuários</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center">
            <User className="w-4 h-4 text-sidebar-accent-foreground" />
          </div>
          <div className="flex-1 min-w-0">
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
