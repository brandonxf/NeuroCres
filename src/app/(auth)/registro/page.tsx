import { TarjetaAuth } from "@/components/auth/formulario";
import { FormularioRegistro } from "./formulario-registro";

export default function PaginaRegistro() {
  return (
    <TarjetaAuth titulo="Crear cuenta">
      <FormularioRegistro />
    </TarjetaAuth>
  );
}
