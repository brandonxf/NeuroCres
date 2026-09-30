import { TarjetaAuth } from "@/components/auth/formulario";
import { FormularioRestablecer } from "./formulario-restablecer";

export default function PaginaRestablecer() {
  return (
    <TarjetaAuth titulo="Nueva contraseña">
      <FormularioRestablecer />
    </TarjetaAuth>
  );
}
