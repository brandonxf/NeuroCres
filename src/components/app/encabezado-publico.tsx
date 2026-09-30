import Link from "next/link";
import { Logo } from "@/components/marca/logo";
import { BotonEnlace } from "@/components/ui/boton";
import { crearClienteServidor } from "@/lib/supabase/server";

/** Encabezado de las páginas públicas: logo y acceso a la cuenta. */
export async function EncabezadoPublico() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  const conSesion = Boolean(data?.claims);

  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4">
      <Link href="/" aria-label="NeuroCres, inicio">
        <Logo />
      </Link>
      <div className="flex items-center gap-2">
        <BotonEnlace href="/servicios" variante="fantasma" tamano="sm">
          Servicios
        </BotonEnlace>
        {conSesion ? (
          <BotonEnlace href="/perfil" variante="secundario" tamano="sm">
            Mi cuenta
          </BotonEnlace>
        ) : (
          <BotonEnlace href="/ingresar" variante="secundario" tamano="sm">
            Ingresar
          </BotonEnlace>
        )}
      </div>
    </header>
  );
}
