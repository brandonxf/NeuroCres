"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Campo } from "@/components/auth/campo";
import { Aviso, BotonEnviar } from "@/components/auth/formulario";
import { esquemaRecuperar, type DatosRecuperar } from "@/lib/validacion/auth";
import { solicitarRecuperacion, type Resultado } from "../actions";

export function FormularioRecuperar() {
  const [resultado, setResultado] = useState<Resultado>({});
  const [enviando, iniciar] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DatosRecuperar>({ resolver: zodResolver(esquemaRecuperar) });

  const enviar = handleSubmit((datos) =>
    iniciar(async () => setResultado(await solicitarRecuperacion(datos))),
  );

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
      <p className="text-sm">
        Escribe tu correo y te enviaremos un enlace para crear una nueva
        contraseña.
      </p>
      <Aviso {...resultado} />
      <Campo
        etiqueta="Correo"
        type="email"
        autoComplete="email"
        error={errors.correo?.message}
        {...register("correo")}
      />
      <BotonEnviar enviando={enviando}>Enviar enlace</BotonEnviar>
      <Link href="/ingresar" className="text-primario text-sm underline">
        Volver a ingresar
      </Link>
    </form>
  );
}
