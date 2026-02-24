import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Copy, Check } from "lucide-react";

interface MascaraTabProps {
  form: any;
}

type Defeito = {
  value: string;
  desc: string;
};

const DEFEITOS_OEMP: Defeito[] = [
  { value: "TROCA DE SWITCH", desc: "FAVOR REALIZAR A TROCA DO SWITCH NA UNIDADE" },
  { value: "TROCA DE NOBREAK", desc: "FAVOR REALIZAR A TROCA DO NOBREAK NA UNIDADE" },
  { value: "PONTO LOGICO", desc: "UL reclama de falha em ponto logico. Favor verificar falha e realizar reparo nos pontos!" },
  { value: "CABO DE REDE", desc: "UL reclama de falha no cabo de rede. Favor verificar falha e realizar reparo ou troca no cabo!" },
  { value: "LINK INOPERANTE", desc: "LINK BACKUP INOPERANTE, FAVOR VERIFICAR." },
  { value: "LINK INTERMITENTE", desc: "LINK INTERMITENTE" },
  { value: "LINK ALTA LATENCIA", desc: "LINK COM ALTA LATENCIA, FAVOR ANALISAR" },
  { value: "LINK PERCA DE PACOTE", desc: "LINK COM PERCA DE PACOTE, FAVOR ANALISAR" },
  { value: "ROTEADOR", desc: "FAVOR VERIFICAR O CABEAMENTO DA PORTA 1 OU 2 DO ROTEADOR." },
  { value: "TROCA DE CHIP", desc: "FAVOR REALIZAR A TROCA DO CHIP DE OPERADO NA LOTERICA" },
];

const DEFEITOS_ATIVA: Defeito[] = [
  { value: "INOPERANTE", desc: "CIRCUITO INOPERANTE, FAVOR VERIFICAR." },
  { value: "INTERMITENCIA", desc: "CIRCUITO INTERMITENTE, FAVOR VERIFICAR." },
  { value: "LATENCIA ALTA", desc: "CIRCUITO APRESENTANDO ALTA LATENCIA, FAVOR VERIFICAR." },
  { value: "PERCA DE PACOTE", desc: "CIRCUITO COM PERCA DE PACOTE, FAVOR VERIFICAR." },
  { value: "FALHA DE MTU", desc: "CIRCUITO COM FALHA DE MTU FAVOR VERIFICAR." },
];

const FALHAS_ENCERRAMENTO = [
  "Inoperancia",
  "Intermitencia",
  "Alta Latencia",
  "Perca de Pacote",
];

const CAUSAS_ENCERRAMENTO = [
  "Causa Operadora - Normalizado apos reconfiguracao do circuito na rede SDH",
  "Causa Operadora - Normalizado apos fusao de fibra.",
  "Causa Operadora - Normalizado apos recuperacao da rede metalica.",
  "Causa Operadora - Normalizado apos reset de modem no cliente.",
  "Causa Operadora - Normalizado apos recuperacao de DROP otico.",
  "Causa Cliente - Apos testes realizados no equipamento nao foi identificado falha. Circuito ativo a mais de",
  "Causa Cliente - Normalizado apos retorno de energia no ambiente do cliente.",
  "Causa Operadora - Normalizado apos troca de cabo/conectores na loterica.",
  "Causa Operadora - Falha restabelecida apos reconfiguracao do circuito no Backbone OI (NWB/DATACOM/SDH/RADIO/SATELETE)",
  "Causa Operadora - Normalizado apos troca de nobreak.",
  "Causa Operadora - Normalizado apos troca de SWITCH.",
  "Causa Cliente - Apos testes realizados no equipamento nao foi identificado falha nos terminais ambos os 3 estao trafegando normalmente.",
  "Causa Cliente - Abertura indevida, Falha nao identificada. Link ativo a mais de",
  "Causa Operadora - Link passou por migracao, link ja normalizado.",
  "Apos analise, nao foi identificado falha nos link's e nem de TFL. Favor prosseguir na abertura de reparo com categorizacao correta",
  "Apos analise nao foi identificado a indisponibilidade total da loterica, foi aberto chamado proativo para realizar a tratativa da falha reclamada.",
];

const HORARIO_FUNCIONAMENTO_PADRAO = "Seg a Sex: 08h as 18h Sab: 08h as 12h";
const HORARIO_ACESSO_PADRAO = "09h as 18h";
const CONTATO_VALIDACAO_PADRAO = "61 3464-9700";

const MascaraTab = ({ form }: MascaraTabProps) => {
  const [copied, setCopied] = useState<string | null>(null);

  const [defeitoOemp, setDefeitoOemp] = useState("");
  const [defeitoAtiva, setDefeitoAtiva] = useState("");

  const [falhaEnc, setFalhaEnc] = useState("");
  const [horaFalhaEnc, setHoraFalhaEnc] = useState("");
  const [horaNormalizacaoEnc, setHoraNormalizacaoEnc] = useState("");
  const [causaEnc, setCausaEnc] = useState("");
  const [contatoEnc, setContatoEnc] = useState("Manoel Victor - 61 3464-9700");
  const [normAutoMode, setNormAutoMode] = useState(false);
  const [duracaoHoras, setDuracaoHoras] = useState("");

  // Parse "dd/MM/yyyy HH:mm" to Date
  const parseDateBr = useCallback((str: string): Date | null => {
    const m = str.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
    if (!m) return null;
    const [, dd, mm, yyyy, hh, min] = m;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min));
    return isNaN(d.getTime()) ? null : d;
  }, []);

  // Format Date to "dd/MM/yyyy HH:mm"
  const formatDateBr = useCallback((d: Date): string => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, []);

  // Auto-calculate normalization time when in auto mode
  useEffect(() => {
    if (!normAutoMode) return;
    const falhaDate = parseDateBr(horaFalhaEnc);
    if (!falhaDate) {
      setHoraNormalizacaoEnc("");
      return;
    }
    // Parse duration "HH:MM" or just hours
    const durMatch = duracaoHoras.trim().match(/^(\d+):(\d{2})$/);
    const hoursOnly = duracaoHoras.trim().match(/^(\d+)$/);
    let totalMinutes = 0;
    if (durMatch) {
      totalMinutes = Number(durMatch[1]) * 60 + Number(durMatch[2]);
    } else if (hoursOnly) {
      totalMinutes = Number(hoursOnly[1]) * 60;
    } else {
      setHoraNormalizacaoEnc("");
      return;
    }
    if (totalMinutes <= 0) {
      setHoraNormalizacaoEnc("");
      return;
    }
    const normDate = new Date(falhaDate.getTime() + totalMinutes * 60 * 1000);
    setHoraNormalizacaoEnc(formatDateBr(normDate));
  }, [normAutoMode, horaFalhaEnc, duracaoHoras, parseDateBr, formatDateBr]);

  const raw = form.raw_data || {};
  const codUl = form.cod_ul || "";
  const nomeUl = form.nome_loterica || "";
  const endereco = form.endereco || "";
  const contato = form.contato || "";
  const designacaoOi = form.designacao_nova || form.ccto_oi || "";
  const circuitoOemp = form.ccto_oemp || raw["CIRCUITO OEMP"] || "NAO OEMP";
  const operadora = form.operadora || "";
  const simCard = raw["SIM CARD 4G"] || "";
  const modeloRoteador = raw["MODELO ROTEADOR"] || "";
  const cep = raw["CEP"] || "";
  const cidade = form.cidade || raw["MUNICIPIO"] || "";
  const uf = form.uf || "";

  const defeitoOempDesc = useMemo(
    () => DEFEITOS_OEMP.find((d) => d.value === defeitoOemp)?.desc || "",
    [defeitoOemp],
  );
  const defeitoAtivaDesc = useMemo(
    () => DEFEITOS_ATIVA.find((d) => d.value === defeitoAtiva)?.desc || "",
    [defeitoAtiva],
  );

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1800);
  };

  const CopyBtn = ({ text, id }: { text: string; id: string }) => (
    <Button variant="outline" size="sm" onClick={() => copy(text, id)}>
      {copied === id ? <Check className="w-4 h-4 mr-1 text-green-500" /> : <Copy className="w-4 h-4 mr-1" />}
      {copied === id ? "Copiado!" : "Copiar"}
    </Button>
  );

  const mascaraOempOi = `NOME SOLICITANTE: CEC CAIXA
NOME DO CONTATO LOCAL: ${contato}
RAZAO SOCIAL: OI S/A
CNPJ: CNPJ OI: 76.535.764/0001-43
ENDERECO: ${endereco}
HORARIO DE ATENDIMENTO: ${HORARIO_ACESSO_PADRAO}
AUTORIZACAO DE ACESSO: SIM
CHAMADO INTERNO:
CIRCUITO OEMP: ${circuitoOemp}
CONTATO PARA ACOMPANHAR: ${CONTATO_VALIDACAO_PADRAO}
ATUALIZACAO: SIM POR VOZ A CADA 1 HORA
DEFEITO RECLAMADO: ${defeitoOemp}
${defeitoOempDesc}
NOME DA UL: ${nomeUl}
CODIGO UL: ${codUl}
CIRCUITO OI: ${designacaoOi}`;

  const mascaraMamSct = `CODIGO UL: ${codUl}
NOME DA UL: ${nomeUl}
ENDERECO UL: ${endereco}
CONTATO: ${contato}
HORARIO DE FUNCIONAMENTO: ${HORARIO_FUNCIONAMENTO_PADRAO}
DEFEITO RECLAMADO: ${defeitoOemp}
OPERADORA: ${operadora}
SIM CARD: ${simCard}
MODELO ROTEADOR: ${modeloRoteador}
CEP: ${cep}
MUNICIPIO/ESTADO: ${cidade} ${uf}
RECLAMACAO INICIAL: ${defeitoOempDesc}
CONTATO DE VALIDACAO: ${CONTATO_VALIDACAO_PADRAO}
HORARIO DE ACESSO: ${HORARIO_ACESSO_PADRAO}`;

  const mascaraWtTelecom = `Designacao/VLAN: ${circuitoOemp} VLAN:
Cliente Final: ${nomeUl}
Chamado interno:
DEFEITO RECLAMADO: ${defeitoOemp}
${defeitoOempDesc}
Horario do incidente:
Telefone de contato: ${CONTATO_VALIDACAO_PADRAO}
Nome do solicitante:
CIRCUITO OI: ${designacaoOi}`;

  const mascaraAtiva = `DESIGINACAO: ${designacaoOi}
COD, UL: ${codUl}
CLIENTE: OI/SA
PROTOCOLO OI:
TIPO DE SOLICITACAO: ABERTURA
PROVEDOR: ${circuitoOemp}
REICIDENTE: NAO
JA ESCALONADO: N1
DATA E HORA DA QUEDA:
REALIZADO TS COM O CLIENTE: SIM
DEFEITO RECLAMADO: ${defeitoAtiva}
HORARIO DE FUNCIONAMENTO: 08:00 as 18:00 segunda a sexta e sabado das 08:00 as 12:00
CONTATO LOCAL: ${contato}
CONTATO DE VALIDACAO: ${CONTATO_VALIDACAO_PADRAO} op.:1
RECLAMACAO INICIAL: ${defeitoAtivaDesc}`;

  const mascaraEncerramento = `CEC Caixa
Falha: ${falhaEnc}
Horario da falha: ${horaFalhaEnc}
Horario de normalizacao: ${horaNormalizacaoEnc}
Causa/Solucao: ${causaEnc}
Contato de Autorizacao: ${contatoEnc}`;

  return (
    <Tabs defaultValue="oemp" className="space-y-4">
      <TabsList className="grid grid-cols-5 w-full">
        <TabsTrigger value="oemp" className="text-xs">OEMP OI</TabsTrigger>
        <TabsTrigger value="mam" className="text-xs">MAM/SCT</TabsTrigger>
        <TabsTrigger value="wt" className="text-xs">WT Telecom</TabsTrigger>
        <TabsTrigger value="ativa" className="text-xs">ATIVA</TabsTrigger>
        <TabsTrigger value="enc" className="text-xs">Encerramento</TabsTrigger>
      </TabsList>

      <TabsContent value="oemp">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Mascara OEMP OI</CardTitle>
            <CopyBtn text={mascaraOempOi} id="oemp" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Defeito Reclamado</Label>
              <Select value={defeitoOemp} onValueChange={setDefeitoOemp}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {DEFEITOS_OEMP.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <pre className="text-xs font-mono bg-muted/50 p-4 rounded whitespace-pre-wrap">{mascaraOempOi}</pre>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="mam">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Abertura MAM/SCT</CardTitle>
            <CopyBtn text={mascaraMamSct} id="mam" />
          </CardHeader>
          <CardContent>
            <pre className="text-xs font-mono bg-muted/50 p-4 rounded whitespace-pre-wrap">{mascaraMamSct}</pre>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="wt">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Mascara WT Telecom</CardTitle>
            <CopyBtn text={mascaraWtTelecom} id="wt" />
          </CardHeader>
          <CardContent>
            <pre className="text-xs font-mono bg-muted/50 p-4 rounded whitespace-pre-wrap">{mascaraWtTelecom}</pre>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="ativa">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Mascara ATIVA</CardTitle>
            <CopyBtn text={mascaraAtiva} id="ativa" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Defeito Reclamado</Label>
              <Select value={defeitoAtiva} onValueChange={setDefeitoAtiva}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {DEFEITOS_ATIVA.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <pre className="text-xs font-mono bg-muted/50 p-4 rounded whitespace-pre-wrap">{mascaraAtiva}</pre>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="enc">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Mascara de Encerramento</CardTitle>
            <CopyBtn text={mascaraEncerramento} id="enc" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Falha</Label>
                <Select value={falhaEnc} onValueChange={setFalhaEnc}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {FALHAS_ENCERRAMENTO.map((falha) => (
                      <SelectItem key={falha} value={falha}>{falha}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Horário da falha</Label>
                <Input value={horaFalhaEnc} onChange={(e) => setHoraFalhaEnc(e.target.value)} placeholder="Ex: 26/11/2024 14:45" />
              </div>

              {/* Auto/Manual toggle */}
              <div className="md:col-span-2 flex items-center gap-3 p-3 rounded-md bg-muted/50">
                <Switch checked={normAutoMode} onCheckedChange={setNormAutoMode} id="norm-mode" />
                <Label htmlFor="norm-mode" className="text-xs cursor-pointer">
                  {normAutoMode ? "Automático — calcular normalização pela duração" : "Manual — digitar horário de normalização"}
                </Label>
              </div>

              {normAutoMode ? (
                <div>
                  <Label className="text-xs">Duração (HH:MM)</Label>
                  <Input
                    value={duracaoHoras}
                    onChange={(e) => setDuracaoHoras(e.target.value)}
                    placeholder="Ex: 48:00"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Soma à data da falha. Ex: 48:00 = +2 dias
                  </p>
                </div>
              ) : null}

              <div>
                <Label className="text-xs">Horário de normalização</Label>
                <Input
                  value={horaNormalizacaoEnc}
                  onChange={(e) => setHoraNormalizacaoEnc(e.target.value)}
                  placeholder="Ex: 26/11/2024 17:12"
                  disabled={normAutoMode}
                  className={normAutoMode ? "bg-muted" : ""}
                />
                {normAutoMode && horaNormalizacaoEnc && (
                  <p className="text-[10px] text-muted-foreground mt-1">Calculado automaticamente</p>
                )}
              </div>

              <div className="md:col-span-2">
                <Label className="text-xs">Causa/Solução</Label>
                <Select value={causaEnc} onValueChange={setCausaEnc}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {CAUSAS_ENCERRAMENTO.map((causa) => (
                      <SelectItem key={causa} value={causa} className="text-xs">{causa}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Contato de Autorização</Label>
                <Input value={contatoEnc} onChange={(e) => setContatoEnc(e.target.value)} />
              </div>
            </div>
            <pre className="text-xs font-mono bg-muted/50 p-4 rounded whitespace-pre-wrap">{mascaraEncerramento}</pre>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};

export default MascaraTab;
