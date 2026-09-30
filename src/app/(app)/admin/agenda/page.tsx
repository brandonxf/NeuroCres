import { Tarjeta } from "@/components/ui/tarjeta";
import { obtenerParametrosAgenda } from "@/lib/agenda/servidor";
import { FormularioParametros } from "./formulario-parametros";

export default async function PaginaParametrosAgenda() {
  const parametros = await obtenerParametrosAgenda();

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <div>
        <h1 className="text-primario text-2xl font-bold">
          Parámetros de la agenda
        </h1>
        <p className="text-suave mt-1 text-sm">
          Estos valores determinan qué horarios se ofrecen a los consultantes.
        </p>
      </div>
      <Tarjeta className="p-6">
        <FormularioParametros inicial={parametros} />
      </Tarjeta>
    </div>
  );
}
