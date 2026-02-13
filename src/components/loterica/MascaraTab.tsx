import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Check } from "lucide-react";

interface MascaraTabProps {
  form: any;
}

const DEFEITOS_OEMP = [
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

const DEFEITOS_ATIVA = [
  { value: "INOPERANTE", desc: "CIRCUITO INOPERANTE, FAVOR VERIFICAR." },
  { value: "INTERMITENCIA", desc: "CIRCUITO INTERMITENTE, FAVOR VERIFICAR." },
  { value: "LATENCIA ALTA", desc: "CIRCUITO APRESENTANDO ALTA LATENCIA, FAVOR VERIFICAR." },
  { value: "PERCA DE PACOTE", desc: "CIRCUITO COM PERCA DE PACOTE, FAVOR VERIFICAR." },
  { value: "FALHA DE MTU", desc: "CIRCUITO COM FALHA DE MTU FAVOR VERIFICAR." },
];

const CAUSAS_ENCERRAMENTO = [
  "Causa Operadora - Normalizado após fusão de fibra.",
  "Causa Operadora - Normalizado após reconfiguração do circuito na rede SDH",
  "Causa Operadora - Normalizado após recuperação da rede metalica.",
  "Causa Operadora - Normalizado após reset de modem no cliente.",
  "Causa Operadora - Normalizado após recuperação de DROP otico.",
  "Causa Cliente - Após testes realizados no equipamento não foi identificado falha. Circuito ativo a mais de",
  "Causa Cliente - Normalizado após retorno de energia no ambiente do cliente.",
  "Causa Operadora - Normalizado após troca de cabo/conectores na loterica.",
  "Causa Operadora - Falha restabelecida após reconfiguração do circuito no Backbone OI (NWB/DATACOM/SDH/RADIO/SATÉLETE)",
  "Causa Operadora - Normalizado após troca de nobreak.",
  "Causa Operadora - Normalizado após troca de SWITCH.",
  "Causa Cliente - Após testes realizados no equipamento não foi identificado falha nos terminais ambos os 3 estão trafegando normalmente.",
  "Causa Cliente - Abertura indevida, Falha não identificada. Link ativo a mais de",
  "Causa Operadora - Link passou por migração, link já normalizado.",
  "Após analise, não foi identificado falha nos link's e nem de TFL. Favor prosseguir na abertura de reparo com categorização correta",
  "Apos analise nao foi identificado a indisponibilidade total da loterica, foi aberto chamado proativo para realizar a tratativa da falha reclamada.",
];

const FALHAS_ENCERRAMENTO = [
  "Inoperância",
  "Intermitência",
  "Alta Latência",
  "Perca de Pacote",
];

const MascaraTab = ({ form }: MascaraTabProps) => {
  const [copied, setCopied] = useState<string | null>(null);
  const [defeitoOemp, setDefeitoOemp] = useState("");
  const [defeitoAtiva, setDefeitoAtiva] = useState("");
  const [defeitoMam, setDefeitoMam] = useState("");
  const [falhaEnc, setFalhaEnc] = useState("");
  const [causaEnc, setCausaEnc] = useState("");
  const [horaEnc, setHoraEnc] = useState("");
  const [contatoEnc, setContatoEnc] = useState("Manoel Victor - 61 3464-9700");

  const raw = form.raw_data || {};
  const cctoOemp = form.ccto_oemp || "";
  const designacao = form.designacao_nova || "";
  const contato = form.contato || "";
  const endereco = form.endereco || "";
  const nome = form.nome_loterica || "";
  const codUl = form.cod_ul || "";
  const operadora = form.operadora || "";
  const simCard = raw["SIM CARD 4G"] || "";
  const modeloRoteador = raw["MODELO ROTEADOR"] || "";
  const cep = raw["CEP"] || "";
  const cidade = form.cidade || "";
  const uf = form.uf || "";

  const defeitoDescOemp = DEFEITOS_OEMP.find(d => d.value === defeitoOemp)?.desc || "";
  const defeitoDescAtiva = DEFEITOS_ATIVA.find(d => d.value === defeitoAtiva)?.desc || "";

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const CopyBtn = ({ text, id }: { text: string; id: string }) => (
    <Button variant="outline" size="sm" onClick={() => copy(text, id)}>
      {copied === id ? <Check className="w-4 h-4 mr-1 text-green-500" /> : <Copy className="w-4 h-4 mr-1" />}
      {copied === id ? "Copiado!" : "Copiar"}
    </Button>
  );

  const mascaraOemp = `NOME SOLICITANTE: CEC CAIXA
NOME DO CONTATO LOCAL: ${contato}
RAZÃO SOCIAL: OI S/A
CNPJ: 76.535.764/0001-43
ENDEREÇO: ${endereco}
HORÁRIO DE ATENDIMENTO: 09h às 18h
AUTORIZAÇÃO DE ACESSO: SIM
CIRCUITO OEMP: ${cctoOemp}
CONTATO PARA ACOMPANHAR: 61 3464-9700
ATUALIZAÇÃO: SIM POR VOZ A CADA 1 HORA
DEFEITO RECLAMADO: ${defeitoOemp}${defeitoDescOemp ? `\n${defeitoDescOemp}` : ""}
NOME DA UL: ${nome}
CÓDIGO UL: ${codUl}
CIRCUITO OI: ${designacao}`;

  const mascaraWt = `Designação/VLAN: ${cctoOemp} VLAN:
Cliente Final: ${nome}
Chamado interno:
DEFEITO RECLAMADO: ${defeitoOemp}${defeitoDescOemp ? `\n${defeitoDescOemp}` : ""}
Horario do incidente:
Telefone de contato: 61 3464-9700
Nome do solicitante:
CIRCUITO OI: ${designacao}`;

  const mascaraAtiva = `DESIGINAÇÃO: ${designacao}
COD. UL: ${codUl}
CLIENTE: OI/SA
PROTOCOLO OI:
TIPO DE SOLICITAÇÃO: ABERTURA
PROVEDOR: ${cctoOemp === "NÃO OEMP" ? "NÃO OEMP" : cctoOemp}
REICIDENTE: NÃO
JÁ ESCALONADO: N1
DATA E HORA DA QUEDA:
REALIZADO TS COM O CLIENTE: SIM
DEFEITO RECLAMADO: ${defeitoAtiva}${defeitoDescAtiva ? `\nRECLAMAÇÃO INICIAL: ${defeitoDescAtiva}` : ""}
HORÁRIO DE FUNCIONAMENTO: Seg a Sex: 08h às 18h Sab: 08h às 12h
CONTATO LOCAL: ${contato}
CONTATO DE VALIDAÇÃO: 61 3464-9700`;

  const mascaraMam = `CÓDIGO UL: ${codUl}
NOME DA UL: ${nome}
ENDEREÇO UL: ${endereco}
CONTATO: ${contato}
HORÁRIO DE FUNCIONAMENTO: Seg a Sex: 08h às 18h Sab: 08h às 12h
DEFEITO RECLAMADO: ${defeitoMam || ""}
OPERADORA: ${operadora}
SIM CARD: ${simCard}
MODELO ROTEADOR: ${modeloRoteador}
CEP: ${cep}
MUNICÍPIO/ESTADO: ${cidade} ${uf}
RECLAMAÇÃO INICIAL: ${defeitoMam || ""}
CONTATO DE VALIDAÇÃO: 61 3464-9700
HORÁRIO DE ACESSO: 09h às 18h`;

  const mascaraEncerramento = `CEC Caixa
Falha: ${falhaEnc}
Horário de normalização: ${horaEnc}
Causa/Solução: ${causaEnc}
Contato de Autorização: ${contatoEnc}`;

  return (
    <Tabs defaultValue="oemp" className="space-y-4">
      <TabsList className="grid grid-cols-5 w-full">
        <TabsTrigger value="oemp" className="text-xs">OEMP OI</TabsTrigger>
        <TabsTrigger value="wt" className="text-xs">WT Telecom</TabsTrigger>
        <TabsTrigger value="ativa" className="text-xs">ATIVA</TabsTrigger>
        <TabsTrigger value="mam" className="text-xs">MAM/SCT</TabsTrigger>
        <TabsTrigger value="enc" className="text-xs">Encerramento</TabsTrigger>
      </TabsList>

      <TabsContent value="oemp">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Máscara OEMP OI</CardTitle>
            <CopyBtn text={mascaraOemp} id="oemp" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Defeito Reclamado</Label>
              <Select value={defeitoOemp} onValueChange={setDefeitoOemp}>
                <SelectTrigger><SelectValue placeholder="Selecione o defeito..." /></SelectTrigger>
                <SelectContent>
                  {DEFEITOS_OEMP.map(d => (
                    <SelectItem key={d.value} value={d.value}>{d.value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <pre className="text-xs font-mono bg-muted/50 p-4 rounded whitespace-pre-wrap">{mascaraOemp}</pre>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="wt">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Máscara WT Telecom</CardTitle>
            <CopyBtn text={mascaraWt} id="wt" />
          </CardHeader>
          <CardContent>
            <pre className="text-xs font-mono bg-muted/50 p-4 rounded whitespace-pre-wrap">{mascaraWt}</pre>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="ativa">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Máscara ATIVA</CardTitle>
            <CopyBtn text={mascaraAtiva} id="ativa" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Defeito Reclamado</Label>
              <Select value={defeitoAtiva} onValueChange={setDefeitoAtiva}>
                <SelectTrigger><SelectValue placeholder="Selecione o defeito..." /></SelectTrigger>
                <SelectContent>
                  {DEFEITOS_ATIVA.map(d => (
                    <SelectItem key={d.value} value={d.value}>{d.value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <pre className="text-xs font-mono bg-muted/50 p-4 rounded whitespace-pre-wrap">{mascaraAtiva}</pre>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="mam">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Abertura MAM/SCT</CardTitle>
            <CopyBtn text={mascaraMam} id="mam" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Defeito Reclamado</Label>
              <Select value={defeitoMam} onValueChange={setDefeitoMam}>
                <SelectTrigger><SelectValue placeholder="Selecione o defeito..." /></SelectTrigger>
                <SelectContent>
                  {DEFEITOS_OEMP.map(d => (
                    <SelectItem key={d.value} value={d.value}>{d.value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <pre className="text-xs font-mono bg-muted/50 p-4 rounded whitespace-pre-wrap">{mascaraMam}</pre>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="enc">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Máscara de Encerramento</CardTitle>
            <CopyBtn text={mascaraEncerramento} id="enc" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Falha</Label>
                <Select value={falhaEnc} onValueChange={setFalhaEnc}>
                  <SelectTrigger><SelectValue placeholder="Tipo de falha..." /></SelectTrigger>
                  <SelectContent>
                    {FALHAS_ENCERRAMENTO.map(f => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Horário de Normalização</Label>
                <Input
                  type="datetime-local"
                  value={horaEnc}
                  onChange={e => setHoraEnc(e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Causa/Solução</Label>
                <Select value={causaEnc} onValueChange={setCausaEnc}>
                  <SelectTrigger><SelectValue placeholder="Selecione a causa..." /></SelectTrigger>
                  <SelectContent>
                    {CAUSAS_ENCERRAMENTO.map(c => (
                      <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Contato de Autorização</Label>
                <Input value={contatoEnc} onChange={e => setContatoEnc(e.target.value)} />
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
