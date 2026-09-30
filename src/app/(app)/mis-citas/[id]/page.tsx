import Link from "next/link";
import { notFound } from "next/navigation";
import { EstadoCitaEtiqueta } from "@/components/app/estado-cita";
import { Aviso } from "@/components/ui/aviso";
import { BotonEnlace } from "@/components/ui/boton";
import { Tarjeta } from "@/components/ui/tarjeta";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { formatearFechaHora } from "@/lib/fechas";
import {
  ESTADOS_PAGO,
  MEDIOS_PAGO,
  MOTIVOS_RECHAZO,
  type MedioPago,
} from "@/lib/pagos";
import { formatearCop, MODALIDADES, type Modalidad } from "@/lib/servicios";
import { crearClienteServidor } from "@/lib/supabase/server";
import { FormularioComprobante } from "./formularios";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaCita({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await crearClienteServidor();
  const { data: cita } = await supabase
    .from("citas")
    .select(
      "*, servicios(nombre), personas(nombres, apellidos), profesionales(nombre_publico)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!cita) notFound();

  const [{ data: pagos }, { data: devoluciones }, direccion] =
    await Promise.all([
      supabase.from("pagos").select("*").eq("cita_id", id).order("created_at"),
      supabase.from("devoluciones").select("*").eq("cita_id", id),
      obtenerConfiguracion<string>("direccion_consultorio"),
    ]);

  const anticipo = pagos?.find((p) => p.concepto === "anticipo");
  const saldo = pagos?.find((p) => p.concepto === "saldo");
  const { data: datosMedio } =
    anticipo?.medio && anticipo.medio !== "efectivo"
      ? await supabase
          .from("configuracion_pagos")
          .select("*")
          .eq("medio", anticipo.medio)
          .maybeSingle()
      : { data: null };

  const pendientePago = cita.estado === "pendiente_pago";
  const puedeSubir =
    pendientePago &&
    anticipo &&
    ["pendiente", "rechazado", "comprobante_recibido"].includes(
      anticipo.estado,
    );
  const confirmada = cita.estado === "confirmada";
  const modificable = confirmada && new Date(cita.inicio) > new Date();
  // El enlace de la sala solo se entrega en citas virtuales confirmadas.
  const { data: enlaceSala } =
    confirmada && cita.modalidad === "virtual"
      ? await supabase.rpc("enlace_videollamada_de_cita", { p_cita_id: id })
      : { data: null };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <Link href="/mis-citas" className="text-primario text-sm underline">
          ← Mis citas
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-primario text-2xl font-bold">
            {cita.servicios?.nombre ?? "Cita"}
          </h1>
          <EstadoCitaEtiqueta estado={cita.estado} />
        </div>
        <p className="mt-1 capitalize">{formatearFechaHora(cita.inicio)}</p>
      </div>

      {pendientePago && (
        <Aviso
          tipo="atencion"
          mensaje={
            anticipo?.estado === "comprobante_recibido"
              ? "Tu cita está pendiente de verificación del pago. Te avisaremos cuando la profesional lo confirme."
              : `Tu cita queda confirmada cuando verifiquemos el anticipo.${cita.expira_cupo_at ? ` Retenemos tu cupo hasta ${formatearFechaHora(cita.expira_cupo_at)}.` : ""}`
          }
        />
      )}
      {anticipo?.estado === "rechazado" && anticipo.motivo_rechazo && (
        <Aviso
          tipo="error"
          mensaje={`No pudimos verificar tu comprobante: ${MOTIVOS_RECHAZO[anticipo.motivo_rechazo as keyof typeof MOTIVOS_RECHAZO] ?? anticipo.motivo_rechazo}. Sube otro mientras tu cupo siga vigente.`}
        />
      )}

      <Tarjeta>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-suave">Persona</dt>
          <dd>
            {cita.personas?.nombres} {cita.personas?.apellidos}
          </dd>
          <dt className="text-suave">Profesional</dt>
          <dd>{cita.profesionales?.nombre_publico}</dd>
          <dt className="text-suave">Modalidad</dt>
          <dd>{MODALIDADES[cita.modalidad as Modalidad]}</dd>
          {cita.modalidad === "presencial" && direccion && (
            <>
              <dt className="text-suave">Dirección</dt>
              <dd>{direccion}</dd>
            </>
          )}
          <dt className="text-suave">Valor total</dt>
          <dd>{formatearCop(cita.precio_cop)}</dd>
          <dt className="text-suave">Anticipo</dt>
          <dd>
            {formatearCop(cita.anticipo_cop)}
            {anticipo &&
              ` · ${ESTADOS_PAGO[anticipo.estado as keyof typeof ESTADOS_PAGO]}`}
          </dd>
          <dt className="text-suave">Saldo el día de la cita</dt>
          <dd>
            {formatearCop(cita.saldo_cop)}
            {saldo &&
              ` · ${ESTADOS_PAGO[saldo.estado as keyof typeof ESTADOS_PAGO]}`}
          </dd>
        </dl>
      </Tarjeta>

      {puedeSubir && anticipo && (
        <Tarjeta className="flex flex-col gap-4">
          <h2 className="text-primario text-lg font-semibold">
            Paga el anticipo de {formatearCop(anticipo.monto_cop)}
          </h2>
          {datosMedio ? (
            <div className="bg-secundario/25 rounded-lg p-4 text-sm">
              <p className="mb-2 font-medium">
                {MEDIOS_PAGO[anticipo.medio as MedioPago]}
              </p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                {datosMedio.titular && (
                  <>
                    <dt className="text-suave">Titular</dt>
                    <dd>{datosMedio.titular}</dd>
                  </>
                )}
                {datosMedio.banco && (
                  <>
                    <dt className="text-suave">Banco</dt>
                    <dd>{datosMedio.banco}</dd>
                  </>
                )}
                {datosMedio.tipo_cuenta && (
                  <>
                    <dt className="text-suave">Tipo de cuenta</dt>
                    <dd>{datosMedio.tipo_cuenta}</dd>
                  </>
                )}
                {datosMedio.numero && (
                  <>
                    <dt className="text-suave">Número</dt>
                    <dd className="font-mono">{datosMedio.numero}</dd>
                  </>
                )}
                {datosMedio.llave && (
                  <>
                    <dt className="text-suave">Llave</dt>
                    <dd className="font-mono">{datosMedio.llave}</dd>
                  </>
                )}
              </dl>
            </div>
          ) : (
            <Aviso
              tipo="atencion"
              mensaje="Aún no hay datos de este medio de pago. Escríbenos para completar tu pago."
            />
          )}
          <FormularioComprobante pagoId={anticipo.id} />
        </Tarjeta>
      )}

      {confirmada && cita.modalidad === "virtual" && (
        <Tarjeta className="flex flex-col gap-2">
          <h2 className="text-primario font-semibold">Sala virtual</h2>
          {enlaceSala ? (
            <BotonEnlace
              href={enlaceSala}
              target="_blank"
              rel="noopener noreferrer"
              className="self-start"
            >
              Entrar a la sala
            </BotonEnlace>
          ) : (
            <p className="text-suave text-sm">
              La profesional aún no ha configurado el enlace de la sala. Te
              avisaremos cuando esté disponible.
            </p>
          )}
        </Tarjeta>
      )}

      {confirmada && (
        <Tarjeta className="flex flex-wrap items-center gap-3">
          <BotonEnlace
            href={`/mis-citas/${cita.id}/calendario`}
            variante="secundario"
            tamano="sm"
          >
            Agregar al calendario
          </BotonEnlace>
          {modificable && (
            <>
              <BotonEnlace
                href={`/mis-citas/${cita.id}/reprogramar`}
                variante="secundario"
                tamano="sm"
              >
                Reprogramar
              </BotonEnlace>
              <BotonEnlace
                href={`/mis-citas/${cita.id}/cancelar`}
                variante="peligro"
                tamano="sm"
              >
                Cancelar
              </BotonEnlace>
            </>
          )}
        </Tarjeta>
      )}
      {pendientePago && (
        <div>
          <BotonEnlace
            href={`/mis-citas/${cita.id}/cancelar`}
            variante="fantasma"
            tamano="sm"
          >
            Cancelar esta reserva
          </BotonEnlace>
        </div>
      )}

      {devoluciones && devoluciones.length > 0 && (
        <Tarjeta>
          <h2 className="text-primario mb-2 font-semibold">Devoluciones</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {devoluciones.map((d) => (
              <li key={d.id}>
                {formatearCop(d.monto_cop)} ·{" "}
                {d.estado === "realizada"
                  ? "ya realizada"
                  : "pendiente: se hace en 5 a 10 días hábiles por el mismo medio de pago"}
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
    </div>
  );
}
