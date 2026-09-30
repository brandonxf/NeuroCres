"use client";

import { useActionState } from "react";
import { Aviso, BotonEnviar } from "@/components/auth/formulario";
import { Campo, CLASES_CONTROL } from "@/components/ui/campo";
import { cn } from "@/lib/cn";
import { cancelarCita, subirComprobante, type Resultado } from "./actions";

export function FormularioComprobante({ pagoId }: { pagoId: string }) {
  const [resultado, accion, enviando] = useActionState<Resultado, FormData>(
    subirComprobante,
    {},
  );

  return (
    <form action={accion} className="flex flex-col gap-3">
      <Aviso error={resultado.error} />
      <Aviso
        tipo="exito"
        mensaje={
          resultado.ok
            ? "Recibimos tu comprobante. La profesional lo verificará pronto."
            : undefined
        }
      />
      <input type="hidden" name="pagoId" value={pagoId} />
      <div className="flex flex-col gap-1">
        <label htmlFor="archivo" className="text-primario text-sm font-medium">
          Comprobante (foto o PDF, máximo 5 MB)
        </label>
        <input
          id="archivo"
          name="archivo"
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          className={cn(CLASES_CONTROL, "border-borde")}
        />
      </div>
      <Campo
        etiqueta="Número de referencia (opcional)"
        name="referencia"
        maxLength={100}
      />
      <div>
        <BotonEnviar enviando={enviando}>Enviar comprobante</BotonEnviar>
      </div>
    </form>
  );
}

export function FormularioCancelar({ citaId }: { citaId: string }) {
  const [resultado, accion, enviando] = useActionState<Resultado, FormData>(
    cancelarCita,
    {},
  );

  return (
    <form action={accion} className="flex flex-col gap-3">
      <Aviso error={resultado.error} />
      <input type="hidden" name="citaId" value={citaId} />
      <div className="flex flex-col gap-1">
        <label htmlFor="motivo" className="text-primario text-sm font-medium">
          Motivo (opcional)
        </label>
        <input
          id="motivo"
          name="motivo"
          maxLength={300}
          className={cn(CLASES_CONTROL, "border-borde")}
        />
      </div>
      <label className="flex items-start gap-2">
        <input type="checkbox" name="entiendo" className="mt-1" />
        <span className="text-sm">
          Entiendo lo que pasará con mi anticipo y quiero cancelar la cita.
        </span>
      </label>
      <div>
        <BotonEnviar enviando={enviando}>Cancelar la cita</BotonEnviar>
      </div>
    </form>
  );
}
