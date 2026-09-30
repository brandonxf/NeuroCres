"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Campo } from "@/components/ui/campo";
import { Aviso, BotonEnviar } from "@/components/auth/formulario";
import { esquemaIngreso, type DatosIngreso } from "@/lib/validacion/auth";
import { ingresar, type Resultado } from "../actions";

export function FormularioIngreso({
  siguiente,
  errorInicial,
}: {
  siguiente?: string;
  errorInicial?: string;
}) {
  const [resultado, setResultado] = useState<Resultado>({
    error: errorInicial,
  });
  const [enviando, iniciar] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DatosIngreso>({ resolver: zodResolver(esquemaIngreso) });

  const enviar = handleSubmit((datos) =>
    iniciar(async () => setResultado((await ingresar(datos, siguiente)) ?? {})),
  );

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
      <Aviso {...resultado} />
      <Campo
        etiqueta="Correo"
        type="email"
        autoComplete="email"
        error={errors.correo?.message}
        {...register("correo")}
      />
      <Campo
        etiqueta="Contraseña"
        type="password"
        autoComplete="current-password"
        error={errors.contrasena?.message}
        {...register("contrasena")}
      />
      <BotonEnviar enviando={enviando}>Ingresar</BotonEnviar>
      <div className="text-primario flex justify-between text-sm">
        <Link href="/recuperar" className="underline">
          Olvidé mi contraseña
        </Link>
        <Link href="/registro" className="underline">
          Crear cuenta
        </Link>
      </div>
    </form>
  );
}
