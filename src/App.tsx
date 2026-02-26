import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SidebarActionsProvider } from "@/contexts/SidebarActionsContext";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import ThemeHeaderActions from "@/components/ThemeHeaderActions";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import LotericaDetail from "./pages/LotericaDetail";
import AdminPanel from "./pages/AdminPanel";
import ChangePassword from "./pages/ChangePassword";
import Appearance from "./pages/Appearance";
import AlarmeDashboard from "@/pages/alarmes/AlarmeDashboard";
import PrincipalOEMP from "@/pages/alarmes/PrincipalOEMP";
import PrincipalOI from "@/pages/alarmes/PrincipalOI";
import Backup4G from "@/pages/alarmes/Backup4G";
import BackupSencinet from "@/pages/alarmes/BackupSencinet";
import Desempenho from "@/pages/alarmes/Desempenho";
import AgenciaIntegradorModule from "@/agencia-integrador/AgenciaIntegradorModule";
import AgenciaIntegradorLayout from "@/agencia-integrador/AgenciaIntegradorLayout";
import IntegradorDashboardPage from "@/agencia-integrador/pages/Dashboard";
import IntegradorConsultaAgenciaPage from "@/agencia-integrador/pages/ConsultaAgencia";
import IntegradorMeusCasosPage from "@/agencia-integrador/pages/MeusCasos";
import IntegradorAgenciasPage from "@/agencia-integrador/pages/Agencias";
import IntegradorParceirasPage from "@/agencia-integrador/pages/Parceiras";
import IntegradorTopologiaPage from "@/agencia-integrador/pages/Topologia";
import IntegradorCodigosEncerramentoPage from "@/agencia-integrador/pages/CodigosEncerramento";
import IntegradorImportarExcelPage from "@/agencia-integrador/pages/ImportarExcel";
import IntegradorUsuariosPage from "@/agencia-integrador/pages/Usuarios";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

const AdminOnlyRoute = ({ children }: { children: React.ReactNode }) => {
  const { loading, isAdmin } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const AppLayout = ({ children }: { children?: React.ReactNode }) => {
  return (
    <SidebarActionsProvider>
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col">
            <header className="sticky top-0 z-50 h-12 border-b bg-background/80 backdrop-blur-sm flex items-center px-4">
              <SidebarTrigger />
              <div className="ml-auto">
                <ThemeHeaderActions />
              </div>
            </header>
            <main className="flex-1">{children ?? <Outlet />}</main>
          </div>
        </div>
      </SidebarProvider>
    </SidebarActionsProvider>
  );
};

const ProtectedLayout = () => (
  <ProtectedRoute>
    <AppLayout />
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <Routes>
              <Route path="/auth" element={<AuthRoute><AuthPage /></AuthRoute>} />
              <Route element={<ProtectedLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/loterica/:codUl" element={<LotericaDetail />} />
                <Route
                  path="/agencia-integrador"
                  element={
                    <AdminOnlyRoute>
                      <AgenciaIntegradorModule />
                    </AdminOnlyRoute>
                  }
                >
                  <Route element={<AgenciaIntegradorLayout />}>
                    <Route index element={<IntegradorDashboardPage />} />
                    <Route path="consulta" element={<IntegradorConsultaAgenciaPage />} />
                    <Route path="meus-casos" element={<IntegradorMeusCasosPage />} />
                    <Route path="agencias" element={<IntegradorAgenciasPage />} />
                    <Route path="parceiras" element={<IntegradorParceirasPage />} />
                    <Route path="topologia" element={<IntegradorTopologiaPage />} />
                    <Route path="codigos" element={<IntegradorCodigosEncerramentoPage />} />
                    <Route path="importar" element={<IntegradorImportarExcelPage />} />
                    <Route path="usuarios" element={<IntegradorUsuariosPage />} />
                  </Route>
                </Route>
                <Route path="/alarmes" element={<AdminOnlyRoute><AlarmeDashboard /></AdminOnlyRoute>} />
                <Route path="/alarmes/principal/oemp" element={<AdminOnlyRoute><PrincipalOEMP /></AdminOnlyRoute>} />
                <Route path="/alarmes/principal/oi" element={<AdminOnlyRoute><PrincipalOI /></AdminOnlyRoute>} />
                <Route path="/alarmes/backup/4g" element={<AdminOnlyRoute><Backup4G /></AdminOnlyRoute>} />
                <Route path="/alarmes/backup/sencinet" element={<AdminOnlyRoute><BackupSencinet /></AdminOnlyRoute>} />
                <Route path="/alarmes/desempenho" element={<AdminOnlyRoute><Desempenho /></AdminOnlyRoute>} />
                <Route path="/admin" element={<Navigate to="/admin/dados" replace />} />
                <Route path="/admin/dados" element={<AdminPanel section="data" />} />
                <Route path="/admin/usuarios" element={<AdminPanel section="users" />} />
                <Route path="/senha" element={<ChangePassword />} />
                <Route path="/aparencia" element={<Appearance />} />
                <Route path="/temas" element={<Appearance />} />
              </Route>
            </Routes>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
