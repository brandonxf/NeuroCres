import Link from "next/link";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Tarjeta } from "@/components/ui/tarjeta";

export default function PaginaAdmin() {
  return (
    <>
      <h1 className="text-primario text-2xl font-bold">Administración</h1>
      <Link href="/admin/servicios" className="max-w-md">
        <Tarjeta className="hover:bg-primario/5 transition-colors">
          <p className="text-primario font-semibold">Servicios y precios</p>
          <p className="text-suave mt-1 text-sm">
            Catálogo, tarifas, anticipo y visibilidad de cada servicio.
          </p>
        </Tarjeta>
      </Link>
      <EstadoVacio
        titulo="Próximamente"
        descripcion="Aquí vivirán también las políticas y los reportes."
      />
    </>
  );
}
