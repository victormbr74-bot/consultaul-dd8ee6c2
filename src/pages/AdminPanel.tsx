import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Users, Shield } from "lucide-react";

const AdminPanel = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) { navigate("/"); return; }
    fetchUsers();
  }, [isAdmin]);

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles").select("*");
    const { data: roles } = await supabase.from("user_roles").select("*");

    const merged = (profiles || []).map(p => ({
      ...p,
      role: roles?.find(r => r.user_id === p.id)?.role || "user",
    }));
    setUsers(merged);
    setLoading(false);
  };

  const updateRole = async (userId: string, newRole: string) => {
    // Delete existing roles and insert new one
    await supabase.from("user_roles").delete().eq("user_id", userId);
    await supabase.from("user_roles").insert({ user_id: userId, role: newRole as any });
    fetchUsers();
  };

  const toggleActive = async (userId: string, active: boolean) => {
    await supabase.from("profiles").update({ active: !active }).eq("id", userId);
    fetchUsers();
  };

  if (!isAdmin) return null;

  return (
    <div className="bg-background">
      <main className="container px-4 py-6 max-w-4xl">
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" /> Usuários ({users.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium text-muted-foreground">Nome</th>
                    <th className="text-left p-3 font-medium text-muted-foreground hidden sm:table-cell">Código</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Papel</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Carregando...</td></tr>
                  ) : users.map(u => (
                    <tr key={u.id} className="border-b">
                      <td className="p-3 font-medium">{u.name}</td>
                      <td className="p-3 font-mono text-xs hidden sm:table-cell">{u.user_code || "-"}</td>
                      <td className="p-3">
                        <Select defaultValue={u.role} onValueChange={val => updateRole(u.id, val)}>
                          <SelectTrigger className="w-28 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="user">Usuário</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3">
                        <Badge variant={u.active ? "default" : "destructive"} className="text-xs">
                          {u.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Button variant="outline" size="sm" onClick={() => toggleActive(u.id, u.active)}>
                          {u.active ? "Desativar" : "Ativar"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminPanel;
