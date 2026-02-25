import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '@/agencia-integrador/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

export default function Agencias() {
  const { agencias } = useData();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterUf, setFilterUf] = useState('all');

  const ufs = useMemo(() => [...new Set(agencias.map(a => a.uf))].sort(), [agencias]);

  const filtered = useMemo(() => {
    return agencias.filter(a => {
      if (filterUf !== 'all' && a.uf !== filterUf) return false;
      if (search) {
        const s = search.toLowerCase();
        return a.nomePonto.toLowerCase().includes(s) || a.nomeLogicoPonto.toLowerCase().includes(s) ||
          a.cgcUnidade.toLowerCase().includes(s) || a.cidade.toLowerCase().includes(s) ||
          a.unidade.toLowerCase().includes(s);
      }
      return true;
    });
  }, [agencias, filterUf, search]);

  const exportCSV = () => {
    const headers = ['Ponto', 'Nome', 'Rede', 'Unidade', 'Tecnologia', 'Velocidade', 'CGC', 'Cidade', 'UF'];
    const rows = filtered.map(a => [a.nomeLogicoPonto, a.nomePonto, a.nomeRede, a.unidade, a.tecnologia, a.velocidade, a.cgcUnidade, a.cidade, a.uf]);
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'agencias.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Base de Agências</h1>
        <Button variant="secondary" size="sm" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input placeholder="Buscar ponto/CGC/cidade/unidade..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs bg-secondary border-border" />
        <Select value={filterUf} onValueChange={setFilterUf}>
          <SelectTrigger className="w-28 bg-secondary border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas UFs</SelectItem>
            {ufs.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="border-border overflow-hidden">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm text-muted-foreground">{filtered.length} agência(s)</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-xs">Ponto</TableHead>
                <TableHead className="text-xs">Nome</TableHead>
                <TableHead className="text-xs">Rede</TableHead>
                <TableHead className="text-xs">Unidade</TableHead>
                <TableHead className="text-xs">Tecnologia</TableHead>
                <TableHead className="text-xs">Velocidade</TableHead>
                <TableHead className="text-xs">CGC</TableHead>
                <TableHead className="text-xs">Endereço</TableHead>
                <TableHead className="text-xs">Cidade/UF</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(a => (
                <TableRow
                  key={a.id}
                  className="border-border cursor-pointer hover:bg-secondary/40"
                  onClick={() => navigate(`/agencia-integrador/consulta?search=${encodeURIComponent(a.nomeLogicoPonto || a.nomePonto)}`)}
                  title="Abrir consulta da agencia"
                >
                  <TableCell className="text-xs font-mono text-primary hover:underline">{a.nomeLogicoPonto}</TableCell>
                  <TableCell className="text-xs">{a.nomePonto}</TableCell>
                  <TableCell className="text-xs">{a.nomeRede}</TableCell>
                  <TableCell className="text-xs">{a.unidade}</TableCell>
                  <TableCell className="text-xs">{a.tecnologia}</TableCell>
                  <TableCell className="text-xs">{a.velocidade}</TableCell>
                  <TableCell className="text-xs font-mono">{a.cgcUnidade}</TableCell>
                  <TableCell className="text-xs max-w-[150px] truncate">{a.logradouro} {a.endereco}, {a.numero}</TableCell>
                  <TableCell className="text-xs">{a.cidade}/{a.uf}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
