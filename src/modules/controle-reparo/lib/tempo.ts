export interface FaixaInfo {
  horas: number;
  key: string;
  label: string;
  badgeClass: string;
}

export const FAIXAS = [
  { key: "critico", label: "Acima de 1000h", min: 1000, badgeClass: "bg-faixa-critico text-faixa-critico-foreground" },
  { key: "alto", label: "500h a 1000h", min: 500, badgeClass: "bg-faixa-alto text-faixa-alto-foreground" },
  { key: "medio", label: "300h a 500h", min: 300, badgeClass: "bg-faixa-medio text-faixa-medio-foreground" },
  { key: "atencao", label: "100h a 300h", min: 100, badgeClass: "bg-faixa-atencao text-faixa-atencao-foreground" },
  { key: "moderado", label: "48h a 100h", min: 48, badgeClass: "bg-faixa-moderado text-faixa-moderado-foreground" },
  { key: "baixo", label: "24h a 48h", min: 24, badgeClass: "bg-faixa-baixo text-faixa-baixo-foreground" },
  { key: "ok", label: "Até 24h", min: 0, badgeClass: "bg-faixa-ok text-faixa-ok-foreground" },
] as const;

export function computeHoras(
  dataInicial: string | null,
  duracaoH: number | null,
): number {
  if (duracaoH != null && !isNaN(duracaoH)) return duracaoH;
  if (dataInicial) {
    const start = new Date(dataInicial).getTime();
    if (!isNaN(start)) return Math.max(0, (Date.now() - start) / 3600000);
  }
  return 0;
}

export function faixaFromHoras(horas: number): (typeof FAIXAS)[number] {
  for (const f of FAIXAS) {
    if (horas >= f.min) return f;
  }
  return FAIXAS[FAIXAS.length - 1];
}

export function getFaixa(
  dataInicial: string | null,
  duracaoH: number | null,
): FaixaInfo {
  const horas = computeHoras(dataInicial, duracaoH);
  const f = faixaFromHoras(horas);
  return { horas, key: f.key, label: f.label, badgeClass: f.badgeClass };
}

export function formatHoras(horas: number): string {
  if (horas >= 1000) return `${Math.round(horas).toLocaleString("pt-BR")}h`;
  return `${Math.round(horas)}h`;
}

/** Dias em aberto a partir da Data e Hora Inicial (item 17). */
export function computeDias(dataInicial: string | null): number | null {
  if (!dataInicial) return null;
  const start = new Date(dataInicial).getTime();
  if (isNaN(start)) return null;
  return Math.max(0, Math.floor((Date.now() - start) / 86400000));
}

export interface AlertaDias {
  key: string;
  label: string;
  badgeClass: string;
}

/** Faixas de alerta visual por dias em tratativa (item 18). */
export const ALERTAS_DIAS = [
  { key: "d365", min: 365, label: "+365 dias", badgeClass: "bg-faixa-critico text-faixa-critico-foreground" },
  { key: "d180", min: 180, label: "+180 dias", badgeClass: "bg-faixa-alto text-faixa-alto-foreground" },
  { key: "d90", min: 90, label: "+90 dias", badgeClass: "bg-faixa-medio text-faixa-medio-foreground" },
  { key: "d60", min: 60, label: "+60 dias", badgeClass: "bg-faixa-atencao text-faixa-atencao-foreground" },
  { key: "d30", min: 30, label: "+30 dias", badgeClass: "bg-faixa-moderado text-faixa-moderado-foreground" },
] as const;

export function getAlertaDias(dias: number | null): AlertaDias | null {
  if (dias == null) return null;
  for (const a of ALERTAS_DIAS) {
    if (dias >= a.min) return a;
  }
  return null;
}

/** Formata uma data ISO como dd/MM/yyyy HH:mm:ss (item 10). */
export function formatDataHora(iso: string | null): string {
  return formatDateTimeBR(iso);
}
import { formatDateTimeBR } from "./date";
