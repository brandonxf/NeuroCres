"use client";

import { useActionState } from "react";
import { Aviso, BotonEnviar } from "@/components/auth/formulario";
import { Campo, CLASES_CONTROL } from "@/components/ui/campo";
import { Selector } from "@/components/ui/selector";
import { cn } from "@/lib/cn";
import { TIPOS_CONSENTIMIENTO } from "@/lib/validacion/consentimientos";
import { publicarPlantilla, type Resultado } from "./actions";

export function FormularioPlantilla() {
  const [resultado, accion, enviando] = useActionState<Resultado, FormData>(
    publicarPlantilla,
    {},
  );

  return (
    <form action={accion} className="flex flex-col gap-4">
      <Aviso error={resultado.error} />
      <Aviso
        tipo="exito"
        mensaje={resultado.ok ? "Versión nueva publicada." : undefined}
      />
      <Selector
        etiqueta="Tipo de texto"
        name="tipo"
        opciones={TIPOS_CONSENTIMIENTO}
      />
      <Campo etiqueta="Título" name="titulo" />
      <div className="flex flex-col gap-1">
        <label
          htmlFor="contenido"
          className="text-primario text-sm font-medium"
        >
          Texto (Markdown)
        </label>
        <textarea
          id="contenido"
          name="contenido"
          rows={12}
          className={cn(CLASES_CONTROL, "border-borde font-mono text-sm")}
        />
        <p className="text-suave text-xs">
          Al publicar, esta versión reemplaza a la vigente. Quienes ya firmaron
          la anterior conservan su constancia; se pedirá firmar de nuevo la
          versión nueva.
        </p>
      </div>
      <div>
        <BotonEnviar enviando={enviando}>Publicar versión nueva</BotonEnviar>
      </div>
    </form>
  );
}
