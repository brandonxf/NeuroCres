import type { Metadata } from "next";
import { EncabezadoPublico } from "@/components/app/encabezado-publico";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Markdown } from "@/components/ui/markdown";
import { Tarjeta } from "@/components/ui/tarjeta";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Privacidad · NeuroCres",
  description: "Autorización y política de tratamiento de datos personales.",
};

export default async function PaginaPrivacidad() {
  const supabase = await crearClienteServidor();
  // Público: la autorización de datos se puede leer sin cuenta.
  const { data: plantilla } = await supabase
    .from("plantillas_consentimiento")
    .select("titulo, contenido, version")
    .eq("tipo", "tratamiento_datos")
    .eq("activa", true)
    .maybeSingle();

  return (
    <>
      <EncabezadoPublico />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pt-6 pb-16">
        <h1 className="text-primario text-3xl font-bold">
          Tratamiento de datos personales
        </h1>
        {plantilla ? (
          <Tarjeta className="p-6">
            <Markdown>{plantilla.contenido}</Markdown>
            <p className="text-suave mt-4 text-xs">
              Versión {plantilla.version}
            </p>
          </Tarjeta>
        ) : (
          <EstadoVacio titulo="Pronto publicaremos este texto" />
        )}
      </main>
    </>
  );
}
