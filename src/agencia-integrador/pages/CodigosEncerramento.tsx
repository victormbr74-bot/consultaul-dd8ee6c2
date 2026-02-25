import { useState, useMemo } from 'react';
import { useData } from '@/agencia-integrador/contexts/DataContext';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export default function CodigosEncerramento() {
  const { codEncerramento } = useData();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return codEncerramento;
    const s = search.toLowerCase();
    return codEncerramento.filter(c =>
      c.codigo.toLowerCase().includes(s) || c.n1.toLowerCase().includes(s) ||
      c.n2.toLowerCase().includes(s) || c.n3.toLowerCase().includes(s) ||
      c.quandoUtilizar.toLowerCase().includes(s)
    );
  }, [codEncerramento, search]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Códigos de Encerramento</h1>
      <Input placeholder="Buscar por código, N1, N2, N3 ou descrição..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm bg-secondary border-border" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(c => (
          <Card key={c.id} className="border-border hover:glow-primary transition-shadow">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-primary">{c.codigo}</span>
              </div>
              <div className="flex gap-1 flex-wrap">
                <Badge variant="outline" className="text-[10px] bg-secondary">{c.n1}</Badge>
                <Badge variant="outline" className="text-[10px] bg-secondary">{c.n2}</Badge>
                <Badge variant="outline" className="text-[10px] bg-secondary">{c.n3}</Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{c.quandoUtilizar}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
