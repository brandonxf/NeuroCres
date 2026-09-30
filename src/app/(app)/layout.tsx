import { Encabezado } from "@/components/app/encabezado";
import type { ItemNav } from "@/components/app/nav-principal";
import { obtenerRoles } from "@/lib/auth/roles";
import { usuarioActual } from "@/lib/personas";

export default async function LayoutApp({ children }: LayoutProps<"/">) {
  const { responsable } = await usuarioActual();
  const roles = await obtenerRoles();

  // Navegación por rol. Se suman las secciones de cada rol que tenga la cuenta.
  const items: ItemNav[] = [
    { href: "/perfil", etiqueta: "Inicio" },
    { href: "/agendar", etiqueta: "Agendar" },
    { href: "/mis-citas", etiqueta: "Mis citas" },
    { href: "/mis-personas", etiqueta: "Mis personas" },
  ];
  if (roles.includes("profesional")) {
    items.push({ href: "/profesional", etiqueta: "Mi consulta" });
  }
  if (roles.includes("administrador")) {
    items.push({ href: "/admin", etiqueta: "Administración" });
  }

  return (
    <>
      <a
        href="#contenido"
        className="focus:rounded-control focus:bg-primario focus:text-fondo sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-3 focus:py-2"
      >
        Saltar al contenido
      </a>
      <Encabezado
        nombre={responsable.nombre || responsable.correo}
        items={items}
      />
      <main
        id="contenido"
        className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8"
      >
        {children}
      </main>
    </>
  );
}
