import { Upload, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { useRef } from "react";
import { cn } from "@/modules/consulta-massiva/lib/utils";

interface Props {
  label: string;
  sublabel: string;
  loaded?: { name: string; count: number } | null;
  accent: "red" | "yellow" | "blue" | "green";
  onFile: (file: File) => void;
}

const ACCENT: Record<Props["accent"], { border: string; bg: string }> = {
  red: {
    border: "border-noc-red/50 hover:border-noc-red shadow-[0_0_24px_-12px_var(--noc-red)]",
    bg: "bg-noc-red/15 text-noc-red",
  },
  yellow: {
    border:
      "border-noc-yellow/50 hover:border-noc-yellow shadow-[0_0_24px_-12px_var(--noc-yellow)]",
    bg: "bg-noc-yellow/15 text-noc-yellow",
  },
  blue: {
    border: "border-noc-blue/50 hover:border-noc-blue shadow-[0_0_24px_-12px_var(--noc-blue)]",
    bg: "bg-noc-blue/15 text-noc-blue",
  },
  green: {
    border:
      "border-noc-green/50 hover:border-noc-green shadow-[0_0_24px_-12px_var(--noc-green)]",
    bg: "bg-noc-green/15 text-noc-green",
  },
};

export function UploadCard({ label, sublabel, loaded, accent, onFile }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const a = ACCENT[accent];
  return (
    <button
      type="button"
      onClick={() => ref.current?.click()}
      className={cn(
        "group relative flex w-full flex-col items-start gap-3 rounded-xl border-2 border-dashed bg-card p-5 text-left transition-all hover:bg-accent/30",
        a.border,
      )}
    >
      <input
        ref={ref}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.currentTarget.value = "";
        }}
      />
      <div className="flex items-center gap-3">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", a.bg)}>
          {loaded ? <CheckCircle2 className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
        </div>
        <div>
          <div className="text-sm font-semibold tracking-wide uppercase">{label}</div>
          <div className="text-xs text-muted-foreground">{sublabel}</div>
        </div>
      </div>
      {loaded ? (
        <div className="flex items-center gap-2 text-xs text-foreground/90">
          <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono truncate max-w-[220px]">{loaded.name}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{loaded.count} linhas</span>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">
          Clique para selecionar XLSX, XLS ou CSV
        </div>
      )}
    </button>
  );
}
