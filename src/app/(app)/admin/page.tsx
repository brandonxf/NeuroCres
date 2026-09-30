import Link from "next/link";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Tarjeta } from "@/components/ui/tarjeta";

export default function PaginaAdmin() {
  return (
    <>
      <h1 className="text-primario text-2xl font-bold">Administración</h1>
      <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
        <Link href="/admin/servicios">
          <Tarjeta className="hover:bg-primario/5 h-full transition-colors">
            <p className="text-primario font-semibold">Servicios y precios</p>
            <p className="text-suave mt-1 text-sm">
              Catálogo, tarifas, anticipo y visibilidad de cada servicio.
            </p>
          </Tarjeta>
        </Link>
        <Link href="/admin/agenda">
          <Tarjeta className="hover:bg-primario/5 h-full transition-colors">
            <p className="text-primario font-semibold">
              Parámetros de la agenda
            </p>
            <p className="text-suave mt-1 text-sm">
              Descanso entre citas, antelación, horizonte y horarios.
            </p>
          </Tarjeta>
        </Link>
      </div>
      <EstadoVacio
        titulo="Próximamente"
        descripcion="Aquí vivirán también las políticas y los reportes."
      />
    </>
  );
}
