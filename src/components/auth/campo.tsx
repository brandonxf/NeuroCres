import type { ComponentProps } from "react";

type Props = ComponentProps<"input"> & { etiqueta: string; error?: string };

export function Campo({ etiqueta, error, id, ...resto }: Props) {
  const idCampo = id ?? resto.name;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={idCampo} className="text-primario text-sm font-medium">
        {etiqueta}
      </label>
      <input
        id={idCampo}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${idCampo}-error` : undefined}
        className="border-secundario text-texto focus:border-primario focus:ring-primario/30 rounded-lg border bg-white px-3 py-2 outline-none focus:ring-2"
        {...resto}
      />
      {error && (
        <p id={`${idCampo}-error`} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
