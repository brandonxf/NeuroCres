"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Campo, CLASES_CONTROL } from "@/components/ui/campo";
import { Selector } from "@/components/ui/selector";
import { Aviso, BotonEnviar } from "@/components/auth/formulario";
import { cn } from "@/lib/cn";
import {
  calcularAnticipo,
  formatearCop,
  TIPOS_SERVICIO,
} from "@/lib/servicios";
import {
  esquemaServicio,
  type DatosServicio,
} from "@/lib/validacion/servicios";
import { actualizarServicio, crearServicio, type Resultado } from "./actions";

type Props =
  | { tipo: "crear" }
  | { tipo: "editar"; id: string; slug: string; inicial: DatosServicio };

const INICIAL: DatosServicio = {
  nombre: "",
  slug: "",
  descripcion: "",
  poblacion: "",
  tipo: "individual",
  duracionMin: "60",
  precioCop: "",
  anticipoPct: "50",
  modalidades: ["presencial", "virtual"],
  requierePresencial: false,
  requiereConsentimiento: true,
  requiereFormulario: false,
  requiereAnticipo: true,
  agendableEnLinea: false,
  activo: true,
  orden: "0",
};

export function FormularioServicio(props: Props) {
  const editando = props.tipo === "editar";
  const [resultado, setResultado] = useState<Resultado>({});
  const [enviando, iniciar] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<DatosServicio>({
    resolver: zodResolver(esquemaServicio),
    defaultValues: editando ? props.inicial : INICIAL,
  });

  const requierePresencial = useWatch({ control, name: "requierePresencial" });
  const precio = useWatch({ control, name: "precioCop" });
  const pct = useWatch({ control, name: "anticipoPct" });

  // Un servicio que exige presencialidad fuerza esa única modalidad.
  useEffect(() => {
    if (requierePresencial) setValue("modalidades", ["presencial"]);
  }, [requierePresencial, setValue]);

  const vistaPrevia =
    /^\d{1,10}$/.test(precio ?? "") && /^\d{1,3}$/.test(pct ?? "")
      ? Number(pct) <= 100
        ? calcularAnticipo(Number(precio), Number(pct))
        : null
      : null;

  const enviar = handleSubmit((datos) =>
    iniciar(async () => {
      const r = editando
        ? await actualizarServicio(props.id, datos)
        : await crearServicio(datos);
      setResultado(r ?? {});
    }),
  );

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
      <Aviso {...resultado} />

      <Campo
        etiqueta="Nombre"
        error={errors.nombre?.message}
        {...register("nombre")}
      />
      {editando ? (
        <Campo
          etiqueta="Nombre corto en la URL (no se puede cambiar)"
          value={props.slug}
          readOnly
          disabled
          name="slug-actual"
        />
      ) : (
        <Campo
          etiqueta="Nombre corto en la URL (opcional)"
          ayuda="Si lo dejas vacío se genera a partir del nombre."
          error={errors.slug?.message}
          {...register("slug")}
        />
      )}

      <div className="flex flex-col gap-1">
        <label
          htmlFor="descripcion"
          className="text-primario text-sm font-medium"
        >
          Descripción
        </label>
        <textarea
          id="descripcion"
          rows={3}
          className={cn(CLASES_CONTROL, "border-borde")}
          {...register("descripcion")}
        />
      </div>

      <Campo
        etiqueta="Población (opcional)"
        error={errors.poblacion?.message}
        {...register("poblacion")}
      />

      <div className="grid grid-cols-2 gap-3">
        <Selector
          etiqueta="Tipo"
          opciones={TIPOS_SERVICIO}
          error={errors.tipo?.message}
          {...register("tipo")}
        />
        <Campo
          etiqueta="Duración (min, opcional)"
          inputMode="numeric"
          error={errors.duracionMin?.message}
          {...register("duracionMin")}
        />
        <Campo
          etiqueta="Precio (COP)"
          inputMode="numeric"
          error={errors.precioCop?.message}
          {...register("precioCop")}
        />
        <Campo
          etiqueta="Anticipo (%)"
          inputMode="numeric"
          error={errors.anticipoPct?.message}
          {...register("anticipoPct")}
        />
      </div>

      {vistaPrevia && (
        <p className="bg-secundario/30 text-primario rounded-lg p-3 text-sm">
          Anticipo: <strong>{formatearCop(vistaPrevia.anticipo)}</strong> ·
          Saldo el día de la cita:{" "}
          <strong>{formatearCop(vistaPrevia.saldo)}</strong>
        </p>
      )}

      <fieldset className="flex flex-col gap-1">
        <legend className="text-primario mb-1 text-sm font-medium">
          Modalidades
        </legend>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            value="presencial"
            {...register("modalidades")}
          />
          Presencial
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            value="virtual"
            disabled={requierePresencial}
            {...register("modalidades")}
          />
          Virtual
        </label>
        {errors.modalidades?.message && (
          <p className="text-error text-sm">{errors.modalidades.message}</p>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-1">
        <legend className="text-primario mb-1 text-sm font-medium">
          Requisitos y visibilidad
        </legend>
        {(
          [
            ["requierePresencial", "Requiere atención presencial"],
            ["requiereConsentimiento", "Requiere consentimiento firmado"],
            ["requiereFormulario", "Requiere formulario de ingreso"],
            ["requiereAnticipo", "Requiere anticipo para confirmar"],
            [
              "agendableEnLinea",
              "Se puede agendar en línea (si no, muestra “Consultar”)",
            ],
            ["activo", "Activo (visible en el catálogo)"],
          ] as const
        ).map(([campo, texto]) => (
          <label key={campo} className="flex min-h-11 items-center gap-2">
            <input type="checkbox" {...register(campo)} />
            {texto}
          </label>
        ))}
      </fieldset>

      <Campo
        etiqueta="Orden en pantalla"
        inputMode="numeric"
        ayuda="Los números menores aparecen primero."
        error={errors.orden?.message}
        {...register("orden")}
      />

      <div className="flex items-center gap-3">
        <BotonEnviar enviando={enviando}>
          {editando ? "Guardar cambios" : "Crear servicio"}
        </BotonEnviar>
        <Link
          href="/admin/servicios"
          className="text-primario text-sm underline"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
