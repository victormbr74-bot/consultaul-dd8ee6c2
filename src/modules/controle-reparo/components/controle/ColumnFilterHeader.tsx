import { useMemo, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Filter,
  ListFilter,
} from "lucide-react";

export interface ColFilter {
  search: string;
  selected: string[];
}

export const EMPTY_FILTER: ColFilter = { search: "", selected: [] };

export function ColumnFilterHeader({
  label,
  options,
  filter,
  onFilterChange,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  options: string[];
  filter: ColFilter;
  onFilterChange: (f: ColFilter) => void;
  sortDir: "asc" | "desc" | null;
  onSort: (dir: "asc" | "desc") => void;
  className?: string;
}) {
  const [q, setQ] = useState("");
  const active = filter.search.trim() !== "" || filter.selected.length > 0;

  const visibleOptions = useMemo(() => {
    const s = q.trim().toLowerCase();
    const opts = s
      ? options.filter((o) => o.toLowerCase().includes(s))
      : options;
    return opts.slice(0, 500);
  }, [options, q]);

  const toggle = (val: string) => {
    const set = new Set(filter.selected);
    if (set.has(val)) set.delete(val);
    else set.add(val);
    onFilterChange({ ...filter, selected: Array.from(set) });
  };

  return (
    <div className={`flex min-w-0 items-center justify-between gap-2 ${className ?? ""}`}>
      <span className="min-w-0 truncate">{label}</span>
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={`shrink-0 rounded p-1 transition-colors ${
              active || sortDir
                ? "text-primary"
                : "text-muted-foreground/60 hover:text-foreground"
            }`}
            title="Filtrar / ordenar"
          >
            {active ? (
              <Filter className="h-3.5 w-3.5 fill-current" />
            ) : (
              <ListFilter className="h-3.5 w-3.5" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-2">
          <div className="mb-2 flex gap-1">
            <Button
              variant={sortDir === "asc" ? "default" : "outline"}
              size="sm"
              className="h-7 flex-1 px-2 text-xs"
              onClick={() => onSort("asc")}
            >
              <ArrowDownAZ className="mr-1 h-3.5 w-3.5" /> Crescente
            </Button>
            <Button
              variant={sortDir === "desc" ? "default" : "outline"}
              size="sm"
              className="h-7 flex-1 px-2 text-xs"
              onClick={() => onSort("desc")}
            >
              <ArrowUpAZ className="mr-1 h-3.5 w-3.5" /> Decrescente
            </Button>
          </div>

          <Input
            placeholder="Pesquisar..."
            value={filter.search}
            onChange={(e) =>
              onFilterChange({ ...filter, search: e.target.value })
            }
            className="mb-2 h-7 text-xs"
          />

          <div className="mb-1 flex items-center justify-between">
            <Input
              placeholder="Filtrar opções..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-6 text-[11px]"
            />
          </div>
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <button
              className="text-primary hover:underline"
              onClick={() =>
                onFilterChange({
                  ...filter,
                  selected: Array.from(new Set([...filter.selected, ...visibleOptions])),
                })
              }
            >
              Selecionar
            </button>
            <button
              className="text-muted-foreground hover:underline"
              onClick={() => onFilterChange({ ...filter, selected: [] })}
            >
              Limpar
            </button>
          </div>

          <div className="max-h-56 space-y-1 overflow-auto rounded border p-1">
            {visibleOptions.length === 0 && (
              <p className="px-1 py-2 text-center text-[11px] text-muted-foreground">
                Sem valores
              </p>
            )}
            {visibleOptions.map((o) => (
              <label
                key={o}
                className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-muted"
              >
                <Checkbox
                  checked={filter.selected.includes(o)}
                  onCheckedChange={() => toggle(o)}
                />
                <span className="truncate" title={o || "(vazio)"}>
                  {o || "(vazio)"}
                </span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
