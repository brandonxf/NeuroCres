import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tipo = "info" | "exito" | "atencion" | "error";

const ESTILOS: Record<Tipo, string> = {
  info: "border-secundario bg-secundario/25 text-primario",
  exito: "border-primario/40 bg-primario/10 text-primario",
  atencion: "border-acento bg-acento/20 text-texto",
  error: "border-error/40 bg-error/10 text-error",
};

export function Aviso({
  tipo,
  error,
  mensaje,
  children,
  className,
}: {
  tipo?: Tipo;
  /** Atajo: texto de error. */
  error?: string;
  /** Atajo: texto informativo. */
  mensaje?: string;
  children?: ReactNode;
  className?: string;
}) {
  const contenido = children ?? error ?? mensaje;
  if (!contenido) return null;
  const variante: Tipo = tipo ?? (error ? "error" : "info");

  return (
    <div
      role={variante === "error" ? "alert" : "status"}
      className={cn(
        "rounded-control border px-3 py-2 text-sm",
        ESTILOS[variante],
        className,
      )}
    >
      {contenido}
    </div>
  );
}
