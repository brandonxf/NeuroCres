"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Campo } from "@/components/ui/campo";
import { Selector } from "@/components/ui/selector";
import { Aviso, BotonEnviar } from "@/components/auth/formulario";
import { calcularEdad, hoyBogota } from "@/lib/fechas";
import {
  PARENTESCOS,
  TIPOS_DOCUMENTO,
  esquemaPersonaNueva,
  type DatosPersonaNueva,
} from "@/lib/validacion/personas";
import { actualizarPersona, crearPersona, type Resultado } from "./actions";

type Responsable = { nombre: string; correo: string; telefono: string };

type Props =
  | { tipo: "crear"; tienePropia: boolean; responsable: Responsable }
  | {
      tipo: "editar";
      id: string;
      inicial: DatosPersonaNueva;
      responsable: Responsable;
      esACargo: boolean;
    };

export function FormularioPersona(props: Props) {
  const editando = props.tipo === "editar";
  const [resultado, setResultado] = useState<Resultado>({});
  const [enviando, iniciar] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<DatosPersonaNueva>({
    resolver: zodResolver(esquemaPersonaNueva),
    defaultValues: editando
      ? props.inicial
      : {
          modo: props.tienePropia ? "a_cargo" : "propia",
          parentesco: "",
          nombres: "",
          apellidos: "",
          tipoDocumento: undefined,
          numeroDocumento: "",
          fechaNacimiento: "",
          telefono: "",
          correo: "",
        },
  });

  const modo = useWatch({ control, name: "modo" });
  const fecha = useWatch({ control, name: "fechaNacimiento" });
  const edad = /^\d{4}-\d{2}-\d{2}$/.test(fecha ?? "")
    ? calcularEdad(fecha)
    : null;
  const aCargo = editando ? props.esACargo : modo === "a_cargo";
  const esMenor = edad !== null && edad < 18;
  const hoy = hoyBogota();

  const enviar = handleSubmit((datos) =>
    iniciar(async () => {
      const r = editando
        ? await actualizarPersona(props.id, datos)
        : await crearPersona(datos);
      setResultado(r ?? {});
    }),
  );

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
      <Aviso {...resultado} />

      {!editando && (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-primario mb-1 text-sm font-medium">
            ¿Para quién es?
          </legend>
          {!props.tienePropia && (
            <label className="flex min-h-11 items-center gap-2">
              <input type="radio" value="propia" {...register("modo")} />
              Para mí
            </label>
          )}
          <label className="flex min-h-11 items-center gap-2">
            <input type="radio" value="a_cargo" {...register("modo")} />
            Una persona a mi cargo (hijo/a, familiar)
          </label>
        </fieldset>
      )}

      {aCargo && !editando && (
        <Selector
          etiqueta="Tu parentesco con la persona"
          opciones={PARENTESCOS}
          placeholder="Elige una opción"
          error={errors.parentesco?.message}
          {...register("parentesco")}
        />
      )}

      <Campo
        etiqueta="Nombres"
        error={errors.nombres?.message}
        {...register("nombres")}
      />
      <Campo
        etiqueta="Apellidos"
        error={errors.apellidos?.message}
        {...register("apellidos")}
      />
      <div className="grid grid-cols-2 gap-3">
        <Selector
          etiqueta="Tipo de documento"
          opciones={TIPOS_DOCUMENTO}
          placeholder="Elige"
          error={errors.tipoDocumento?.message}
          {...register("tipoDocumento")}
        />
        <Campo
          etiqueta="Número"
          inputMode="text"
          error={errors.numeroDocumento?.message}
          {...register("numeroDocumento")}
        />
      </div>
      <Campo
        etiqueta="Fecha de nacimiento"
        type="date"
        max={hoy}
        error={errors.fechaNacimiento?.message}
        {...register("fechaNacimiento")}
      />
      <Campo
        etiqueta="Teléfono (opcional)"
        type="tel"
        error={errors.telefono?.message}
        {...register("telefono")}
      />
      <Campo
        etiqueta={
          esMenor
            ? "Correo de contacto (opcional; si lo dejas vacío usamos el tuyo)"
            : "Correo (opcional)"
        }
        type="email"
        error={errors.correo?.message}
        {...register("correo")}
      />

      {aCargo && esMenor && (
        <div className="bg-secundario/30 text-primario rounded-lg p-3 text-sm">
          <p className="mb-1 font-medium">Persona menor de 18 años</p>
          <p>
            Quedarás registrado/a como responsable legal:{" "}
            <strong>
              {props.responsable.nombre || props.responsable.correo}
            </strong>
            {props.responsable.telefono && ` · ${props.responsable.telefono}`}.
            Tú autorizarás las citas y firmarás los consentimientos.
          </p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <BotonEnviar enviando={enviando}>
          {editando ? "Guardar cambios" : "Agregar persona"}
        </BotonEnviar>
        <Link href="/mis-personas" className="text-primario text-sm underline">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
