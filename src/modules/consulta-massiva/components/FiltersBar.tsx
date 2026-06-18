import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface Filters {
  uf: string;
  cidade: string;
  tipoLink: string;
  tipoMassiva: string;
  operadora: string;
  parceira: string;
  empresa: string;
  tecnologia: string;
  siteOwner: string;
  dataInicial: string;
  dataFinal: string;
}

export const emptyFilters: Filters = {
  uf: "",
  cidade: "",
  tipoLink: "",
  tipoMassiva: "",
  operadora: "",
  parceira: "",
  empresa: "",
  tecnologia: "",
  siteOwner: "",
  dataInicial: "",
  dataFinal: "",
};

interface Props {
  filters: Filters;
  setFilters: (f: Filters) => void;
  options: {
    ufs: string[];
    operadoras: string[];
    parceiras: string[];
    empresas: string[];
    tecnologias: string[];
    siteOwners: string[];
  };
}

function SelectField({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: string[];
}) {
  return (
    <Select value={value || "__all"} onValueChange={(v) => onChange(v === "__all" ? "" : v)}>
      <SelectTrigger className="h-9">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all">{placeholder}: Todos</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function FiltersBar({ filters, setFilters, options }: Props) {
  const update = (k: keyof Filters) => (v: string) => setFilters({ ...filters, [k]: v });
  const hasAny = Object.values(filters).some((v) => v);

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
        <SelectField value={filters.uf} onChange={update("uf")} placeholder="UF" options={options.ufs} />
        <Input
          placeholder="Cidade"
          value={filters.cidade}
          onChange={(e) => update("cidade")(e.target.value)}
          className="h-9"
        />
        <Select
          value={filters.tipoLink || "__all"}
          onValueChange={(v) => update("tipoLink")(v === "__all" ? "" : v)}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Tipo de Link" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Tipo Link: Todos</SelectItem>
            <SelectItem value="PRINCIPAL">PRINCIPAL</SelectItem>
            <SelectItem value="SECUNDARIO">SECUNDARIO</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.tipoMassiva || "__all"}
          onValueChange={(v) => update("tipoMassiva")(v === "__all" ? "" : v)}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Tipo Massiva" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Massiva: Todas</SelectItem>
            <SelectItem value="PRINCIPAL_VTAL">PRINCIPAL VTAL</SelectItem>
            <SelectItem value="PRINCIPAL_OEMP">PRINCIPAL OEMP</SelectItem>
            <SelectItem value="SECUNDARIO_UF">SECUNDARIO UF</SelectItem>
            <SelectItem value="SECUNDARIO_NACIONAL">SECUNDARIO NACIONAL</SelectItem>
            <SelectItem value="__nao">Sem massiva</SelectItem>
          </SelectContent>
        </Select>
        <SelectField
          value={filters.operadora}
          onChange={update("operadora")}
          placeholder="Operadora"
          options={options.operadoras}
        />
        <SelectField
          value={filters.parceira}
          onChange={update("parceira")}
          placeholder="Parceira"
          options={options.parceiras}
        />
        <SelectField
          value={filters.empresa}
          onChange={update("empresa")}
          placeholder="Empresa"
          options={options.empresas}
        />
        <SelectField
          value={filters.tecnologia}
          onChange={update("tecnologia")}
          placeholder="Tecnologia"
          options={options.tecnologias}
        />
        <SelectField
          value={filters.siteOwner}
          onChange={update("siteOwner")}
          placeholder="Site Owner"
          options={options.siteOwners}
        />
        <Input
          type="datetime-local"
          value={filters.dataInicial}
          onChange={(e) => update("dataInicial")(e.target.value)}
          className="h-9"
        />
        <Input
          type="datetime-local"
          value={filters.dataFinal}
          onChange={(e) => update("dataFinal")(e.target.value)}
          className="h-9"
        />
      </div>
      {hasAny && (
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setFilters(emptyFilters)}
            className="h-7 text-xs"
          >
            <X className="h-3 w-3" /> Limpar filtros
          </Button>
        </div>
      )}
    </div>
  );
}
