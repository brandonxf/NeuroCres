import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Props = ComponentProps<"input"> & {
  etiqueta: string;
  error?: string;
  ayuda?: string;
};

export const CLASES_CONTROL =
  "min-h-11 rounded-control border bg-white px-3 py-2 text-texto placeholder:text-suave/70";

export function Campo({
  etiqueta,
  error,
  ayuda,
  id,
  className,
  ...resto
}: Props) {
  const idCampo = id ?? resto.name;
  const descripciones =
    [ayuda && `${idCampo}-ayuda`, error && `${idCampo}-error`]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={idCampo} className="text-primario text-sm font-medium">
        {etiqueta}
      </label>
      <input
        id={idCampo}
        aria-invalid={Boolean(error)}
        aria-describedby={descripciones}
        className={cn(
          CLASES_CONTROL,
          error ? "border-error" : "border-borde",
          className,
        )}
        {...resto}
      />
      {ayuda && (
        <p id={`${idCampo}-ayuda`} className="text-suave text-xs">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={`${idCampo}-error`} className="text-error text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
