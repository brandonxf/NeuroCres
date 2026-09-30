import { TarjetaAuth } from "@/components/auth/formulario";
import { FormularioRecuperar } from "./formulario-recuperar";

export default function PaginaRecuperar() {
  return (
    <TarjetaAuth titulo="Recuperar contraseña">
      <FormularioRecuperar />
    </TarjetaAuth>
  );
}
