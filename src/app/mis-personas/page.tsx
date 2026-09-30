import Link from "next/link";
import { calcularEdad, formatearFecha } from "@/lib/fechas";
import { personasDelUsuario } from "@/lib/personas";
import { PARENTESCOS, TIPOS_DOCUMENTO } from "@/lib/validacion/personas";

export default async function PaginaMisPersonas() {
  const { user, personas } = await personasDelUsuario();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <div>
        <Link href="/perfil" className="text-primario text-sm underline">
          ← Volver al perfil
        </Link>
        <div className="mt-2 flex items-center justify-between gap-4">
          <h1 className="text-primario text-2xl font-bold">Mis personas</h1>
          <Link
            href="/mis-personas/nueva"
            className="bg-primario text-fondo hover:bg-primario/90 rounded-lg px-4 py-2 font-medium"
          >
            Agregar persona
          </Link>
        </div>
        <p className="mt-1 text-sm">
          Las citas y los consentimientos se asocian a la persona atendida. Aquí
          puedes registrarte tú y a quienes tienes a cargo.
        </p>
      </div>

      {personas.length === 0 ? (
        <div className="rounded-2xl bg-white/70 p-8 text-center">
          <p className="text-primario mb-1 font-medium">
            Aún no has registrado a nadie
          </p>
          <p className="text-sm">
            Agrega tus datos, o los de tu hijo/a, para poder agendar una cita.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {personas.map((p) => {
            const edad = calcularEdad(p.fecha_nacimiento);
            const propia = p.usuario_id === user.id;
            const parentesco = p.responsables_legales.find(
              (r) => r.responsable_usuario_id === user.id,
            )?.parentesco;
            return (
              <li
                key={p.id}
                className="flex items-start justify-between gap-4 rounded-2xl bg-white/70 p-5"
              >
                <div className="flex flex-col gap-1">
                  <p className="text-primario font-semibold">
                    {p.nombres} {p.apellidos}
                  </p>
                  <p className="text-sm">
                    {
                      TIPOS_DOCUMENTO[
                        p.tipo_documento as keyof typeof TIPOS_DOCUMENTO
                      ]
                    }{" "}
                    {p.numero_documento} · {edad} años
                  </p>
                  <p className="text-sm">
                    Nació el {formatearFecha(p.fecha_nacimiento)}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs">
                    <span className="bg-primario text-fondo rounded-full px-2 py-0.5">
                      {propia
                        ? "Yo"
                        : `A mi cargo${parentesco ? ` · ${PARENTESCOS[parentesco as keyof typeof PARENTESCOS]}` : ""}`}
                    </span>
                    {edad < 18 && (
                      <span className="bg-acento/30 text-texto rounded-full px-2 py-0.5">
                        Menor de edad
                      </span>
                    )}
                  </div>
                </div>
                <Link
                  href={`/mis-personas/${p.id}`}
                  className="text-primario text-sm underline"
                >
                  Editar
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
