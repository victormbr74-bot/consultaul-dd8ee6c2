import { Link, Outlet } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  FileText,
  Handshake,
  LayoutDashboard,
  Network,
  SearchCheck,
  Upload,
  UserCheck,
  Users,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const navLinks = [
  { to: "/agencia-integrador", label: "Dashboard", icon: LayoutDashboard },
  { to: "/agencia-integrador/consulta", label: "Consulta", icon: SearchCheck },
  { to: "/agencia-integrador/meus-casos", label: "Meus Casos", icon: UserCheck },
  { to: "/agencia-integrador/agencias", label: "Agências", icon: Building2 },
  { to: "/agencia-integrador/parceiras", label: "Parceiras", icon: Handshake },
  { to: "/agencia-integrador/topologia", label: "Topologia", icon: Network },
  { to: "/agencia-integrador/codigos", label: "Cód. Enc.", icon: FileText },
  { to: "/agencia-integrador/importar", label: "Importar", icon: Upload },
  { to: "/agencia-integrador/usuarios", label: "Usuários", icon: Users },
];

export default function AgenciaIntegradorLayout() {
  return (
    <div className="bg-background">
      <div className="container max-w-[1600px] px-4 py-6 space-y-4">
        <Card className="border-border/80">
          <CardContent className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tracking-wide text-primary">AGENCIA INTEGRADOR</span>
                <Badge variant="outline" className="text-[10px]">
                  ADM
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Módulo integrado do repositório `conex-o-gil` com lógica preservada.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar para Lotéricas
              </Link>
            </Button>
          </CardContent>
        </Card>

        <div className="rounded-xl border border-border/80 bg-card p-2">
          <div className="flex flex-wrap gap-2">
            {navLinks.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/agencia-integrador"}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md border border-transparent px-3 py-2 text-xs font-medium text-muted-foreground transition-colors",
                  "hover:bg-secondary hover:text-foreground",
                )}
                activeClassName="bg-accent text-accent-foreground border-border"
              >
                <item.icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </div>

        <Outlet />
      </div>
    </div>
  );
}
