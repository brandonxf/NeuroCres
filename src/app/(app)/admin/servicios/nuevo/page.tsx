import { Tarjeta } from "@/components/ui/tarjeta";
import { FormularioServicio } from "../formulario-servicio";

export default function PaginaNuevoServicio() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <h1 className="text-primario text-2xl font-bold">Nuevo servicio</h1>
      <Tarjeta className="p-6">
        <FormularioServicio tipo="crear" />
      </Tarjeta>
    </div>
  );
}
