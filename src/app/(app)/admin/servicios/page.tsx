import Link from "next/link";
import { BotonEnlace, Boton } from "@/components/ui/boton";
import { Tabla } from "@/components/ui/tabla";
import {
  calcularAnticipo,
  formatearCop,
  TIPOS_SERVICIO,
  type TipoServicio,
} from "@/lib/servicios";
import { crearClienteServidor } from "@/lib/supabase/server";
import { alternarActivo } from "./actions";

export default async function PaginaServiciosAdmin() {
  const supabase = await crearClienteServidor();
  // El administrador ve todos los servicios, activos o no (RLS).
  const { data: servicios } = await supabase
    .from("servicios")
    .select("*")
    .order("orden")
    .order("nombre");

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-primario text-2xl font-bold">Servicios</h1>
          <p className="text-suave mt-1 max-w-md text-sm">
            Catálogo, precios y anticipo. Cada cambio de precio queda en la
            auditoría; las citas ya reservadas conservan el precio con el que se
            hicieron.
          </p>
        </div>
        <BotonEnlace href="/admin/servicios/nuevo">Nuevo servicio</BotonEnlace>
      </div>

      <Tabla
        filas={servicios ?? []}
        idFila={(s) => s.id}
        vacio={{ titulo: "Aún no hay servicios" }}
        columnas={[
          {
            clave: "nombre",
            titulo: "Servicio",
            render: (s) => (
              <>
                <p className="font-medium">{s.nombre}</p>
                <p className="text-suave text-xs">/{s.slug}</p>
              </>
            ),
          },
          {
            clave: "tipo",
            titulo: "Tipo",
            render: (s) => TIPOS_SERVICIO[s.tipo as TipoServicio] ?? s.tipo,
          },
          {
            clave: "precio",
            titulo: "Precio",
            render: (s) => formatearCop(s.precio_cop),
          },
          {
            clave: "anticipo",
            titulo: "Anticipo",
            render: (s) =>
              s.requiere_anticipo
                ? `${s.anticipo_pct}% · ${formatearCop(calcularAnticipo(s.precio_cop, s.anticipo_pct).anticipo)}`
                : "No requiere",
          },
          {
            clave: "estado",
            titulo: "Estado",
            render: (s) => (
              <span
                className={
                  s.activo
                    ? "bg-primario text-fondo rounded-full px-2.5 py-0.5 text-xs"
                    : "bg-borde text-texto rounded-full px-2.5 py-0.5 text-xs"
                }
              >
                {s.activo ? "Activo" : "Inactivo"}
              </span>
            ),
          },
          {
            clave: "acciones",
            titulo: "Acciones",
            render: (s) => (
              <div className="flex items-center gap-2">
                <Link
                  href={`/admin/servicios/${s.id}`}
                  className="text-primario inline-flex min-h-11 items-center px-2 text-sm font-medium underline"
                >
                  Editar
                </Link>
                <form action={alternarActivo.bind(null, s.id, !s.activo)}>
                  <Boton type="submit" variante="fantasma" tamano="sm">
                    {s.activo ? "Desactivar" : "Activar"}
                  </Boton>
                </form>
              </div>
            ),
          },
        ]}
      />
    </>
  );
}
