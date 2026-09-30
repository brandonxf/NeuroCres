import { cn } from "@/lib/cn";

export function Cargando({ texto = "Cargando" }: { texto?: string }) {
  return (
    <div
      role="status"
      className="text-suave flex items-center justify-center gap-3 py-10"
    >
      <span
        aria-hidden="true"
        className="border-secundario border-t-primario size-5 animate-spin rounded-full border-2"
      />
      <span>{texto}…</span>
    </div>
  );
}

export function Esqueleto({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "rounded-control bg-secundario/40 animate-pulse",
        className,
      )}
    />
  );
}
