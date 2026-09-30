import { personasDelUsuario } from "@/lib/personas";
import { FormularioPersona } from "../formulario-persona";

export default async function PaginaNuevaPersona() {
  const { user, personas, responsable } = await personasDelUsuario();
  const tienePropia = personas.some((p) => p.usuario_id === user.id);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-primario text-2xl font-bold">Agregar persona</h1>
      <div className="rounded-2xl bg-white/70 p-6">
        <FormularioPersona
          tipo="crear"
          tienePropia={tienePropia}
          responsable={responsable}
        />
      </div>
    </main>
  );
}
