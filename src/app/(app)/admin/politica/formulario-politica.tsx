"use client";

import { useActionState } from "react";
import { Aviso, BotonEnviar } from "@/components/auth/formulario";
import { Campo, CLASES_CONTROL } from "@/components/ui/campo";
import { cn } from "@/lib/cn";
import type { ReglasPolitica } from "@/lib/politica";
import { publicarPolitica, type Resultado } from "./actions";

export function FormularioPolitica({
  reglas,
  contenido,
}: {
  reglas: ReglasPolitica;
  contenido: string;
}) {
  const [resultado, accion, enviando] = useActionState<Resultado, FormData>(
    publicarPolitica,
    {},
  );

  return (
    <form action={accion} className="flex flex-col gap-4">
      <Aviso error={resultado.error} />
      <Aviso
        tipo="exito"
        mensaje={resultado.ok ? "Versión nueva publicada." : undefined}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo
          etiqueta="Horas para cancelar sin costo"
          name="horasSinCosto"
          inputMode="numeric"
          defaultValue={reglas.horas_sin_costo}
        />
        <Campo
          etiqueta="Horas mínimas antes de la cita"
          name="horasMinimo"
          inputMode="numeric"
          defaultValue={reglas.horas_minimo}
          ayuda="Con menos de esto se cobra la sesión completa."
        />
        <Campo
          etiqueta="Cobro entre ambos límites (%)"
          name="cobroIntermedio"
          inputMode="numeric"
          defaultValue={reglas.porcentaje_cobro_intermedio}
        />
        <Campo
          etiqueta="Cobro con menos de las horas mínimas (%)"
          name="cobroTardio"
          inputMode="numeric"
          defaultValue={reglas.porcentaje_cobro_tardio}
        />
        <Campo
          etiqueta="Reprogramaciones gratuitas"
          name="reprogramacionesGratis"
          inputMode="numeric"
          defaultValue={reglas.reprogramaciones_gratis}
          ayuda="En el tramo intermedio, por proceso."
        />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="contenido"
          className="text-primario text-sm font-medium"
        >
          Texto que se muestra y se acepta (Markdown)
        </label>
        <textarea
          id="contenido"
          name="contenido"
          rows={14}
          defaultValue={contenido}
          className={cn(CLASES_CONTROL, "border-borde font-mono text-sm")}
        />
        <p className="text-suave text-xs">
          Los números de arriba son los que aplica el sistema; el texto es lo
          que lee la persona. Procura que digan lo mismo. Al publicar se crea
          una versión nueva; las citas ya reservadas conservan la versión que
          aceptaron.
        </p>
      </div>
      <div>
        <BotonEnviar enviando={enviando}>Publicar versión nueva</BotonEnviar>
      </div>
    </form>
  );
}
