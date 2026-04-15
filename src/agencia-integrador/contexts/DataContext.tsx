import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/agencia-integrador/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Agencia, CodEncerramento, ImportLog, Incidente, MeuCaso, Parceira, Topologia } from '@/agencia-integrador/types';
import {
  addImportLogDb,
  addNotaMeuCasoDb,
  createMeuCasoDb,
  fetchAppDataSnapshot,
  fetchMeusCasosByUserNames,
  replaceAgencias as replaceAgenciasDb,
  replaceCodEncerramento as replaceCodEncerramentoDb,
  replaceIncidentes as replaceIncidentesDb,
  replaceParceiras as replaceParceirasDb,
  replaceTopologia as replaceTopologiaDb,
  updateMeuCasoStatusDb,
} from '@/agencia-integrador/lib/dataStore';

interface DataContextType {
  incidentes: Incidente[];
  agencias: Agencia[];
  parceiras: Parceira[];
  topologia: Topologia[];
  codEncerramento: CodEncerramento[];
  meusCasos: MeuCaso[];
  importLogs: ImportLog[];
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  refreshMeusCasos: () => Promise<void>;
  replaceIncidentes: (data: Incidente[]) => Promise<void>;
  replaceAgencias: (data: Agencia[]) => Promise<void>;
  replaceParceiras: (data: Parceira[]) => Promise<void>;
  replaceTopologia: (data: Topologia[]) => Promise<void>;
  replaceCodEncerramento: (data: CodEncerramento[]) => Promise<void>;
  addImportLog: (log: Omit<ImportLog, 'id' | 'dataHora'>) => Promise<void>;
  createMeuCaso: (caso: MeuCaso) => Promise<MeuCaso>;
  addNotaMeuCaso: (casoId: string, nota: string) => Promise<void>;
  updateMeuCasoStatus: (casoId: string, status: MeuCaso['statusCaso']) => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);

function buildUserIdentifiers(profile: { full_name?: string | null; username?: string | null; employee_id?: string | null } | null, email?: string | null) {
  const identifiers = new Set<string>();
  const push = (value?: string | null) => {
    if (!value) return;
    const normalized = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
    if (normalized) identifiers.add(normalized);
  };

  const splitTokens = (value?: string | null) =>
    (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  push(profile?.full_name);
  push(profile?.username);
  push(profile?.employee_id);

  const nameTokens = splitTokens(profile?.full_name).filter((t) => t.length > 2 && !['da', 'de', 'do', 'das', 'dos', 'e'].includes(t));
  const first = nameTokens[0];
  const last = nameTokens[nameTokens.length - 1];
  if (first && last) {
    push(`${first} ${last}`);
    push(`${first}.${last}`);
    push(`${first}${last}`);
    push(`${first[0]}${last[0]}`);
  }
  if (nameTokens.length) {
    push(nameTokens.map((t) => t[0]).join(''));
    nameTokens.forEach((t) => push(t));
  }

  const usernameTokens = splitTokens((profile?.username ?? '').replace(/[._-]/g, ' '));
  if (usernameTokens.length) {
    push(usernameTokens.join(' '));
    push(usernameTokens.join('.'));
    push(usernameTokens.join(''));
    push(usernameTokens.map((t) => t[0]).join(''));
    usernameTokens.forEach((t) => push(t));
  }

  if (email) {
    push(email);
    push(email.split('@')[0]);
  }

  return Array.from(identifiers);
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { profile, user } = useAuth();
  const [incidentes, setIncidentes] = useState<Incidente[]>([]);
  const [agencias, setAgencias] = useState<Agencia[]>([]);
  const [parceiras, setParceiras] = useState<Parceira[]>([]);
  const [topologia, setTopologia] = useState<Topologia[]>([]);
  const [codEncerramento, setCodEncerramento] = useState<CodEncerramento[]>([]);
  const [meusCasos, setMeusCasos] = useState<MeuCaso[]>([]);
  const [importLogs, setImportLogs] = useState<ImportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initializedRef = useRef(false);

  const userIdentifiers = useMemo(
    () => buildUserIdentifiers(profile, user?.email ?? null),
    [profile, user?.email],
  );

  const refreshMeusCasos = useCallback(async () => {
    try {
      const data = await fetchMeusCasosByUserNames(userIdentifiers);
      setMeusCasos(data);
    } catch (err) {
      console.error('Erro ao carregar meus casos:', err);
      setError((err as Error)?.message || String(err));
      setMeusCasos([]);
    }
  }, [userIdentifiers]);

  const refreshData = useCallback(async () => {
    try {
      setError(null);
      const snapshot = await fetchAppDataSnapshot();
      setIncidentes(snapshot.incidentes);
      setAgencias(snapshot.agencias);
      setParceiras(snapshot.parceiras);
      setTopologia(snapshot.topologia);
      setCodEncerramento(snapshot.codEncerramento);
      setImportLogs(snapshot.importLogs);
      const meus = await fetchMeusCasosByUserNames(userIdentifiers);
      setMeusCasos(meus);
    } catch (err) {
      console.error('Erro ao carregar dados do sistema:', err);
      setError((err as Error)?.message || String(err));
    } finally {
      setLoading(false);
      initializedRef.current = true;
    }
  }, [userIdentifiers]);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  useEffect(() => {
    if (!initializedRef.current) return;
    void refreshMeusCasos();
  }, [refreshMeusCasos]);

  const replaceIncidentes = useCallback(async (data: Incidente[]) => {
    await replaceIncidentesDb(data);
    setIncidentes(data);
  }, []);

  const replaceAgencias = useCallback(async (data: Agencia[]) => {
    await replaceAgenciasDb(data);
    setAgencias(data);
  }, []);

  const replaceParceiras = useCallback(async (data: Parceira[]) => {
    await replaceParceirasDb(data);
    setParceiras(data);
  }, []);

  const replaceTopologia = useCallback(async (data: Topologia[]) => {
    await replaceTopologiaDb(data);
    setTopologia(data);
  }, []);

  const replaceCodEncerramento = useCallback(async (data: CodEncerramento[]) => {
    await replaceCodEncerramentoDb(data);
    setCodEncerramento(data);
  }, []);

  const addImportLog = useCallback(async (log: Omit<ImportLog, 'id' | 'dataHora'>) => {
    const inserted = await addImportLogDb(log);
    setImportLogs((prev) => [inserted, ...prev]);
  }, []);

  const createMeuCaso = useCallback(async (caso: MeuCaso) => {
    const created = await createMeuCasoDb(caso);
    setMeusCasos((prev) => {
      const withoutSameChamado = prev.filter((c) => c.incidenteChamado !== created.incidenteChamado);
      return [created, ...withoutSameChamado];
    });
    return created;
  }, []);

  const addNotaMeuCaso = useCallback(async (casoId: string, nota: string) => {
    const updated = await addNotaMeuCasoDb(casoId, nota);
    setMeusCasos((prev) => prev.map((c) => (c.id === casoId ? updated : c)));
  }, []);

  const updateMeuCasoStatus = useCallback(async (casoId: string, status: MeuCaso['statusCaso']) => {
    const updated = await updateMeuCasoStatusDb(casoId, status);
    setMeusCasos((prev) => prev.map((c) => (c.id === casoId ? updated : c)));
  }, []);

  return (
    <DataContext.Provider
      value={{
        incidentes,
        agencias,
        parceiras,
        topologia,
        codEncerramento,
        meusCasos,
        importLogs,
        loading,
        error,
        refreshData,
        refreshMeusCasos,
        replaceIncidentes,
        replaceAgencias,
        replaceParceiras,
        replaceTopologia,
        replaceCodEncerramento,
        addImportLog,
        createMeuCaso,
        addNotaMeuCaso,
        updateMeuCasoStatus,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
