import { EstadoVacio } from "@/components/ui/estado-vacio";

export default function PaginaProfesional() {
  return (
    <>
      <h1 className="text-primario text-2xl font-bold">Mi consulta</h1>
      <EstadoVacio
        titulo="Próximamente"
        descripcion="Aquí verás tu agenda, tus consultantes y los pagos por verificar."
      />
    </>
  );
}
