import { EncabezadoPublico } from "@/components/app/encabezado-publico";
import { BotonEnlace } from "@/components/ui/boton";
import { Tarjeta } from "@/components/ui/tarjeta";
import { crearClienteServidor } from "@/lib/supabase/server";

const AREAS = [
  {
    titulo: "Psicología",
    texto: "Acompañamiento para niños, adolescentes y adultos.",
  },
  {
    titulo: "Neuropsicología",
    texto: "Valoración y orientación para entender cómo aprendes y procesas.",
  },
  {
    titulo: "Bienestar",
    texto: "Terapia contemplativa y espacios para cuidar de ti.",
  },
];

export default async function Inicio() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  const conSesion = Boolean(data?.claims);

  return (
    <>
      <EncabezadoPublico />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-4 pt-8 pb-16 md:pt-16">
        <section className="flex max-w-2xl flex-col items-start gap-5">
          <p className="text-primario text-sm font-medium tracking-wide">
            Psicología · Neuropsicología · Bienestar
          </p>
          <h1 className="text-primario text-4xl leading-tight font-bold md:text-5xl">
            Un espacio para comprenderte, orientarte y cuidar de tu bienestar.
          </h1>
          <div className="flex flex-wrap gap-3">
            {conSesion ? (
              <BotonEnlace href="/perfil">Ir a mi cuenta</BotonEnlace>
            ) : (
              <>
                <BotonEnlace href="/registro">Crear cuenta</BotonEnlace>
                <BotonEnlace href="/ingresar" variante="secundario">
                  Ya tengo cuenta
                </BotonEnlace>
              </>
            )}
            <BotonEnlace href="/servicios" variante="fantasma">
              Ver servicios
            </BotonEnlace>
          </div>
        </section>

        <section aria-labelledby="areas" className="grid gap-4 md:grid-cols-3">
          <h2 id="areas" className="sr-only">
            Áreas de atención
          </h2>
          {AREAS.map((a) => (
            <Tarjeta key={a.titulo}>
              <p className="text-primario font-semibold">{a.titulo}</p>
              <p className="text-suave mt-1 text-sm">{a.texto}</p>
            </Tarjeta>
          ))}
        </section>
      </main>
    </>
  );
}
