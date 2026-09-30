import Link from "next/link";
import { notFound } from "next/navigation";
import { EstadoCitaEtiqueta } from "@/components/app/estado-cita";
import { Aviso } from "@/components/ui/aviso";
import { Boton, BotonEnlace } from "@/components/ui/boton";
import { CLASES_CONTROL } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { cn } from "@/lib/cn";
import { calcularEdad, formatearFechaHora, instanteActual } from "@/lib/fechas";
import {
  ESTADOS_PAGO,
  MEDIOS_PAGO,
  MOTIVOS_RECHAZO,
  type MedioPago,
} from "@/lib/pagos";
import { formatearCop, MODALIDADES, type Modalidad } from "@/lib/servicios";
import { crearClienteServidor } from "@/lib/supabase/server";
import {
  cambiarEstadoCita,
  cobrarSaldo,
  rechazarPago,
  verificarPago,
} from "../../acciones";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaDetalleCita({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const q = await searchParams;
  if (!UUID.test(id)) notFound();

  const supabase = await crearClienteServidor();
  const { data: cita } = await supabase
    .from("citas")
    .select("*, personas(*), servicios(nombre)")
    .eq("id", id)
    .maybeSingle();
  if (!cita) notFound();

  const [{ data: pagos }, { data: pendientes }] = await Promise.all([
    supabase
      .from("pagos")
      .select("*, comprobantes_pago(id, subido_at)")
      .eq("cita_id", id)
      .order("created_at"),
    supabase.rpc("consentimientos_pendientes", {
      p_persona_id: cita.persona_id,
    }),
  ]);

  const volver = `/profesional/citas/${id}`;
  const anticipo = pagos?.find((p) => p.concepto === "anticipo");
  const saldo = pagos?.find((p) => p.concepto === "saldo");
  const ocurrio = new Date(cita.inicio) <= instanteActual();
  const medioSaldo: Record<string, string> = {
    transferencia: MEDIOS_PAGO.transferencia,
    llave: MEDIOS_PAGO.llave,
    qr: MEDIOS_PAGO.qr,
    nequi: MEDIOS_PAGO.nequi,
    ...(cita.modalidad === "presencial"
      ? { efectivo: MEDIOS_PAGO.efectivo }
      : {}),
  };
  const persona = cita.personas;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <Link
          href="/profesional/agenda"
          className="text-primario text-sm underline"
        >
          ← Agenda
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-primario text-2xl font-bold">
            {persona?.nombres} {persona?.apellidos}
          </h1>
          <EstadoCitaEtiqueta estado={cita.estado} />
        </div>
        <p className="mt-1 capitalize">
          {cita.servicios?.nombre} · {formatearFechaHora(cita.inicio)} ·{" "}
          {MODALIDADES[cita.modalidad as Modalidad]}
        </p>
      </div>

      {q.error && <Aviso error={q.error} />}

      <Tarjeta>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-suave">Documento</dt>
          <dd>
            {persona?.tipo_documento} {persona?.numero_documento}
          </dd>
          <dt className="text-suave">Edad</dt>
          <dd>{persona ? calcularEdad(persona.fecha_nacimiento) : "—"} años</dd>
          <dt className="text-suave">Contacto</dt>
          <dd>
            {[persona?.telefono, persona?.correo].filter(Boolean).join(" · ") ||
              "—"}
          </dd>
          <dt className="text-suave">Consentimientos</dt>
          <dd>
            {pendientes?.length
              ? `Faltan ${pendientes.length} por firmar`
              : "Todos firmados"}
          </dd>
        </dl>
      </Tarjeta>

      <Tarjeta className="flex flex-col gap-4">
        <h2 className="text-primario font-semibold">Pagos</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-suave">Valor total</dt>
          <dd>{formatearCop(cita.precio_cop)}</dd>
          {[anticipo, saldo].map(
            (p) =>
              p && (
                <div key={p.id} className="col-span-2 grid grid-cols-subgrid">
                  <dt className="text-suave capitalize">{p.concepto}</dt>
                  <dd>
                    {formatearCop(p.monto_cop)} ·{" "}
                    {ESTADOS_PAGO[p.estado as keyof typeof ESTADOS_PAGO]}
                    {p.medio && ` · ${MEDIOS_PAGO[p.medio as MedioPago]}`}
                    {p.referencia && ` · ref. ${p.referencia}`}
                    {p.motivo_rechazo &&
                      ` · ${MOTIVOS_RECHAZO[p.motivo_rechazo as keyof typeof MOTIVOS_RECHAZO]}`}
                  </dd>
                </div>
              ),
          )}
        </dl>

        {anticipo?.comprobantes_pago &&
          anticipo.comprobantes_pago.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {[...anticipo.comprobantes_pago]
                .sort((a, b) => b.subido_at.localeCompare(a.subido_at))
                .map((c, i) => (
                  <li key={c.id}>
                    <BotonEnlace
                      href={`/comprobantes/${c.id}`}
                      target="_blank"
                      variante="secundario"
                      tamano="sm"
                    >
                      {i === 0
                        ? "Ver último comprobante"
                        : `Comprobante anterior ${i}`}
                    </BotonEnlace>
                  </li>
                ))}
            </ul>
          )}

        {anticipo?.estado === "comprobante_recibido" &&
          cita.estado === "pendiente_pago" && (
            <div className="flex flex-col gap-3">
              <p className="text-sm">
                Verifica que el monto sea{" "}
                <strong>{formatearCop(anticipo.monto_cop)}</strong> y que el
                pago aparezca en tu cuenta.
              </p>
              <form action={verificarPago}>
                <input type="hidden" name="pagoId" value={anticipo.id} />
                <input type="hidden" name="volver" value={volver} />
                <Boton type="submit">Verificar y confirmar la cita</Boton>
              </form>
              <form
                action={rechazarPago}
                className="flex flex-wrap items-end gap-2"
              >
                <input type="hidden" name="pagoId" value={anticipo.id} />
                <input type="hidden" name="volver" value={volver} />
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="motivo"
                    className="text-primario text-sm font-medium"
                  >
                    Motivo del rechazo
                  </label>
                  <select
                    id="motivo"
                    name="motivo"
                    className={cn(CLASES_CONTROL, "border-borde")}
                  >
                    {Object.entries(MOTIVOS_RECHAZO).map(([v, t]) => (
                      <option key={v} value={v}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <Boton type="submit" variante="peligro">
                  Rechazar
                </Boton>
              </form>
            </div>
          )}

        {saldo?.estado === "pendiente" &&
          ["confirmada", "completada"].includes(cita.estado) && (
            <form
              action={cobrarSaldo}
              className="flex flex-wrap items-end gap-2"
            >
              <input type="hidden" name="citaId" value={cita.id} />
              <input type="hidden" name="volver" value={volver} />
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="medio"
                  className="text-primario text-sm font-medium"
                >
                  Cobrar el saldo de {formatearCop(saldo.monto_cop)}
                </label>
                <select
                  id="medio"
                  name="medio"
                  className={cn(CLASES_CONTROL, "border-borde")}
                >
                  {Object.entries(medioSaldo).map(([v, t]) => (
                    <option key={v} value={v}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <Boton type="submit" variante="secundario">
                Registrar cobro
              </Boton>
            </form>
          )}
      </Tarjeta>

      {cita.estado === "confirmada" && (
        <Tarjeta className="flex flex-col gap-4">
          <h2 className="text-primario font-semibold">Cerrar la cita</h2>
          {!ocurrio && (
            <p className="text-suave text-sm">
              Podrás cerrarla cuando llegue su hora. Sin cerrarla no se factura
              el saldo.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["completada", "Marcar como completada", "primario"],
                ["inasistencia", "Marcar inasistencia", "secundario"],
              ] as const
            ).map(([estado, texto, variante]) => (
              <form key={estado} action={cambiarEstadoCita}>
                <input type="hidden" name="citaId" value={cita.id} />
                <input type="hidden" name="estado" value={estado} />
                <input type="hidden" name="volver" value={volver} />
                <Boton type="submit" variante={variante} disabled={!ocurrio}>
                  {texto}
                </Boton>
              </form>
            ))}
          </div>
        </Tarjeta>
      )}

      {["pendiente_pago", "confirmada"].includes(cita.estado) && (
        <Tarjeta>
          <form
            action={cambiarEstadoCita}
            className="flex flex-wrap items-end gap-2"
          >
            <input type="hidden" name="citaId" value={cita.id} />
            <input type="hidden" name="estado" value="cancelada" />
            <input type="hidden" name="volver" value={volver} />
            <div className="flex flex-col gap-1">
              <label
                htmlFor="motivo-cancelar"
                className="text-primario text-sm font-medium"
              >
                Cancelar la cita (motivo)
              </label>
              <input
                id="motivo-cancelar"
                name="motivo"
                maxLength={300}
                className={cn(CLASES_CONTROL, "border-borde")}
              />
            </div>
            <Boton type="submit" variante="peligro">
              Cancelar la cita
            </Boton>
          </form>
          <p className="text-suave mt-2 text-xs">
            Si cancelas tú, la persona recibe la devolución completa del
            anticipo.
          </p>
        </Tarjeta>
      )}
    </div>
  );
}
