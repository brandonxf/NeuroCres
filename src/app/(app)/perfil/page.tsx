import Link from "next/link";
import { Tarjeta } from "@/components/ui/tarjeta";
import { obtenerRoles } from "@/lib/auth/roles";
import { personasDelUsuario } from "@/lib/personas";

export default async function PaginaInicio() {
  const { user, personas, responsable } = await personasDelUsuario();
  const roles = await obtenerRoles();
  const primerNombre = responsable.nombre.split(" ")[0];

  return (
    <>
      <div>
        <h1 className="text-primario text-2xl font-bold">
          Hola{primerNombre ? `, ${primerNombre}` : ""}
        </h1>
        <p className="text-suave mt-1">
          Un espacio para comprenderte, orientarte y cuidar de tu bienestar.
        </p>
      </div>

      <section aria-labelledby="accesos" className="grid gap-4 sm:grid-cols-2">
        <h2 id="accesos" className="sr-only">
          Accesos
        </h2>
        <Enlace
          href="/mis-personas"
          titulo="Mis personas"
          texto={
            personas.length === 0
              ? "Registra tus datos o los de quien tienes a cargo."
              : `${personas.length} ${personas.length === 1 ? "persona registrada" : "personas registradas"}.`
          }
        />
        {roles.includes("profesional") && (
          <Enlace
            href="/profesional"
            titulo="Mi consulta"
            texto="Agenda, consultantes y pagos por verificar."
          />
        )}
        {roles.includes("administrador") && (
          <Enlace
            href="/admin"
            titulo="Administración"
            texto="Servicios, precios, políticas y reportes."
          />
        )}
      </section>

      <Tarjeta>
        <h2 className="text-primario mb-3 font-semibold">Datos de tu cuenta</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-primario font-medium">Nombre</dt>
          <dd>{responsable.nombre || "—"}</dd>
          <dt className="text-primario font-medium">Correo</dt>
          <dd className="break-all">{responsable.correo || user.email}</dd>
          <dt className="text-primario font-medium">Teléfono</dt>
          <dd>{responsable.telefono || "—"}</dd>
        </dl>
      </Tarjeta>
    </>
  );
}

function Enlace({
  href,
  titulo,
  texto,
}: {
  href: string;
  titulo: string;
  texto: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-tarjeta border-borde bg-superficie hover:border-primario border p-5 shadow-sm transition-colors"
    >
      <p className="text-primario font-semibold group-hover:underline">
        {titulo} →
      </p>
      <p className="text-suave mt-1 text-sm">{texto}</p>
    </Link>
  );
}
