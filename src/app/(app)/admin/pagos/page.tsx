import { Aviso } from "@/components/ui/aviso";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { MEDIOS_PAGO, type MedioPago } from "@/lib/pagos";
import { crearClienteServidor } from "@/lib/supabase/server";
import { guardarMedioDePago } from "./actions";

export default async function PaginaMediosDePago({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const q = await searchParams;
  const supabase = await crearClienteServidor();
  const { data: medios } = await supabase
    .from("configuracion_pagos")
    .select("*")
    .order("medio");

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-primario text-2xl font-bold">Medios de pago</h1>
        <p className="text-suave mt-1 text-sm">
          Estos datos los ve la persona al pagar el anticipo. Un medio apagado
          no se ofrece. El efectivo no se configura aquí: solo sirve para el
          saldo de una cita presencial.
        </p>
      </div>

      {q.error && <Aviso error={q.error} />}
      {q.ok && (
        <Aviso
          tipo="exito"
          mensaje={`${MEDIOS_PAGO[q.ok as MedioPago] ?? "Medio"}: cambios guardados.`}
        />
      )}

      {(medios ?? []).map((m) => (
        <Tarjeta key={m.medio} className="p-6">
          <form action={guardarMedioDePago} className="flex flex-col gap-3">
            <input type="hidden" name="medio" value={m.medio} />
            <h2 className="text-primario text-lg font-semibold">
              {MEDIOS_PAGO[m.medio as MedioPago]}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo
                etiqueta="Titular"
                name="titular"
                defaultValue={m.titular ?? ""}
              />
              <Campo
                etiqueta="Banco"
                name="banco"
                defaultValue={m.banco ?? ""}
              />
              <Campo
                etiqueta="Tipo de cuenta"
                name="tipoCuenta"
                defaultValue={m.tipo_cuenta ?? ""}
              />
              <Campo
                etiqueta="Número"
                name="numero"
                defaultValue={m.numero ?? ""}
              />
              <Campo
                etiqueta="Llave"
                name="llave"
                defaultValue={m.llave ?? ""}
              />
            </div>
            <label className="flex min-h-11 items-center gap-2">
              <input type="checkbox" name="activo" defaultChecked={m.activo} />
              Disponible para pagar
            </label>
            <div>
              <Boton type="submit">Guardar</Boton>
            </div>
          </form>
        </Tarjeta>
      ))}
    </div>
  );
}
