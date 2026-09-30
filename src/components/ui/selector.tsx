import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { CLASES_CONTROL } from "./campo";

type Props = ComponentProps<"select"> & {
  etiqueta: string;
  error?: string;
  opciones: Record<string, string>;
  placeholder?: string;
};

export function Selector({
  etiqueta,
  error,
  id,
  opciones,
  placeholder,
  ...resto
}: Props) {
  const idCampo = id ?? resto.name;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={idCampo} className="text-primario text-sm font-medium">
        {etiqueta}
      </label>
      <select
        id={idCampo}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${idCampo}-error` : undefined}
        className={cn(CLASES_CONTROL, error ? "border-error" : "border-borde")}
        {...resto}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {Object.entries(opciones).map(([valor, texto]) => (
          <option key={valor} value={valor}>
            {texto}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${idCampo}-error`} className="text-error text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
