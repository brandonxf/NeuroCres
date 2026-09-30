"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Campo } from "@/components/ui/campo";
import { Aviso, BotonEnviar } from "@/components/auth/formulario";
import { esquemaRegistro, type DatosRegistro } from "@/lib/validacion/auth";
import { registrar, type Resultado } from "../actions";

export function FormularioRegistro() {
  const [resultado, setResultado] = useState<Resultado>({});
  const [enviando, iniciar] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DatosRegistro>({ resolver: zodResolver(esquemaRegistro) });

  const enviar = handleSubmit((datos) =>
    iniciar(async () => {
      const r = await registrar(datos);
      setResultado(r);
      if (r.mensaje) reset();
    }),
  );

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
      <Aviso {...resultado} />
      <Campo
        etiqueta="Nombres"
        autoComplete="given-name"
        error={errors.nombres?.message}
        {...register("nombres")}
      />
      <Campo
        etiqueta="Apellidos"
        autoComplete="family-name"
        error={errors.apellidos?.message}
        {...register("apellidos")}
      />
      <Campo
        etiqueta="Teléfono"
        type="tel"
        autoComplete="tel"
        error={errors.telefono?.message}
        {...register("telefono")}
      />
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
        autoComplete="new-password"
        error={errors.contrasena?.message}
        {...register("contrasena")}
      />
      <Campo
        etiqueta="Confirma tu contraseña"
        type="password"
        autoComplete="new-password"
        error={errors.confirmacion?.message}
        {...register("confirmacion")}
      />
      <BotonEnviar enviando={enviando}>Crear cuenta</BotonEnviar>
      <p className="text-primario text-sm">
        ¿Ya tienes cuenta?{" "}
        <Link href="/ingresar" className="underline">
          Ingresa
        </Link>
      </p>
    </form>
  );
}
