"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Aviso, BotonEnviar } from "@/components/auth/formulario";
import { MEDIOS_PAGO } from "@/lib/pagos";
import { reservarCita, type Resultado } from "./actions";

type PersonaOpcion = {
  id: string;
  nombre: string;
  detalle: string;
  pendientes: number;
};

type Props = {
  slug: string;
  servicioId: string;
  profesionalId: string;
  inicio: string;
  modalidad: string;
  politicaId: string;
  personas: PersonaOpcion[];
  medios: string[];
};

export function FormularioReserva(props: Props) {
  const [resultado, accion, enviando] = useActionState<Resultado, FormData>(
    reservarCita,
    {},
  );
  const [personaId, setPersonaId] = useState(
    props.personas.length === 1 ? props.personas[0].id : "",
  );
  const elegida = props.personas.find((p) => p.id === personaId);
  const bloqueada = Boolean(elegida && elegida.pendientes > 0);

  return (
    <form action={accion} className="flex flex-col gap-5">
      <Aviso error={resultado.error} />
      {resultado.horarioOcupado && (
        <Link
          href={`/agendar/${props.slug}?modalidad=${props.modalidad}`}
          className="text-primario text-sm underline"
        >
          Ver otros horarios
        </Link>
      )}
      <input type="hidden" name="slug" value={props.slug} />
      <input type="hidden" name="servicioId" value={props.servicioId} />
      <input type="hidden" name="profesionalId" value={props.profesionalId} />
      <input type="hidden" name="inicio" value={props.inicio} />
      <input type="hidden" name="modalidad" value={props.modalidad} />
      <input type="hidden" name="politicaId" value={props.politicaId} />

      <fieldset className="flex flex-col gap-2">
        <legend className="text-primario mb-1 text-sm font-medium">
          ¿Para quién es la cita?
        </legend>
        {props.personas.map((p) => (
          <label
            key={p.id}
            className="border-borde flex min-h-11 items-start gap-2 rounded-lg border bg-white p-3"
          >
            <input
              type="radio"
              name="personaId"
              value={p.id}
              checked={personaId === p.id}
              onChange={() => setPersonaId(p.id)}
              className="mt-1"
            />
            <span>
              <span className="font-medium">{p.nombre}</span>
              <span className="text-suave block text-xs">{p.detalle}</span>
              {p.pendientes > 0 && (
                <span className="text-error block text-xs">
                  Faltan {p.pendientes} consentimientos por firmar
                </span>
              )}
            </span>
          </label>
        ))}
      </fieldset>

      {bloqueada && elegida && (
        <Aviso tipo="atencion">
          Antes de agendar, {elegida.nombre} debe tener firmados sus
          consentimientos.{" "}
          <Link
            href={`/mis-personas/${elegida.id}/consentimientos`}
            className="font-medium underline"
          >
            Firmarlos ahora
          </Link>
          . Después vuelve a esta página.
        </Aviso>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="text-primario mb-1 text-sm font-medium">
          Elige el medio de pago que prefieras
        </legend>
        {props.medios.length === 0 ? (
          <Aviso tipo="atencion">
            Por ahora no hay medios de pago disponibles. Escríbenos para
            agendar.
          </Aviso>
        ) : (
          props.medios.map((m) => (
            <label
              key={m}
              className="border-borde flex min-h-11 items-center gap-2 rounded-lg border bg-white p-3"
            >
              <input type="radio" name="medio" value={m} />
              {MEDIOS_PAGO[m as keyof typeof MEDIOS_PAGO] ?? m}
            </label>
          ))
        )}
        <p className="text-suave text-xs">
          El anticipo se paga con comprobante. El efectivo solo sirve para el
          saldo de una cita presencial.
        </p>
      </fieldset>

      <label className="flex items-start gap-2">
        <input type="checkbox" name="acepto" className="mt-1" />
        <span className="text-sm">
          Leí y acepto la política de cancelación y reprogramación.
        </span>
      </label>

      <div>
        <BotonEnviar enviando={enviando}>
          {bloqueada
            ? "Firma primero los consentimientos"
            : "Confirmar la reserva"}
        </BotonEnviar>
      </div>
    </form>
  );
}
