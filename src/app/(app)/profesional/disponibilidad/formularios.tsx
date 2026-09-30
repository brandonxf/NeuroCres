"use client";

import { useActionState } from "react";
import { Aviso, BotonEnviar } from "@/components/auth/formulario";
import { Campo, CLASES_CONTROL } from "@/components/ui/campo";
import { Selector } from "@/components/ui/selector";
import { cn } from "@/lib/cn";
import { DIAS_SEMANA } from "@/lib/validacion/agenda";
import { agregarBloqueo, agregarFranja, type Resultado } from "./actions";

const INICIAL: Resultado = {};

export function FormularioFranja() {
  const [resultado, accion, enviando] = useActionState(agregarFranja, INICIAL);

  return (
    <form action={accion} className="flex flex-col gap-3">
      <Aviso error={resultado.error} />
      <div className="grid grid-cols-3 gap-3">
        <Selector
          etiqueta="Día"
          name="diaSemana"
          opciones={DIAS_SEMANA}
          defaultValue="1"
        />
        <Campo
          etiqueta="Desde"
          name="horaInicio"
          type="time"
          defaultValue="08:00"
        />
        <Campo
          etiqueta="Hasta"
          name="horaFin"
          type="time"
          defaultValue="12:00"
        />
      </div>
      <fieldset className="flex flex-wrap gap-x-4">
        <legend className="sr-only">Modalidades</legend>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            name="modalidades"
            value="presencial"
            defaultChecked
          />
          Presencial
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            name="modalidades"
            value="virtual"
            defaultChecked
          />
          Virtual
        </label>
      </fieldset>
      <div>
        <BotonEnviar enviando={enviando}>Agregar franja</BotonEnviar>
      </div>
    </form>
  );
}

export function FormularioBloqueo() {
  const [resultado, accion, enviando] = useActionState(agregarBloqueo, INICIAL);

  return (
    <form action={accion} className="flex flex-col gap-3">
      <Aviso error={resultado.error} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Desde" name="inicio" type="datetime-local" />
        <Campo etiqueta="Hasta" name="fin" type="datetime-local" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="motivo" className="text-primario text-sm font-medium">
          Motivo (solo lo ves tú)
        </label>
        <input
          id="motivo"
          name="motivo"
          maxLength={300}
          className={cn(CLASES_CONTROL, "border-borde")}
        />
      </div>
      <div>
        <BotonEnviar enviando={enviando}>Bloquear</BotonEnviar>
      </div>
    </form>
  );
}
