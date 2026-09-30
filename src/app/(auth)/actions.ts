"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import {
  esquemaIngreso,
  esquemaRecuperar,
  esquemaRegistro,
  esquemaRestablecer,
  type DatosIngreso,
  type DatosRecuperar,
  type DatosRegistro,
  type DatosRestablecer,
} from "@/lib/validacion/auth";

export type Resultado = { error?: string; mensaje?: string };

const urlApp = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Solo rutas internas: evita redirecciones abiertas. */
function rutaSegura(ruta: string | undefined) {
  return ruta && ruta.startsWith("/") && !ruta.startsWith("//")
    ? ruta
    : "/perfil";
}

export async function ingresar(
  datos: DatosIngreso,
  siguiente?: string,
): Promise<Resultado> {
  const parsed = esquemaIngreso.safeParse(datos);
  if (!parsed.success) return { error: "Revisa los datos ingresados." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.correo,
    password: parsed.data.contrasena,
  });

  if (error) {
    return {
      error:
        error.code === "email_not_confirmed"
          ? "Debes verificar tu correo antes de ingresar. Revisa tu bandeja de entrada."
          : "Correo o contraseña incorrectos.",
    };
  }

  redirect(rutaSegura(siguiente));
}

export async function registrar(datos: DatosRegistro): Promise<Resultado> {
  const parsed = esquemaRegistro.safeParse(datos);
  if (!parsed.success) return { error: "Revisa los datos ingresados." };

  const { nombres, apellidos, telefono, correo, contrasena } = parsed.data;
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signUp({
    email: correo,
    password: contrasena,
    options: {
      data: { nombres, apellidos, telefono },
      emailRedirectTo: `${urlApp()}/auth/callback`,
    },
  });

  if (error) {
    return {
      error:
        error.code === "weak_password"
          ? "La contraseña es demasiado débil."
          : "No pudimos crear la cuenta. Intenta de nuevo en unos minutos.",
    };
  }

  return {
    mensaje:
      "Te enviamos un correo para verificar tu cuenta. Ábrelo y sigue el enlace para terminar el registro.",
  };
}

export async function solicitarRecuperacion(
  datos: DatosRecuperar,
): Promise<Resultado> {
  const parsed = esquemaRecuperar.safeParse(datos);
  if (!parsed.success) return { error: "Escribe un correo válido." };

  const supabase = await crearClienteServidor();
  await supabase.auth.resetPasswordForEmail(parsed.data.correo, {
    redirectTo: `${urlApp()}/auth/callback?siguiente=/restablecer`,
  });

  // Misma respuesta exista o no la cuenta, para no revelar qué correos están registrados.
  return {
    mensaje:
      "Si el correo está registrado, te enviamos un enlace para crear una nueva contraseña.",
  };
}

export async function restablecerContrasena(
  datos: DatosRestablecer,
): Promise<Resultado> {
  const parsed = esquemaRestablecer.safeParse(datos);
  if (!parsed.success) return { error: "Revisa los datos ingresados." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.contrasena,
  });

  if (error) {
    return {
      error:
        "No pudimos cambiar la contraseña. Solicita un nuevo enlace e intenta de nuevo.",
    };
  }

  redirect("/perfil");
}

export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect("/ingresar");
}
