import Link from "next/link";
import { notFound } from "next/navigation";
import { Aviso } from "@/components/ui/aviso";
import { BotonEnlace } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Markdown } from "@/components/ui/markdown";
import { Tarjeta } from "@/components/ui/tarjeta";
import { horasDeRetencion, type ConfigRetencionCupo } from "@/lib/agenda/cupo";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { calcularEdad, formatearFechaHora } from "@/lib/fechas";
import { personasDelUsuario } from "@/lib/personas";
import {
  calcularAnticipo,
  formatearCop,
  MODALIDADES,
  type Modalidad,
} from "@/lib/servicios";
import { FormularioReserva } from "./formulario-reserva";

export default async function PaginaReservar({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    inicio?: string;
    modalidad?: string;
    profesional?: string;
  }>;
}) {
  const { slug } = await params;
  const q = await searchParams;

  const inicio = q.inicio ? new Date(q.inicio) : null;
  if (
    !inicio ||
    Number.isNaN(inicio.getTime()) ||
    (q.modalidad !== "presencial" && q.modalidad !== "virtual") ||
    !q.profesional
  ) {
    notFound();
  }
  const modalidad = q.modalidad as Modalidad;

  const { supabase, personas } = await personasDelUsuario();
  const { data: servicio } = await supabase
    .from("servicios")
    .select("*")
    .eq("slug", slug)
    .eq("activo", true)
    .eq("agendable_en_linea", true)
    .maybeSingle();
  if (!servicio) notFound();

  const [{ data: politica }, { data: medios }, retencion, direccion] =
    await Promise.all([
      supabase
        .from("politicas_versionadas")
        .select("id, contenido, version")
        .eq("activa", true)
        .maybeSingle(),
      supabase.from("configuracion_pagos").select("medio").eq("activo", true),
      obtenerConfiguracion<ConfigRetencionCupo>("retencion_cupo"),
      obtenerConfiguracion<string>("direccion_consultorio"),
    ]);

  const pendientes = await Promise.all(
    personas.map(async (p) => {
      const { data } = await supabase.rpc("consentimientos_pendientes", {
        p_persona_id: p.id,
      });
      return [p.id, data?.length ?? 0] as const;
    }),
  );
  const pendientesPor = new Map(pendientes);

  const { anticipo, saldo } = calcularAnticipo(
    servicio.precio_cop,
    servicio.anticipo_pct,
  );
  const horas = horasDeRetencion(inicio, new Date(), retencion ?? {});

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <Link
          href={`/agendar/${slug}?modalidad=${modalidad}`}
          className="text-primario text-sm underline"
        >
          ← Cambiar horario
        </Link>
        <h1 className="text-primario mt-2 text-2xl font-bold">
          Confirma tu reserva
        </h1>
        <p className="text-suave mt-1 text-sm">Paso 3 de 3</p>
      </div>

      <Tarjeta>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-suave">Servicio</dt>
          <dd className="font-medium">{servicio.nombre}</dd>
          <dt className="text-suave">Fecha y hora</dt>
          <dd className="font-medium capitalize">
            {formatearFechaHora(inicio)}
          </dd>
          <dt className="text-suave">Modalidad</dt>
          <dd>{MODALIDADES[modalidad]}</dd>
          {modalidad === "presencial" && direccion && (
            <>
              <dt className="text-suave">Dirección</dt>
              <dd>{direccion}</dd>
            </>
          )}
          <dt className="text-suave">Valor total</dt>
          <dd className="font-medium">{formatearCop(servicio.precio_cop)}</dd>
          <dt className="text-suave">Anticipo ahora</dt>
          <dd className="font-medium">{formatearCop(anticipo)}</dd>
          <dt className="text-suave">Saldo el día de la cita</dt>
          <dd>{formatearCop(saldo)}</dd>
        </dl>
      </Tarjeta>

      {personas.length === 0 ? (
        <EstadoVacio
          titulo="Primero registra a la persona que será atendida"
          descripcion="Agrega tus datos, o los de tu hijo o hija."
          accion={
            <BotonEnlace href="/mis-personas/nueva">
              Agregar persona
            </BotonEnlace>
          }
        />
      ) : !politica ? (
        <Aviso
          tipo="atencion"
          mensaje="La política de cancelación aún no está publicada. Vuelve pronto."
        />
      ) : (
        <>
          <Tarjeta className="flex flex-col gap-3">
            <h2 className="text-primario font-semibold">
              Política de cancelación
            </h2>
            <div className="border-borde max-h-56 overflow-y-auto rounded-lg border bg-white p-4">
              <Markdown>{politica.contenido}</Markdown>
            </div>
          </Tarjeta>

          <Aviso
            tipo="info"
            mensaje={`Tu cita queda pendiente hasta que la profesional verifique el anticipo. Retenemos tu cupo ${Math.round(horas * 10) / 10} horas para que subas el comprobante; si no llega, el horario se libera.`}
          />

          <FormularioReserva
            slug={slug}
            servicioId={servicio.id}
            profesionalId={q.profesional}
            inicio={inicio.toISOString()}
            modalidad={modalidad}
            politicaId={politica.id}
            personas={personas.map((p) => ({
              id: p.id,
              nombre: `${p.nombres} ${p.apellidos}`,
              detalle: `${p.tipo_documento} ${p.numero_documento} · ${calcularEdad(p.fecha_nacimiento)} años`,
              pendientes: pendientesPor.get(p.id) ?? 0,
            }))}
            medios={(medios ?? []).map((m) => m.medio)}
          />
        </>
      )}
    </div>
  );
}
