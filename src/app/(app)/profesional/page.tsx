import Link from "next/link";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Tarjeta } from "@/components/ui/tarjeta";

export default function PaginaProfesional() {
  return (
    <>
      <h1 className="text-primario text-2xl font-bold">Mi consulta</h1>
      <Link href="/profesional/disponibilidad" className="max-w-md">
        <Tarjeta className="hover:bg-primario/5 transition-colors">
          <p className="text-primario font-semibold">Disponibilidad</p>
          <p className="text-suave mt-1 text-sm">
            Tus horas de atención de cada semana y los días bloqueados.
          </p>
        </Tarjeta>
      </Link>
      <EstadoVacio
        titulo="Próximamente"
        descripcion="Aquí verás tu agenda, tus consultantes y los pagos por verificar."
      />
    </>
  );
}
