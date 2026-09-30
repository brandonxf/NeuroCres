import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const RUTAS_PUBLICAS = [
  "/privacidad",
  "/politica-cancelacion",
  "/",
  "/servicios",
  "/ingresar",
  "/registro",
  "/recuperar",
  "/auth",
];
const RUTAS_SOLO_ANONIMO = ["/ingresar", "/registro", "/recuperar"];

function coincide(ruta: string, prefijo: string) {
  return prefijo === "/"
    ? ruta === "/"
    : ruta === prefijo || ruta.startsWith(`${prefijo}/`);
}

/** Renueva la sesión por cookie y aplica la protección de rutas. */
export async function actualizarSesion(request: NextRequest) {
  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesAEscribir) => {
          cookiesAEscribir.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          respuesta = NextResponse.next({ request });
          cookiesAEscribir.forEach(({ name, value, options }) =>
            respuesta.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const hayUsuario = Boolean(data?.claims);
  const ruta = request.nextUrl.pathname;

  const redirigir = (destino: string, params?: Record<string, string>) => {
    const url = request.nextUrl.clone();
    url.pathname = destino;
    url.search = "";
    Object.entries(params ?? {}).forEach(([k, v]) =>
      url.searchParams.set(k, v),
    );
    const redireccion = NextResponse.redirect(url);
    respuesta.cookies
      .getAll()
      .forEach((c) => redireccion.cookies.set(c.name, c.value));
    return redireccion;
  };

  if (!hayUsuario && !RUTAS_PUBLICAS.some((p) => coincide(ruta, p))) {
    return redirigir("/ingresar", { siguiente: ruta });
  }

  if (hayUsuario && RUTAS_SOLO_ANONIMO.some((p) => coincide(ruta, p))) {
    return redirigir("/perfil");
  }

  return respuesta;
}
