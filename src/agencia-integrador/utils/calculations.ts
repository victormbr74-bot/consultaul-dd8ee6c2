export function calcHorasDesde(data: Date, agora: Date = new Date()): number {
  const diff = agora.getTime() - data.getTime();
  return Math.round((diff / 3600000) * 100) / 100;
}

export function formatHoras(horas: number): string {
  if (horas < 1) return `${Math.round(horas * 60)}min`;
  if (horas < 24) return `${horas.toFixed(1)}h`;
  const dias = Math.floor(horas / 24);
  const hrs = Math.round(horas % 24);
  return `${dias}d ${hrs}h`;
}

export function formatDataHora(data: Date): string {
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
