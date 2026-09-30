import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Variante = "primario" | "secundario" | "fantasma" | "peligro";
type Tamano = "md" | "sm";

const VARIANTES: Record<Variante, string> = {
  primario: "bg-primario text-fondo hover:bg-primario-oscuro",
  secundario:
    "border border-primario text-primario hover:bg-primario/10 bg-transparent",
  fantasma: "text-primario hover:bg-primario/10 bg-transparent",
  peligro: "bg-error text-white hover:bg-error/90",
};

const TAMANOS: Record<Tamano, string> = {
  md: "min-h-11 px-4 py-2",
  sm: "min-h-9 px-3 py-1.5 text-sm",
};

export function clasesBoton(
  variante: Variante = "primario",
  tamano: Tamano = "md",
  extra?: string,
) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-control font-medium transition-colors",
    "disabled:pointer-events-none disabled:opacity-60",
    VARIANTES[variante],
    TAMANOS[tamano],
    extra,
  );
}

type PropsBoton = ComponentProps<"button"> & {
  variante?: Variante;
  tamano?: Tamano;
  cargando?: boolean;
};

export function Boton({
  variante,
  tamano,
  cargando,
  className,
  children,
  disabled,
  type = "button",
  ...resto
}: PropsBoton) {
  return (
    <button
      type={type}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={clasesBoton(variante, tamano, className)}
      {...resto}
    >
      {cargando ? "Un momento…" : children}
    </button>
  );
}

type PropsEnlace = ComponentProps<typeof Link> & {
  variante?: Variante;
  tamano?: Tamano;
};

export function BotonEnlace({
  variante,
  tamano,
  className,
  ...resto
}: PropsEnlace) {
  return (
    <Link className={clasesBoton(variante, tamano, className)} {...resto} />
  );
}
