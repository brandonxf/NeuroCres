"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Campo } from "@/components/auth/campo";
import { Aviso, BotonEnviar } from "@/components/auth/formulario";
import {
  esquemaRestablecer,
  type DatosRestablecer,
} from "@/lib/validacion/auth";
import { restablecerContrasena, type Resultado } from "../actions";

export function FormularioRestablecer() {
  const [resultado, setResultado] = useState<Resultado>({});
  const [enviando, iniciar] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DatosRestablecer>({ resolver: zodResolver(esquemaRestablecer) });

  const enviar = handleSubmit((datos) =>
    iniciar(async () =>
      setResultado((await restablecerContrasena(datos)) ?? {}),
    ),
  );

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
      <Aviso {...resultado} />
      <Campo
        etiqueta="Nueva contraseña"
        type="password"
        autoComplete="new-password"
        error={errors.contrasena?.message}
        {...register("contrasena")}
      />
      <Campo
        etiqueta="Confirma la nueva contraseña"
        type="password"
        autoComplete="new-password"
        error={errors.confirmacion?.message}
        {...register("confirmacion")}
      />
      <BotonEnviar enviando={enviando}>Guardar contraseña</BotonEnviar>
    </form>
  );
}
