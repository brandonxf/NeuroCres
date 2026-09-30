import Link from "next/link";
import { BotonEnlace } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Tarjeta } from "@/components/ui/tarjeta";
import { calcularEdad, formatearFecha } from "@/lib/fechas";
import { personasDelUsuario } from "@/lib/personas";
import { PARENTESCOS, TIPOS_DOCUMENTO } from "@/lib/validacion/personas";

export default async function PaginaMisPersonas() {
  const { user, personas } = await personasDelUsuario();
  const agregar = (
    <BotonEnlace href="/mis-personas/nueva">Agregar persona</BotonEnlace>
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-primario text-2xl font-bold">Mis personas</h1>
          <p className="text-suave mt-1 max-w-md text-sm">
            Las citas y los consentimientos se asocian a la persona atendida.
            Aquí puedes registrarte tú y a quienes tienes a cargo.
          </p>
        </div>
        {personas.length > 0 && agregar}
      </div>

      {personas.length === 0 ? (
        <EstadoVacio
          titulo="Aún no has registrado a nadie"
          descripcion="Agrega tus datos, o los de tu hijo o hija, para poder agendar una cita."
          accion={agregar}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {personas.map((p) => {
            const edad = calcularEdad(p.fecha_nacimiento);
            const propia = p.usuario_id === user.id;
            const parentesco = p.responsables_legales.find(
              (r) => r.responsable_usuario_id === user.id,
            )?.parentesco;
            return (
              <li key={p.id}>
                <Tarjeta className="flex items-start justify-between gap-4">
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
                    <p className="text-suave text-sm">
                      Nació el {formatearFecha(p.fecha_nacimiento)}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                      <span className="bg-primario text-fondo rounded-full px-2.5 py-0.5">
                        {propia
                          ? "Yo"
                          : `A mi cargo${parentesco ? ` · ${PARENTESCOS[parentesco as keyof typeof PARENTESCOS]}` : ""}`}
                      </span>
                      {edad < 18 && (
                        <span className="bg-acento/30 text-texto rounded-full px-2.5 py-0.5">
                          Menor de edad
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <Link
                      href={`/mis-personas/${p.id}`}
                      className="text-primario inline-flex min-h-11 items-center px-2 text-sm font-medium underline"
                    >
                      Editar
                    </Link>
                    <Link
                      href={`/mis-personas/${p.id}/consentimientos`}
                      className="text-primario inline-flex min-h-11 items-center px-2 text-sm font-medium underline"
                    >
                      Consentimientos
                    </Link>
                  </div>
                </Tarjeta>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
