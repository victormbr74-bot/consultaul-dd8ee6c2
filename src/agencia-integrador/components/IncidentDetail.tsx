import { useState } from 'react';
import type { Incidente, Agencia, CodEncerramento } from '@/agencia-integrador/types';
import { useData } from '@/agencia-integrador/contexts/DataContext';
import { calcHorasDesde, formatHoras, formatDataHora } from '@/agencia-integrador/utils/calculations';
import { gerarTextoValidacao, gerarTextoQRU } from '@/agencia-integrador/utils/textGenerator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, FileText, Mail } from 'lucide-react';
import { toast } from 'sonner';

const statusColor: Record<string, string> = {
  'EM ANDAMENTO': 'bg-warning/20 text-warning border-warning/30',
  'EM ABERTURA': 'bg-warning/20 text-warning border-warning/30',
  'TRIAGEM MANUAL': 'bg-info/20 text-info border-info/30',
  'TRIAGEM': 'bg-info/20 text-info border-info/30',
  'INTEGRAR': 'bg-info/20 text-info border-info/30',
  'FALHA INTEGRAÇÃO': 'bg-destructive/20 text-destructive border-destructive/30',
  'PENDENTE PARCEIRA': 'bg-destructive/20 text-destructive border-destructive/30',
  'PENDENTE CLIENTE': 'bg-destructive/20 text-destructive border-destructive/30',
  'PENDENTE AGENDAMENTO': 'bg-destructive/20 text-destructive border-destructive/30',
  'PENDENTE MONITORAÇÃO': 'bg-destructive/20 text-destructive border-destructive/30',
  'PENDENTE SEM CONTATO': 'bg-destructive/20 text-destructive border-destructive/30',
  'ENCERRADO': 'bg-muted text-muted-foreground border-border',
  'NORMALIZADO': 'bg-success/20 text-success border-success/30',
};

interface Props {
  incidente: Incidente | null;
  onClose: () => void;
}

export default function IncidentDetail({ incidente, onClose }: Props) {
  const { agencias, topologia, codEncerramento } = useData();
  const [tab, setTab] = useState<'detalhes' | 'validacao' | 'qru'>('detalhes');
  const [acaoRealizada, setAcaoRealizada] = useState('');
  const [tipoFalha, setTipoFalha] = useState('Indisponibilidade');
  const [nomeColab, setNomeColab] = useState('');
  const [resumo, setResumo] = useState('');
  const [acoes, setAcoes] = useState('');
  const [codSelecionado, setCodSelecionado] = useState('');

  if (!incidente) return null;

  const agencia = agencias.find(a => a.nomeLogicoPonto === incidente.pontoCodigo);
  const topos = topologia.filter(t => t.ufRegiao === incidente.uf);
  const codSel = codEncerramento.find(c => c.id === codSelecionado);
  const hrsAbertura = calcHorasDesde(incidente.dataHoraAbertura);
  const hrsAtualizacao = calcHorasDesde(incidente.dataHoraAtualizacao);

  const copiar = (texto: string, label: string) => {
    navigator.clipboard.writeText(texto);
    toast.success(`${label} copiado para a área de transferência`);
  };

  return (
    <Sheet open={!!incidente} onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto bg-card border-border">
        <SheetHeader>
          <SheetTitle className="text-primary flex items-center gap-2">
            {incidente.chamado}
            <Badge variant="outline" className={statusColor[incidente.status]}>{incidente.status}</Badge>
          </SheetTitle>
        </SheetHeader>

        {/* Tab buttons */}
        <div className="flex gap-2 mt-4 mb-4">
          {(['detalhes', 'validacao', 'qru'] as const).map(t => (
            <Button
              key={t}
              variant={tab === t ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setTab(t)}
            >
              {t === 'detalhes' && 'Detalhes'}
              {t === 'validacao' && <><Mail className="h-4 w-4 mr-1" /> Validação</>}
              {t === 'qru' && <><FileText className="h-4 w-4 mr-1" /> QRU</>}
            </Button>
          ))}
        </div>

        {tab === 'detalhes' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Info label="Circuito" value={incidente.circuito} />
              <Info label="REQ" value={incidente.req} />
              <Info label="UF" value={incidente.uf} />
              <Info label="GITEC" value={incidente.gitec || incidente.oemp} />
              <Info label="Tipo Circuito" value={incidente.tipoCircuito || incidente.rede} />
              <Info label="Agência" value={incidente.agenciaNome} />
              <Info label="Ponto" value={incidente.pontoCodigo} />
              <Info label="Massiva" value={incidente.massiva ? 'SIM' : 'Não'} highlight={incidente.massiva} />
              <Info label="Tipo Solicitação" value={incidente.tipoSolicitacao || '-'} />
              <Info label="SLA" value={incidente.sla || '-'} />
            </div>

            <Separator className="bg-border" />

            <div className="grid grid-cols-2 gap-3 text-sm">
              <Info label="Abertura" value={formatDataHora(incidente.dataHoraAbertura)} />
              <Info label="Horas desde abertura" value={formatHoras(hrsAbertura)} highlight={hrsAbertura > 24} />
              <Info label="Última Atualização" value={formatDataHora(incidente.dataHoraAtualizacao)} />
              <Info label="Horas desde atualiz." value={formatHoras(hrsAtualizacao)} highlight={hrsAtualizacao > 8} />
              <Info label="Normalização" value={incidente.normalizacaoDataHora ? formatDataHora(incidente.normalizacaoDataHora) : 'Pendente'} />
              <Info label="Tempo Total de Falha" value={incidente.tempoTotal || '-'} highlight={!!incidente.tempoTotal} />
            </div>

            <Separator className="bg-border" />

            <div className="grid grid-cols-1 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Tipo de Falha (Descrição Inicial)</p>
                <p className="text-sm bg-secondary p-3 rounded-md font-semibold text-destructive">
                  {incidente.descricaoInicial || incidente.descricaoFalha || '-'}
                </p>
              </div>
              {incidente.causaRaiz && incidente.causaRaiz !== incidente.causa && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Causa Raiz</p>
                  <p className="text-sm bg-secondary p-3 rounded-md">{incidente.causaRaiz}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Descrição da Falha</p>
                <p className="text-sm bg-secondary p-3 rounded-md">{incidente.descricaoFalha || '-'}</p>
              </div>
              {incidente.ultimoComentario && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Último Comentário</p>
                  <p className="text-sm bg-secondary p-3 rounded-md whitespace-pre-wrap">{incidente.ultimoComentario}</p>
                </div>
              )}
              <Info label="Causa" value={incidente.causa || 'Em investigação'} />
            </div>

            {agencia && (
              <>
                <Separator className="bg-border" />
                <h4 className="text-sm font-semibold text-primary">Dados da Agência</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Info label="Nome" value={agencia.nomePonto} />
                  <Info label="CGC" value={agencia.cgcUnidade} />
                  <Info label="Tecnologia" value={agencia.tecnologia} />
                  <Info label="Velocidade" value={agencia.velocidade} />
                  <Info label="Endereço" value={`${agencia.logradouro} ${agencia.endereco}, ${agencia.numero}`} />
                  <Info label="Cidade/UF" value={`${agencia.cidade}/${agencia.uf}`} />
                </div>
              </>
            )}

            {topos.length > 0 && (
              <>
                <Separator className="bg-border" />
                <h4 className="text-sm font-semibold text-primary">Topologia ({incidente.uf})</h4>
                {topos.map(t => (
                  <div key={t.id} className="bg-secondary p-3 rounded-md text-sm space-y-1">
                    <p><span className="text-muted-foreground">Concentrador:</span> {t.concentrador} ({t.ip})</p>
                    <p><span className="text-muted-foreground">VLAN:</span> {t.vlan} · <span className="text-muted-foreground">WAN:</span> {t.wan1}</p>
                    <Button variant="ghost" size="sm" className="text-xs mt-1" onClick={() => copiar(t.comandos, 'Comandos')}>
                      <Copy className="h-3 w-3 mr-1" /> Copiar comandos
                    </Button>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {tab === 'validacao' && (
          <div className="space-y-4">
            <Input placeholder="Ação realizada / Reparo" value={acaoRealizada} onChange={e => setAcaoRealizada(e.target.value)} />
            <Select value={tipoFalha} onValueChange={setTipoFalha}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Indisponibilidade">Indisponibilidade</SelectItem>
                <SelectItem value="Qualidade">Qualidade</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Nome do colaborador" value={nomeColab} onChange={e => setNomeColab(e.target.value)} />
            <Button onClick={() => {
              const texto = gerarTextoValidacao(incidente, agencia, acaoRealizada, tipoFalha, nomeColab);
              copiar(texto, 'Email de validação');
            }}>
              <Copy className="h-4 w-4 mr-2" /> Copiar Email de Validação
            </Button>
            <pre className="text-xs bg-secondary p-3 rounded-md whitespace-pre-wrap max-h-80 overflow-y-auto">
              {gerarTextoValidacao(incidente, agencia, acaoRealizada, tipoFalha, nomeColab)}
            </pre>
          </div>
        )}

        {tab === 'qru' && (
          <div className="space-y-4">
            <Textarea placeholder="Resumo do caso" value={resumo} onChange={e => setResumo(e.target.value)} rows={3} />
            <Textarea placeholder="Ações executadas" value={acoes} onChange={e => setAcoes(e.target.value)} rows={3} />
            <Select value={codSelecionado} onValueChange={setCodSelecionado}>
              <SelectTrigger><SelectValue placeholder="Código de encerramento (opcional)" /></SelectTrigger>
              <SelectContent>
                {codEncerramento.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.codigo} - {c.n1} &gt; {c.n2} &gt; {c.n3}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {codSel && <p className="text-xs text-muted-foreground bg-secondary p-2 rounded">💡 {codSel.quandoUtilizar}</p>}
            <Button onClick={() => {
              const texto = gerarTextoQRU(incidente, agencia, resumo, acoes, codSel);
              copiar(texto, 'QRU');
            }}>
              <Copy className="h-4 w-4 mr-2" /> Copiar QRU
            </Button>
            <pre className="text-xs bg-secondary p-3 rounded-md whitespace-pre-wrap max-h-80 overflow-y-auto font-mono">
              {gerarTextoQRU(incidente, agencia, resumo, acoes, codSel)}
            </pre>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Info({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={highlight ? 'text-destructive font-semibold' : ''}>{value}</p>
    </div>
  );
}
