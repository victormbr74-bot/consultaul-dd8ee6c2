import { useState, useMemo } from 'react';
import { useData } from '@/agencia-integrador/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';

export default function Topologia() {
  const { topologia } = useData();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return topologia;
    const s = search.toLowerCase();
    return topologia.filter(t =>
      t.ufRegiao.toLowerCase().includes(s) || t.concentrador.toLowerCase().includes(s) ||
      t.ip.toLowerCase().includes(s) || t.descricao.toLowerCase().includes(s)
    );
  }, [topologia, search]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Topologia</h1>
      <Input placeholder="Buscar por UF/concentrador/IP..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs bg-secondary border-border" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(t => (
          <Card key={t.id} className="border-border">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <span className="text-primary font-mono">{t.concentrador}</span>
                <span className="text-muted-foreground">({t.ufRegiao})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <span className="text-muted-foreground">IP:</span><span className="font-mono">{t.ip}</span>
                <span className="text-muted-foreground">VLAN:</span><span>{t.vlan}</span>
                <span className="text-muted-foreground">WAN1:</span><span className="font-mono">{t.wan1}</span>
                {t.wan2 && <><span className="text-muted-foreground">WAN2:</span><span className="font-mono">{t.wan2}</span></>}
                <span className="text-muted-foreground">LAN:</span><span className="font-mono">{t.lan}</span>
              </div>
              <p className="text-xs text-muted-foreground">{t.descricao}</p>
              {t.observacoes && <p className="text-xs text-muted-foreground bg-secondary p-2 rounded">{t.observacoes}</p>}
              <div className="bg-secondary p-2 rounded font-mono text-xs whitespace-pre-wrap">{t.comandos}</div>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => {
                navigator.clipboard.writeText(t.comandos);
                toast.success('Comandos copiados!');
              }}>
                <Copy className="h-3 w-3 mr-1" /> Copiar comandos
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
