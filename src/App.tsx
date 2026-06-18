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
import AppErrorBoundary from "@/components/AppErrorBoundary";
import ThemeHeaderActions from "@/components/ThemeHeaderActions";
import HeaderConsultaSearch from "@/components/HeaderConsultaSearch";
import PendingChangeRequestsAlert from "@/components/PendingChangeRequestsAlert";
import UserRequestsStatusAlert from "@/components/UserRequestsStatusAlert";
import RouterConfigReminderAlert from "@/components/RouterConfigReminderAlert";
import { supabaseConfigError } from "@/integrations/supabase/client";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import ConsultaMassa from "./pages/ConsultaMassa";
import ConsultaMac from "./pages/ConsultaMac";
import Ping99 from "./pages/Ping99";
import Pingao from "./pages/Pingao";
import PingaoNat from "./pages/PingaoNat";
import PingaoRota from "./pages/PingaoRota";
import TextCompare from "./pages/TextCompare";
import Validacao from "./pages/Validacao";
import LotericaDetail from "./pages/LotericaDetail";
import LotericaCreate from "./pages/LotericaCreate";
import AdminPanel from "./pages/AdminPanel";
import ChangePassword from "./pages/ChangePassword";
import Appearance from "./pages/Appearance";
import AlarmeDashboard from "@/pages/alarmes/AlarmeDashboard";
import BaseDashImportPage from "@/pages/alarmes/BaseDashImportPage";
import PrincipalDashboard from "@/pages/alarmes/PrincipalDashboard";
import PrincipalOEMP from "@/pages/alarmes/PrincipalOEMP";
import PrincipalOI from "@/pages/alarmes/PrincipalOI";
import BackupDashboard from "@/pages/alarmes/BackupDashboard";
import Backup4G from "@/pages/alarmes/Backup4G";
import BackupSencinet from "@/pages/alarmes/BackupSencinet";
import Desempenho from "@/pages/alarmes/Desempenho";
import ImportNatIps from "./pages/ImportNatIps";
import RouterConfigsReport from "./pages/RouterConfigsReport";
import KnowledgeBase from "./pages/KnowledgeBase";
import ProjectModuleFrame from "./pages/ProjectModuleFrame";


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
        <div className="min-h-screen flex w-full overflow-hidden">
          <AppSidebar />
          <div className="flex-1 min-h-0 min-w-0 flex flex-col">
            <header className="sticky top-0 z-50 h-12 shrink-0 border-b bg-background/80 backdrop-blur-sm flex items-center gap-3 px-4">
              <SidebarTrigger />
              <div className="flex-1 flex justify-center items-center gap-2 min-w-0">
                <HeaderConsultaSearch />
                <PendingChangeRequestsAlert />
                <UserRequestsStatusAlert />
                <RouterConfigReminderAlert />
              </div>
              <ThemeHeaderActions />
            </header>
            <main className="min-h-0 flex-1 min-w-0 overflow-hidden">{children ?? <Outlet />}</main>
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
  <AppErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {supabaseConfigError && (
          <div className="bg-destructive text-destructive-foreground text-xs text-center py-2 px-3">
            {supabaseConfigError}
          </div>
        )}
        <BrowserRouter>
          <ThemeProvider>
            <AuthProvider>
              <Routes>
                <Route path="/auth" element={<AuthRoute><AuthPage /></AuthRoute>} />
                <Route element={<ProtectedLayout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/consulta-massa" element={<ConsultaMassa />} />
                  <Route path="/consulta-mac" element={<ConsultaMac />} />
                  <Route path="/ping99" element={<Ping99 />} />
                  <Route path="/pingao" element={<Pingao />} />
                  <Route path="/pingao-nat" element={<PingaoNat />} />
                  <Route path="/pingao-rota" element={<PingaoRota />} />
                  <Route path="/validacao" element={<Validacao />} />
                  <Route path="/comparar-texto" element={<TextCompare />} />
                  <Route path="/loterica/cadastrar" element={<LotericaCreate />} />
                  <Route path="/loterica/:codUl" element={<LotericaDetail />} />
                  <Route path="/alarmes" element={<AdminOnlyRoute><AlarmeDashboard /></AdminOnlyRoute>} />
                  <Route path="/alarmes/base-dash" element={<AdminOnlyRoute><BaseDashImportPage /></AdminOnlyRoute>} />
                  <Route path="/alarmes/principal" element={<AdminOnlyRoute><PrincipalDashboard /></AdminOnlyRoute>} />
                  <Route path="/alarmes/principal/oemp" element={<AdminOnlyRoute><PrincipalOEMP /></AdminOnlyRoute>} />
                  <Route path="/alarmes/principal/oi" element={<AdminOnlyRoute><PrincipalOI /></AdminOnlyRoute>} />
                  <Route path="/alarmes/backup" element={<AdminOnlyRoute><BackupDashboard /></AdminOnlyRoute>} />
                  <Route path="/alarmes/backup/4g" element={<AdminOnlyRoute><Backup4G /></AdminOnlyRoute>} />
                  <Route path="/alarmes/backup/sencinet" element={<AdminOnlyRoute><BackupSencinet /></AdminOnlyRoute>} />
                  <Route path="/alarmes/desempenho" element={<AdminOnlyRoute><Desempenho /></AdminOnlyRoute>} />
                  <Route path="/admin" element={<Navigate to="/admin/dados" replace />} />
                  <Route path="/admin/dados" element={<AdminPanel section="data" />} />
                  <Route path="/admin/usuarios" element={<AdminPanel section="users" />} />
                  <Route path="/admin/import-nat" element={<ImportNatIps />} />
                  <Route path="/relatorio-roteador" element={<RouterConfigsReport />} />
                  <Route path="/base-conhecimento" element={<KnowledgeBase />} />
                  <Route path="/projetos/:projectId/:itemId" element={<ProjectModuleFrame />} />
                  <Route path="/senha" element={<ChangePassword />} />
                  <Route path="/aparencia" element={<Appearance />} />
                  <Route path="/temas" element={<Appearance />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AuthProvider>
          </ThemeProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </AppErrorBoundary>
);

export default App;
