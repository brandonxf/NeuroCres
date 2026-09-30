import type { ReactNode } from "react";
import { Tarjeta } from "./tarjeta";

export function EstadoVacio({
  titulo,
  descripcion,
  accion,
}: {
  titulo: string;
  descripcion?: string;
  accion?: ReactNode;
}) {
  return (
    <Tarjeta className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span
        aria-hidden="true"
        className="bg-secundario/30 text-primario mb-1 grid size-12 place-items-center rounded-full text-2xl"
      >
        ○
      </span>
      <p className="text-primario font-semibold">{titulo}</p>
      {descripcion && (
        <p className="text-suave max-w-sm text-sm">{descripcion}</p>
      )}
      {accion && <div className="mt-3">{accion}</div>}
    </Tarjeta>
  );
}
