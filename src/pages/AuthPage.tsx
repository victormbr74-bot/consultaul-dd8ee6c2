import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { TEMP_LOGIN_RETURN_AT } from "@/lib/temporaryAccess";

const normalizeUserCode = (value: string) => value.replace(/\D/g, "");
const buildUserEmail = (userCode: string) => `${userCode}@colaborador.lotericas.com`;

const formatCountdown = (msRemaining: number) => {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds };
};

const AuthPage = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loginId, setLoginId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [redirectCountdown, setRedirectCountdown] = useState(3);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const maintenanceActive = now.getTime() < TEMP_LOGIN_RETURN_AT.getTime();
  const countdown = useMemo(
    () => formatCountdown(TEMP_LOGIN_RETURN_AT.getTime() - now.getTime()),
    [now],
  );

  useEffect(() => {
    if (!maintenanceActive) return;

    setRedirectCountdown(3);
    const timeoutId = window.setTimeout(() => {
      navigate("/", { replace: true });
    }, 3000);
    const intervalId = window.setInterval(() => {
      setRedirectCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [maintenanceActive, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const normalizedLoginId = normalizeUserCode(loginId);
    if (!normalizedLoginId) {
      setError("Informe um ID de usuário válido.");
      setLoading(false);
      return;
    }

    try {
      // Clear any stale session/cache before attempting login
      await supabase.auth.signOut().catch(() => {});

      let email = buildUserEmail(normalizedLoginId);
      const { data, error: fnError } = await supabase.functions.invoke("lookup-user", {
        body: { user_code: normalizedLoginId },
      });

      if (!fnError && data?.email) {
        email = data.email;
      }

      const { error: signInError } = await signIn(email, loginPassword);
      if (signInError) {
        if (signInError.toLowerCase().includes("invalid login credentials")) {
          setError("Usuário ou senha inválidos.");
        } else {
          setError(signInError);
        }
      }
    } catch {
      setError("Erro ao conectar. Tente novamente.");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <MapPin className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Consulta Lotéricas</h1>
          </div>
          <p className="text-muted-foreground text-sm">Sistema de gestão de unidades lotéricas</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-center">
              {maintenanceActive ? "Login temporariamente indisponível" : "Entrar"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {maintenanceActive ? (
              <div className="space-y-4">
                <div className="p-3 rounded-md bg-amber-500/10 text-amber-700 text-sm">
                  A página de login foi removida temporariamente e volta automaticamente em{" "}
                  <strong>27/02/2026</strong>.
                </div>
                <div className="text-center text-sm text-muted-foreground">
                  Redirecionando para consultas em {redirectCountdown}s...
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="rounded-md border p-2">
                    <div className="text-xl font-semibold">{String(countdown.days).padStart(2, "0")}</div>
                    <div className="text-[10px] text-muted-foreground">dias</div>
                  </div>
                  <div className="rounded-md border p-2">
                    <div className="text-xl font-semibold">{String(countdown.hours).padStart(2, "0")}</div>
                    <div className="text-[10px] text-muted-foreground">horas</div>
                  </div>
                  <div className="rounded-md border p-2">
                    <div className="text-xl font-semibold">{String(countdown.minutes).padStart(2, "0")}</div>
                    <div className="text-[10px] text-muted-foreground">min</div>
                  </div>
                  <div className="rounded-md border p-2">
                    <div className="text-xl font-semibold">{String(countdown.seconds).padStart(2, "0")}</div>
                    <div className="text-[10px] text-muted-foreground">seg</div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Retorno previsto: {TEMP_LOGIN_RETURN_AT.toLocaleString("pt-BR")}
                </p>
              </div>
            ) : (
              <>
                {error && <div className="mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>}

                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-id">ID do Usuário</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="login-id"
                        placeholder="Ex: 418118"
                        className="pl-10"
                        value={loginId}
                        onChange={(e) => setLoginId(normalizeUserCode(e.target.value))}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Senha</Label>
                    <Input
                      id="login-password"
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Entrando..." : "Entrar"}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuthPage;
