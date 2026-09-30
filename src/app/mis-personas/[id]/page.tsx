import { notFound } from "next/navigation";
import { personasDelUsuario } from "@/lib/personas";
import type { DatosPersonaNueva } from "@/lib/validacion/personas";
import { FormularioPersona } from "../formulario-persona";

export default async function PaginaEditarPersona({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, personas, responsable } = await personasDelUsuario();
  const persona = personas.find((p) => p.id === id);
  if (!persona) notFound();

  const esACargo = persona.usuario_id !== user.id;
  const parentesco =
    persona.responsables_legales.find(
      (r) => r.responsable_usuario_id === user.id,
    )?.parentesco ?? "";

  const inicial = {
    modo: esACargo ? "a_cargo" : "propia",
    parentesco,
    nombres: persona.nombres,
    apellidos: persona.apellidos,
    tipoDocumento: persona.tipo_documento,
    numeroDocumento: persona.numero_documento,
    fechaNacimiento: persona.fecha_nacimiento,
    telefono: persona.telefono ?? "",
    correo: persona.correo ?? "",
  } as DatosPersonaNueva;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-primario text-2xl font-bold">Editar persona</h1>
      <div className="rounded-2xl bg-white/70 p-6">
        <FormularioPersona
          tipo="editar"
          id={persona.id}
          inicial={inicial}
          responsable={responsable}
          esACargo={esACargo}
        />
      </div>
    </main>
  );
}
