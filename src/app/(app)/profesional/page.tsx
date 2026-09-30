import Link from "next/link";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Tarjeta } from "@/components/ui/tarjeta";

export default function PaginaProfesional() {
  return (
    <>
      <h1 className="text-primario text-2xl font-bold">Mi consulta</h1>
      <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
        <Link href="/profesional/disponibilidad">
          <Tarjeta className="hover:bg-primario/5 h-full transition-colors">
            <p className="text-primario font-semibold">Disponibilidad</p>
            <p className="text-suave mt-1 text-sm">
              Tus horas de atención de cada semana y los días bloqueados.
            </p>
          </Tarjeta>
        </Link>
        <Link href="/profesional/consentimientos">
          <Tarjeta className="hover:bg-primario/5 h-full transition-colors">
            <p className="text-primario font-semibold">Consentimientos</p>
            <p className="text-suave mt-1 text-sm">
              Constancias firmadas por cada persona.
            </p>
          </Tarjeta>
        </Link>
      </div>
      <EstadoVacio
        titulo="Próximamente"
        descripcion="Aquí verás tu agenda, tus consultantes y los pagos por verificar."
      />
    </>
  );
}
