import { Tarjeta } from "@/components/ui/tarjeta";
import { personasDelUsuario } from "@/lib/personas";
import { FormularioPersona } from "../formulario-persona";

export default async function PaginaNuevaPersona() {
  const { user, personas, responsable } = await personasDelUsuario();
  const tienePropia = personas.some((p) => p.usuario_id === user.id);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <h1 className="text-primario text-2xl font-bold">Agregar persona</h1>
      <Tarjeta className="p-6">
        <FormularioPersona
          tipo="crear"
          tienePropia={tienePropia}
          responsable={responsable}
        />
      </Tarjeta>
    </div>
  );
}
