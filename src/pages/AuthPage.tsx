import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, User } from "lucide-react";

const normalizeUserCode = (value: string) => value.replace(/\D/g, "");
const buildUserEmail = (userCode: string) => `${userCode}@colaborador.lotericas.com`;

const AuthPage = () => {
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loginId, setLoginId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

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
      // Evita manter sessão anterior no mesmo navegador.
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
        } else if (signInError.toLowerCase().includes("failed to fetch")) {
          setError("Falha de rede ao acessar o Supabase. Verifique VPN/proxy/firewall da rede.");
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
            <CardTitle className="text-lg text-center">Entrar</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuthPage;
