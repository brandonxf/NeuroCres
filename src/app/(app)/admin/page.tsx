import { EstadoVacio } from "@/components/ui/estado-vacio";

export default function PaginaAdmin() {
  return (
    <>
      <h1 className="text-primario text-2xl font-bold">Administración</h1>
      <EstadoVacio
        titulo="Próximamente"
        descripcion="Aquí vivirán los servicios, precios, políticas y reportes."
      />
    </>
  );
}
