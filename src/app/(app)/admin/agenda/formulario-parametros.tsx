"use client";

import { useActionState } from "react";
import { Aviso, BotonEnviar } from "@/components/auth/formulario";
import { Campo } from "@/components/ui/campo";
import { Selector } from "@/components/ui/selector";
import type { ParametrosAgenda } from "@/lib/agenda/horarios";
import { guardarParametrosAgenda, type Resultado } from "./actions";

export function FormularioParametros({
  inicial,
}: {
  inicial: ParametrosAgenda;
}) {
  const [resultado, accion, enviando] = useActionState<Resultado, FormData>(
    guardarParametrosAgenda,
    {},
  );

  return (
    <form action={accion} className="flex flex-col gap-4">
      <Aviso error={resultado.error} />
      <Aviso
        tipo="exito"
        mensaje={resultado.ok ? "Cambios guardados." : undefined}
      />
      <Campo
        etiqueta="Descanso entre citas (minutos)"
        name="descansoMin"
        inputMode="numeric"
        defaultValue={inicial.descansoMin}
      />
      <Campo
        etiqueta="Antelación mínima para reservar (horas)"
        name="antelacionMinHoras"
        inputMode="numeric"
        defaultValue={inicial.antelacionMinHoras}
      />
      <Campo
        etiqueta="Horizonte máximo para reservar (días)"
        name="horizonteDias"
        inputMode="numeric"
        defaultValue={inicial.horizonteDias}
      />
      <Selector
        etiqueta="Separación entre horarios ofrecidos"
        name="granularidadMin"
        opciones={{ "15": "Cada 15 minutos", "30": "Cada 30 minutos" }}
        defaultValue={String(inicial.granularidadMin)}
      />
      <div>
        <BotonEnviar enviando={enviando}>Guardar</BotonEnviar>
      </div>
    </form>
  );
}
