"use client";

import { useActionState, useRef, useState, type ReactNode } from "react";
import { Aviso, BotonEnviar } from "@/components/auth/formulario";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { firmarConsentimiento, type Resultado } from "./actions";

/** Cuadro para dibujar la firma con el dedo o el ratón. Es opcional. */
function PadFirma({ onCambio }: { onCambio: (dataUrl: string) => void }) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const [vacio, setVacio] = useState(true);

  const punto = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * e.currentTarget.width,
      y: ((e.clientY - r.top) / r.height) * e.currentTarget.height,
    };
  };

  const empezar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dibujando.current = true;
    const { x, y } = punto(e);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#214B45";
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const mover = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dibujando.current) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const { x, y } = punto(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const terminar = () => {
    if (!dibujando.current) return;
    dibujando.current = false;
    setVacio(false);
    if (lienzo.current) onCambio(lienzo.current.toDataURL("image/png"));
  };

  const borrar = () => {
    const c = lienzo.current;
    c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    setVacio(true);
    onCambio("");
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-primario text-sm font-medium">
        Firma dibujada (opcional)
      </p>
      <canvas
        ref={lienzo}
        width={600}
        height={200}
        aria-label="Espacio para dibujar tu firma"
        className="border-borde h-32 w-full touch-none rounded-lg border bg-white"
        onPointerDown={empezar}
        onPointerMove={mover}
        onPointerUp={terminar}
        onPointerLeave={terminar}
      />
      <div>
        <Boton
          variante="fantasma"
          tamano="sm"
          onClick={borrar}
          disabled={vacio}
        >
          Borrar firma
        </Boton>
      </div>
    </div>
  );
}

type Props = {
  personaId: string;
  plantillaId: string;
  titulo: string;
  nombreSugerido: string;
  documentoSugerido: string;
  requiereAsentimiento: boolean;
  /** El texto a firmar, ya renderizado en el servidor. */
  children: ReactNode;
};

export function FirmaConsentimiento({
  personaId,
  plantillaId,
  titulo,
  nombreSugerido,
  documentoSugerido,
  requiereAsentimiento,
  children,
}: Props) {
  const [resultado, accion, enviando] = useActionState<Resultado, FormData>(
    firmarConsentimiento,
    {},
  );
  const [trazo, setTrazo] = useState("");

  return (
    <Tarjeta className="flex flex-col gap-4">
      <h2 className="text-primario text-lg font-semibold">{titulo}</h2>
      <div className="border-borde max-h-80 overflow-y-auto rounded-lg border bg-white p-4">
        {children}
      </div>

      <form action={accion} className="flex flex-col gap-4">
        <Aviso error={resultado.error} />
        <input type="hidden" name="personaId" value={personaId} />
        <input type="hidden" name="plantillaId" value={plantillaId} />
        <input type="hidden" name="trazo" value={trazo} />

        <Campo
          etiqueta="Nombre completo de quien firma"
          name="nombre"
          defaultValue={nombreSugerido}
          autoComplete="name"
        />
        <Campo
          etiqueta="Documento de quien firma"
          name="documento"
          defaultValue={documentoSugerido}
          ayuda="Por ejemplo: CC 1234567890"
        />

        <PadFirma onCambio={setTrazo} />

        {requiereAsentimiento && (
          <label className="flex items-start gap-2">
            <input type="checkbox" name="asentimiento" className="mt-1" />
            <span className="text-sm">
              El menor entendió, con palabras sencillas, en qué consiste el
              servicio y está de acuerdo en participar (asentimiento).
            </span>
          </label>
        )}

        <label className="flex items-start gap-2">
          <input type="checkbox" name="acepto" className="mt-1" />
          <span className="text-sm">
            Leí el texto anterior y lo acepto. Entiendo que quedará registrado
            con mi nombre, la fecha y la hora, y que no se puede modificar.
          </span>
        </label>

        <div>
          <BotonEnviar enviando={enviando}>Firmar</BotonEnviar>
        </div>
      </form>
    </Tarjeta>
  );
}
