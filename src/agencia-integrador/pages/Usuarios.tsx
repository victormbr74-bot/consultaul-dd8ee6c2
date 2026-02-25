/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Loader2, Pencil, RefreshCcw, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/agencia-integrador/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type DbClient = any;
type AppRole = 'admin' | 'operacao' | 'leitura';

type UserAdminRow = {
  userId: string;
  profileId: string;
  fullName: string;
  employeeId: string;
  username: string;
  email: string;
  isActive: boolean;
  role: AppRole;
  createdAt: string;
};

type UserForm = {
  fullName: string;
  employeeId: string;
  username: string;
  email: string;
  password: string;
  role: AppRole;
};

const EMPTY_FORM: UserForm = {
  fullName: '',
  employeeId: '',
  username: '',
  email: '',
  password: '',
  role: 'operacao',
};

const db = supabase as DbClient;

function getRolePriority(role: string): number {
  if (role === 'admin') return 3;
  if (role === 'operacao') return 2;
  return 1;
}

function normalizeUsername(value: string) {
  return value.trim();
}

export default function Usuarios() {
  const { role, profile } = useAuth();
  const [users, setUsers] = useState<UserAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);

  const isAdmin = role === 'admin';
  const isEditing = !!editingUserId;

  const secondaryAuthClient = useMemo(() => {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
    if (!url || !key) return null;
    return createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }) as DbClient;
  }, []);

  const loadUsers = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [profilesRes, rolesRes] = await Promise.all([
        db
          .from('profiles')
          .select('id, user_id, full_name, employee_id, username, email, is_active, created_at')
          .order('created_at', { ascending: false }),
        db.from('user_roles').select('user_id, role'),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;

      const roleMap = new Map<string, AppRole>();
      for (const row of (rolesRes.data ?? []) as Array<{ user_id: string; role: AppRole }>) {
        const current = roleMap.get(row.user_id);
        if (!current || getRolePriority(row.role) > getRolePriority(current)) {
          roleMap.set(row.user_id, row.role);
        }
      }

      const mapped: UserAdminRow[] = ((profilesRes.data ?? []) as any[]).map((p) => ({
        userId: String(p.user_id),
        profileId: String(p.id),
        fullName: String(p.full_name ?? ''),
        employeeId: String(p.employee_id ?? ''),
        username: String(p.username ?? ''),
        email: String(p.email ?? ''),
        isActive: p.is_active !== false,
        role: (roleMap.get(String(p.user_id)) ?? 'leitura') as AppRole,
        createdAt: String(p.created_at ?? ''),
      }));

      setUsers(mapped);
    } catch (error) {
      toast.error(`Erro ao carregar usuarios: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingUserId(null);
  };

  const upsertSingleRole = async (userId: string, nextRole: AppRole) => {
    const delRes = await db.from('user_roles').delete().eq('user_id', userId);
    if (delRes.error) throw delRes.error;

    const insertRes = await db.from('user_roles').insert({ user_id: userId, role: nextRole });
    if (insertRes.error) throw insertRes.error;
  };

  const handleCreate = async () => {
    if (!secondaryAuthClient) {
      toast.error('Configuração do Supabase indisponível');
      return;
    }
    if (!form.fullName.trim()) {
      toast.error('Informe o nome do usuario');
      return;
    }
    if (!form.password.trim()) {
      toast.error('Informe a senha inicial');
      return;
    }

    const email = form.email.trim() || (form.employeeId.trim() ? `${form.employeeId.trim()}@admin.com` : '');
    if (!email) {
      toast.error('Informe e-mail ou ID para gerar o login');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await secondaryAuthClient.auth.signUp({
        email,
        password: form.password,
        options: {
          data: { full_name: form.fullName.trim() },
        },
      });
      if (error) throw error;

      const userId = data?.user?.id;
      if (!userId) {
        throw new Error('Nao foi possivel obter o ID do usuario criado. Verifique confirmacao por e-mail.');
      }

      const updateRes = await db
        .from('profiles')
        .update({
          full_name: form.fullName.trim(),
          employee_id: form.employeeId.trim() || null,
          username: normalizeUsername(form.username) || null,
          email,
          is_active: true,
        })
        .eq('user_id', userId);

      if (updateRes.error) throw updateRes.error;

      await upsertSingleRole(userId, form.role);

      toast.success('Usuario cadastrado');
      resetForm();
      await loadUsers();
    } catch (error) {
      toast.error(`Erro ao cadastrar usuario: ${String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingUserId) return;
    setSaving(true);
    try {
      const target = users.find((u) => u.userId === editingUserId);
      if (!target) throw new Error('Usuario nao encontrado');

      const updateRes = await db
        .from('profiles')
        .update({
          full_name: form.fullName.trim(),
          employee_id: form.employeeId.trim() || null,
          username: normalizeUsername(form.username) || null,
          is_active: target.isActive,
        })
        .eq('user_id', editingUserId);
      if (updateRes.error) throw updateRes.error;

      await upsertSingleRole(editingUserId, form.role);

      toast.success('Usuario atualizado');
      resetForm();
      await loadUsers();
    } catch (error) {
      toast.error(`Erro ao atualizar usuario: ${String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDisable = async (userRow: UserAdminRow) => {
    if (!confirm(`Desativar usuario ${userRow.fullName || userRow.email}?`)) return;
    try {
      const { error } = await db
        .from('profiles')
        .update({ is_active: false })
        .eq('user_id', userRow.userId);
      if (error) throw error;
      toast.success('Usuario desativado');
      await loadUsers();
    } catch (error) {
      toast.error(`Erro ao desativar usuario: ${String(error)}`);
    }
  };

  const handleEnable = async (userRow: UserAdminRow) => {
    try {
      const { error } = await db
        .from('profiles')
        .update({ is_active: true })
        .eq('user_id', userRow.userId);
      if (error) throw error;
      toast.success('Usuario reativado');
      await loadUsers();
    } catch (error) {
      toast.error(`Erro ao reativar usuario: ${String(error)}`);
    }
  };

  const handleMakeAdmin = async (userRow: UserAdminRow) => {
    try {
      await upsertSingleRole(userRow.userId, 'admin');
      toast.success('Usuario promovido para admin');
      await loadUsers();
    } catch (error) {
      toast.error(`Erro ao promover usuario: ${String(error)}`);
    }
  };

  const startEdit = (userRow: UserAdminRow) => {
    setEditingUserId(userRow.userId);
    setForm({
      fullName: userRow.fullName,
      employeeId: userRow.employeeId,
      username: userRow.username,
      email: userRow.email,
      password: '',
      role: userRow.role,
    });
  };

  if (!isAdmin) {
    return (
      <Card className="border-border">
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Acesso restrito a administradores.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usuarios</h1>
          <p className="text-sm text-muted-foreground">Gerenciamento de cadastro, perfil e permissao administrativa.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void loadUsers()} disabled={loading}>
          <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <Card className="border-border">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">
            {isEditing ? 'Editar usuario' : 'Cadastrar usuario'}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nome completo</Label>
              <Input
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                placeholder="Nome do usuario"
              />
            </div>
            <div className="space-y-1.5">
              <Label>ID (employee_id)</Label>
              <Input
                value={form.employeeId}
                onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}
                placeholder="418118"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Username</Label>
              <Input
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="nome.sobrenome"
              />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="Opcional (usa ID@admin.com se vazio)"
                disabled={isEditing}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{isEditing ? 'Senha' : 'Senha inicial'}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder={isEditing ? 'Alteracao de senha nao suportada aqui' : 'Senha temporaria'}
                disabled={isEditing}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Perfil</Label>
              <Select value={form.role} onValueChange={(value) => setForm((f) => ({ ...f, role: value as AppRole }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operacao">operacao</SelectItem>
                  <SelectItem value="leitura">leitura</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => void (isEditing ? handleUpdate() : handleCreate())} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : isEditing ? <Pencil className="h-4 w-4 mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
              {isEditing ? 'Salvar edicao' : 'Cadastrar'}
            </Button>
            {isEditing && (
              <Button variant="secondary" onClick={resetForm} disabled={saving}>
                Cancelar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border overflow-hidden">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm text-muted-foreground">{users.length} usuario(s)</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-xs">Nome</TableHead>
                <TableHead className="text-xs">ID</TableHead>
                <TableHead className="text-xs">Username</TableHead>
                <TableHead className="text-xs">E-mail</TableHead>
                <TableHead className="text-xs">Role</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                    Carregando usuarios...
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    Nenhum usuario encontrado
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.userId} className="border-border">
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-2">
                        <span>{u.fullName || '-'}</span>
                        {u.employeeId && u.employeeId === profile?.employee_id && (
                          <Badge variant="outline" className="text-[10px]">voce</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{u.employeeId || '-'}</TableCell>
                    <TableCell className="text-xs">{u.username || '-'}</TableCell>
                    <TableCell className="text-xs">{u.email || '-'}</TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className={u.role === 'admin' ? 'border-primary/40 text-primary' : ''}>
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className={u.isActive ? 'border-success/40 text-success' : 'border-destructive/40 text-destructive'}>
                        {u.isActive ? 'Ativo' : 'Desativado'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="secondary" onClick={() => startEdit(u)}>
                          <Pencil className="h-3 w-3 mr-1" /> Editar
                        </Button>
                        {u.role !== 'admin' && (
                          <Button size="sm" variant="secondary" onClick={() => void handleMakeAdmin(u)}>
                            <ShieldCheck className="h-3 w-3 mr-1" /> Tornar ADM
                          </Button>
                        )}
                        {u.isActive ? (
                          <Button size="sm" variant="destructive" onClick={() => void handleDisable(u)}>
                            <Trash2 className="h-3 w-3 mr-1" /> Excluir
                          </Button>
                        ) : (
                          <Button size="sm" variant="secondary" onClick={() => void handleEnable(u)}>
                            Reativar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
