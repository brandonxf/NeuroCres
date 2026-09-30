import Link from "next/link";
import { cerrarSesion } from "@/app/(auth)/actions";
import { Logo } from "@/components/marca/logo";
import { Boton } from "@/components/ui/boton";
import { NavPrincipal, type ItemNav } from "./nav-principal";

export function Encabezado({
  nombre,
  items,
}: {
  nombre: string;
  items: ItemNav[];
}) {
  return (
    <header className="border-borde bg-superficie border-b">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between md:gap-6">
        <div className="flex items-center justify-between gap-4">
          <Link href="/perfil" aria-label="NeuroCres, ir al inicio">
            <Logo />
          </Link>
          <form action={cerrarSesion} className="md:hidden">
            <Boton type="submit" variante="fantasma" tamano="sm">
              Salir
            </Boton>
          </form>
        </div>
        <NavPrincipal items={items} />
        <div className="hidden items-center gap-3 md:flex">
          <span className="text-suave max-w-40 truncate text-sm">{nombre}</span>
          <form action={cerrarSesion}>
            <Boton type="submit" variante="secundario" tamano="sm">
              Cerrar sesión
            </Boton>
          </form>
        </div>
      </div>
    </header>
  );
}
