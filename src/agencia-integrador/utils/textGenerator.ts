import type { Incidente, Agencia, CodEncerramento } from '@/agencia-integrador/types';
import { formatDataHora } from './calculations';

export function gerarTextoValidacao(
  incidente: Incidente,
  agencia: Agencia | undefined,
  acaoRealizada: string,
  tipoFalha: string,
  nomeColaborador: string,
): string {
  return `À Cetel,

Favor validar circuito abaixo:

┌──────────────────────────────────────────────────────
│ Operadora:              ${incidente.oemp}
│ Unidade - CGC:          ${agencia?.unidade || '-'} - ${agencia?.cgcUnidade || '-'}
│ Designação/Circuito:    ${incidente.circuito}
│ Ação realizada/Reparo:  ${acaoRealizada || '-'}
│ Chamado/REQ:            ${incidente.chamado} / ${incidente.req}
│ Tipo de Falha:          ${tipoFalha || 'Indisponibilidade'}
│ Status:                 ${incidente.status}
└──────────────────────────────────────────────────────

Atenciosamente,
${nomeColaborador}`;
}

export function gerarTextoQRU(
  incidente: Incidente,
  agencia: Agencia | undefined,
  resumo: string,
  acoesExecutadas: string,
  codEncerramento?: CodEncerramento,
): string {
  const linhas = [
    `═══════════════════════════════════════`,
    `           QRU - RESUMO DO CASO`,
    `═══════════════════════════════════════`,
    ``,
    `CHAMADO:        ${incidente.chamado}`,
    `REQ:            ${incidente.req}`,
    `CIRCUITO:       ${incidente.circuito}`,
    `OEMP:           ${incidente.oemp}`,
    `REDE:           ${incidente.rede}`,
    `AGÊNCIA:        ${incidente.agenciaNome}`,
    `PONTO:          ${incidente.pontoCodigo}`,
    `UF:             ${incidente.uf}`,
  ];

  if (agencia) {
    linhas.push(
      ``,
      `── DADOS DA AGÊNCIA ──`,
      `Endereço:       ${agencia.logradouro} ${agencia.endereco}, ${agencia.numero} ${agencia.complemento}`,
      `                ${agencia.bairro} - ${agencia.cidade}/${agencia.uf} - CEP: ${agencia.cep}`,
      `Tecnologia:     ${agencia.tecnologia}`,
      `Velocidade:     ${agencia.velocidade}`,
      `CGC:            ${agencia.cgcUnidade}`,
    );
  }

  linhas.push(
    ``,
    `── TIMELINE ──`,
    `Abertura:          ${formatDataHora(incidente.dataHoraAbertura)}`,
    `Última Atualização: ${formatDataHora(incidente.dataHoraAtualizacao)}`,
    `Normalização:      ${incidente.normalizacaoDataHora ? formatDataHora(incidente.normalizacaoDataHora) : 'PENDENTE'}`,
    ``,
    `── RESUMO ──`,
    resumo || incidente.descricaoFalha,
    ``,
    `── CAUSA ──`,
    incidente.causa || 'Em investigação',
    ``,
    `── AÇÕES EXECUTADAS ──`,
    acoesExecutadas || '-',
  );

  if (codEncerramento) {
    linhas.push(
      ``,
      `── CÓDIGO DE ENCERRAMENTO ──`,
      `Código:    ${codEncerramento.codigo}`,
      `N1/N2/N3:  ${codEncerramento.n1} > ${codEncerramento.n2} > ${codEncerramento.n3}`,
      `Uso:       ${codEncerramento.quandoUtilizar}`,
    );
  }

  linhas.push(``, `═══════════════════════════════════════`);
  return linhas.join('\n');
}
