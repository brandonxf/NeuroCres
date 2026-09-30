import { Aviso } from "@/components/ui/aviso";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Tarjeta } from "@/components/ui/tarjeta";
import { crearClienteServidor } from "@/lib/supabase/server";
import { guardarPerfil } from "./actions";

export default async function PaginaPerfilProfesional({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const q = await searchParams;
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profesional } = await supabase
    .from("profesionales")
    .select("id, nombre_publico, registro_profesional")
    .eq("usuario_id", user?.id ?? "")
    .maybeSingle();

  if (!profesional) {
    return (
      <EstadoVacio
        titulo="Tu cuenta aún no tiene perfil profesional"
        descripcion="Pídele al administrador que lo cree."
      />
    );
  }

  // El enlace de la sala no se lee por la tabla (columna protegida): solo por la función.
  const { data: enlace } = await supabase.rpc("obtener_enlace_videollamada", {
    p_profesional_id: profesional.id,
  });

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div>
        <h1 className="text-primario text-2xl font-bold">Mi perfil</h1>
        <p className="text-suave mt-1 text-sm">
          El enlace de tu sala solo lo ven las personas con una cita virtual
          confirmada; nunca viaja por correo.
        </p>
      </div>
      {q.error && <Aviso error={q.error} />}
      {q.ok && <Aviso tipo="exito" mensaje="Cambios guardados." />}
      <Tarjeta className="p-6">
        <form action={guardarPerfil} className="flex flex-col gap-4">
          <Campo
            etiqueta="Nombre público"
            name="nombrePublico"
            defaultValue={profesional.nombre_publico}
          />
          <Campo
            etiqueta="Registro profesional (opcional)"
            name="registro"
            defaultValue={profesional.registro_profesional ?? ""}
          />
          <Campo
            etiqueta="Enlace de tu sala virtual"
            name="enlace"
            type="url"
            defaultValue={enlace ?? ""}
            ayuda="Por ejemplo, tu enlace fijo de Google Meet. Debe empezar con https://"
          />
          <div>
            <Boton type="submit">Guardar</Boton>
          </div>
        </form>
      </Tarjeta>
    </div>
  );
}
