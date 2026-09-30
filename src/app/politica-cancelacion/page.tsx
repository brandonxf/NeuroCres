import type { Metadata } from "next";
import { EncabezadoPublico } from "@/components/app/encabezado-publico";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Markdown } from "@/components/ui/markdown";
import { Tarjeta } from "@/components/ui/tarjeta";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Política de cancelación · NeuroCres",
  description: "Cómo funcionan las cancelaciones y reprogramaciones de citas.",
};

export default async function PaginaPoliticaCancelacion() {
  const supabase = await crearClienteServidor();
  // Pública: se puede leer antes de reservar.
  const { data: politica } = await supabase
    .from("politicas_versionadas")
    .select("contenido, version")
    .eq("activa", true)
    .maybeSingle();

  return (
    <>
      <EncabezadoPublico />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pt-6 pb-16">
        <h1 className="text-primario text-3xl font-bold">
          Política de cancelación y reprogramación
        </h1>
        {politica ? (
          <Tarjeta className="p-6">
            <Markdown>{politica.contenido}</Markdown>
            <p className="text-suave mt-4 text-xs">
              Versión {politica.version}
            </p>
          </Tarjeta>
        ) : (
          <EstadoVacio titulo="Pronto publicaremos esta política" />
        )}
      </main>
    </>
  );
}
