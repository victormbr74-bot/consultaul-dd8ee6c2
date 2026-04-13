import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";

export interface TacacsCredentials {
  username: string;
  password: string;
}

interface TacacsCredentialsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (credentials: TacacsCredentials) => void;
  loading?: boolean;
  pageLabel?: string;
}

const TacacsCredentialsDialog = ({
  open,
  onOpenChange,
  onSubmit,
  loading = false,
  pageLabel = "Ping",
}: TacacsCredentialsDialogProps) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!username.trim() || !password.trim()) return;
      onSubmit({ username: username.trim(), password: password.trim() });
    },
    [username, password, onSubmit],
  );

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setUsername("");
        setPassword("");
      }
      onOpenChange(next);
    },
    [onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Credenciais TACACS
            </DialogTitle>
            <DialogDescription>
              Informe seu usuario e senha TACACS para executar o {pageLabel} via backend.
              O token muda a cada minuto.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="tacacs-user">Usuario TACACS</Label>
              <Input
                id="tacacs-user"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="seu.usuario"
                disabled={loading}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tacacs-pass">Senha / Token</Label>
              <Input
                id="tacacs-pass"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Token atual"
                disabled={loading}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !username.trim() || !password.trim()}
            >
              {loading ? "Executando..." : "Executar Ping"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TacacsCredentialsDialog;
