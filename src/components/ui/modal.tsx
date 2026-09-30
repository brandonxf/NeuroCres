"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/** Ventana modal sobre <dialog>: el navegador ya gestiona el foco, Escape y el fondo inerte. */
export function Modal({
  abierto,
  onCerrar,
  titulo,
  children,
  pie,
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  children: ReactNode;
  pie?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (abierto && !dialogo.open) dialogo.showModal();
    if (!abierto && dialogo.open) dialogo.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitulo}
      onClose={onCerrar}
      onClick={(e) => {
        // Clic en el fondo (fuera del contenido) cierra.
        if (e.target === ref.current) onCerrar();
      }}
      className="rounded-tarjeta border-borde bg-superficie text-texto backdrop:bg-texto/50 m-auto w-[calc(100%-2rem)] max-w-md border p-0 shadow-xl"
    >
      <div className="flex flex-col gap-4 p-6">
        <h2 id={idTitulo} className="text-primario text-lg font-semibold">
          {titulo}
        </h2>
        <div className="text-sm">{children}</div>
        {pie && <div className="flex justify-end gap-2">{pie}</div>}
      </div>
    </dialog>
  );
}
