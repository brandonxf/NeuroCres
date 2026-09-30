import { TarjetaAuth } from "@/components/auth/formulario";
import { FormularioIngreso } from "./formulario-ingreso";

export default async function PaginaIngreso({
  searchParams,
}: {
  searchParams: Promise<{ siguiente?: string; error?: string }>;
}) {
  const { siguiente, error } = await searchParams;
  return (
    <TarjetaAuth titulo="Ingresar">
      <FormularioIngreso
        siguiente={siguiente}
        errorInicial={
          error === "enlace"
            ? "El enlace no es válido o ya venció. Solicita uno nuevo."
            : undefined
        }
      />
    </TarjetaAuth>
  );
}
