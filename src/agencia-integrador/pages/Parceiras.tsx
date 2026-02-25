import { useData } from '@/agencia-integrador/contexts/DataContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Mail, Phone } from 'lucide-react';
import { toast } from 'sonner';

export default function Parceiras() {
  const { parceiras } = useData();

  const copiar = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Parceiras / Operadoras</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {parceiras.map(p => (
          <Card key={p.id} className="border-border">
            <CardContent className="p-4 space-y-3">
              <h3 className="font-bold text-primary text-lg">{p.nomeOperadora}</h3>
              <p className="text-sm text-muted-foreground">{p.contato}</p>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate">{p.email}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copiar(p.email, 'Email')}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">{p.telefone}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copiar(p.telefone, 'Telefone')}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              {p.observacoes && <p className="text-xs text-muted-foreground bg-secondary p-2 rounded">{p.observacoes}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
