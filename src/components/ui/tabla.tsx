import type { ReactNode } from "react";
import { EstadoVacio } from "./estado-vacio";

export type Columna<T> = {
  clave: string;
  titulo: string;
  render: (fila: T) => ReactNode;
  className?: string;
};

export function Tabla<T>({
  columnas,
  filas,
  idFila,
  vacio,
}: {
  columnas: Columna<T>[];
  filas: T[];
  idFila: (fila: T) => string;
  vacio?: { titulo: string; descripcion?: string };
}) {
  if (filas.length === 0) {
    return (
      <EstadoVacio
        titulo={vacio?.titulo ?? "Sin resultados"}
        descripcion={vacio?.descripcion}
      />
    );
  }

  return (
    <div className="rounded-tarjeta border-borde bg-superficie overflow-x-auto border">
      <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
        <thead>
          <tr className="bg-primario text-fondo">
            {columnas.map((c) => (
              <th key={c.clave} scope="col" className="px-4 py-2.5 font-medium">
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={idFila(fila)} className="border-borde border-t">
              {columnas.map((c) => (
                <td key={c.clave} className={c.className ?? "px-4 py-2.5"}>
                  {c.render(fila)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
