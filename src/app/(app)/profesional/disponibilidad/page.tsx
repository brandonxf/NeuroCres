import { formatInTimeZone } from "date-fns-tz";
import { Boton } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Selector } from "@/components/ui/selector";
import { Campo } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { horariosLibres } from "@/lib/agenda/servidor";
import { hoyBogota } from "@/lib/fechas";
import { MODALIDADES, textoModalidades } from "@/lib/servicios";
import { crearClienteServidor } from "@/lib/supabase/server";
import { DIAS_SEMANA } from "@/lib/validacion/agenda";
import { eliminarBloqueo, eliminarFranja } from "./actions";
import { FormularioBloqueo, FormularioFranja } from "./formularios";

const ORDEN_DIAS = ["1", "2", "3", "4", "5", "6", "0"] as const;
const hhmm = (h: string) => h.slice(0, 5);

export default async function PaginaDisponibilidad({
  searchParams,
}: {
  searchParams: Promise<{
    servicio?: string;
    fecha?: string;
    modalidad?: string;
  }>;
}) {
  const consulta = await searchParams;
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profesional } = await supabase
    .from("profesionales")
    .select("id, zona_horaria")
    .eq("usuario_id", user?.id ?? "")
    .maybeSingle();

  if (!profesional) {
    return (
      <EstadoVacio
        titulo="Tu cuenta aún no tiene perfil profesional"
        descripcion="Pídele al administrador que lo cree para poder definir tu disponibilidad."
      />
    );
  }

  const [{ data: franjas }, { data: bloqueos }, { data: servicios }] =
    await Promise.all([
      supabase
        .from("disponibilidad_semanal")
        .select("*")
        .eq("profesional_id", profesional.id)
        .order("hora_inicio"),
      supabase
        .from("bloqueos")
        .select("*")
        .eq("profesional_id", profesional.id)
        .gte("fin", new Date().toISOString())
        .order("inicio"),
      supabase
        .from("servicios")
        .select("slug, nombre, duracion_min, modalidades")
        .eq("activo", true)
        .eq("agendable_en_linea", true)
        .order("orden"),
    ]);

  // Vista previa: qué horarios verían los consultantes.
  const servicio = servicios?.find((s) => s.slug === consulta.servicio);
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(consulta.fecha ?? "")
    ? consulta.fecha!
    : hoyBogota();
  const modalidad = consulta.modalidad === "virtual" ? "virtual" : "presencial";
  const horarios = servicio?.duracion_min
    ? await horariosLibres({
        profesionalId: profesional.id,
        duracionMin: servicio.duracion_min,
        modalidadesServicio: servicio.modalidades,
        fecha,
        modalidad,
      })
    : null;

  const opcionesServicio = Object.fromEntries(
    (servicios ?? []).map((s) => [s.slug, s.nombre]),
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-primario text-2xl font-bold">Disponibilidad</h1>
        <p className="text-suave mt-1 max-w-xl text-sm">
          Tus horas de atención de cada semana y los días en que no atiendes.
          Las horas son de {profesional.zona_horaria}.
        </p>
      </div>

      <section aria-labelledby="franjas" className="flex flex-col gap-4">
        <h2 id="franjas" className="text-primario text-lg font-semibold">
          Franjas semanales
        </h2>
        {!franjas?.length ? (
          <EstadoVacio
            titulo="Aún no definiste tus horas de atención"
            descripcion="Sin franjas, nadie podrá agendar contigo."
          />
        ) : (
          <Tarjeta className="p-0">
            <ul className="divide-borde divide-y">
              {ORDEN_DIAS.flatMap((dia) =>
                franjas
                  .filter((f) => String(f.dia_semana) === dia)
                  .map((f) => (
                    <li
                      key={f.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-2"
                    >
                      <span>
                        <strong>{DIAS_SEMANA[dia]}</strong> ·{" "}
                        {hhmm(f.hora_inicio)}
                        {" – "}
                        {hhmm(f.hora_fin)} · {textoModalidades(f.modalidades)}
                      </span>
                      <form action={eliminarFranja.bind(null, f.id)}>
                        <Boton type="submit" variante="fantasma" tamano="sm">
                          Quitar
                        </Boton>
                      </form>
                    </li>
                  )),
              )}
            </ul>
          </Tarjeta>
        )}
        <Tarjeta className="max-w-lg">
          <FormularioFranja />
        </Tarjeta>
      </section>

      <section aria-labelledby="bloqueos" className="flex flex-col gap-4">
        <h2 id="bloqueos" className="text-primario text-lg font-semibold">
          Días o momentos bloqueados
        </h2>
        {bloqueos?.length ? (
          <Tarjeta className="p-0">
            <ul className="divide-borde divide-y">
              {bloqueos.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-2"
                >
                  <span>
                    {formatInTimeZone(
                      b.inicio,
                      profesional.zona_horaria,
                      "dd/MM/yyyy HH:mm",
                    )}
                    {" → "}
                    {formatInTimeZone(
                      b.fin,
                      profesional.zona_horaria,
                      "dd/MM/yyyy HH:mm",
                    )}
                    {b.motivo && (
                      <span className="text-suave"> · {b.motivo}</span>
                    )}
                  </span>
                  <form action={eliminarBloqueo.bind(null, b.id)}>
                    <Boton type="submit" variante="fantasma" tamano="sm">
                      Quitar
                    </Boton>
                  </form>
                </li>
              ))}
            </ul>
          </Tarjeta>
        ) : (
          <p className="text-suave text-sm">No tienes bloqueos próximos.</p>
        )}
        <Tarjeta className="max-w-lg">
          <FormularioBloqueo />
        </Tarjeta>
      </section>

      <section aria-labelledby="vista" className="flex flex-col gap-4">
        <h2 id="vista" className="text-primario text-lg font-semibold">
          Vista previa de horarios
        </h2>
        <p className="text-suave max-w-xl text-sm">
          Así verán los consultantes tus horarios libres, con el descanso, la
          antelación mínima y el horizonte configurados.
        </p>
        <Tarjeta className="max-w-lg">
          <form method="get" className="flex flex-col gap-3">
            <Selector
              etiqueta="Servicio"
              name="servicio"
              opciones={opcionesServicio}
              placeholder="Elige un servicio"
              defaultValue={servicio?.slug ?? ""}
            />
            <div className="grid grid-cols-2 gap-3">
              <Campo
                etiqueta="Fecha"
                name="fecha"
                type="date"
                defaultValue={fecha}
              />
              <Selector
                etiqueta="Modalidad"
                name="modalidad"
                opciones={MODALIDADES}
                defaultValue={modalidad}
              />
            </div>
            <div>
              <Boton type="submit" variante="secundario">
                Ver horarios
              </Boton>
            </div>
          </form>
        </Tarjeta>
        {horarios &&
          (horarios.length === 0 ? (
            <p className="text-suave text-sm">
              No hay horarios libres para ese día y modalidad.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {horarios.map((h) => (
                <li
                  key={h.inicio.toISOString()}
                  className="bg-primario text-fondo rounded-full px-3 py-1 text-sm"
                >
                  {formatInTimeZone(
                    h.inicio,
                    profesional.zona_horaria,
                    "HH:mm",
                  )}
                </li>
              ))}
            </ul>
          ))}
      </section>
    </div>
  );
}
