import Link from "next/link";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { cerrarSesion } from "../(auth)/actions";

export default async function PaginaPerfil() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("nombres, apellidos, telefono, correo")
    .eq("id", user.id)
    .single();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <h1 className="text-primario text-2xl font-bold">Mi perfil</h1>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl bg-white/70 p-6">
        <dt className="text-primario font-medium">Nombre</dt>
        <dd>
          {[usuario?.nombres, usuario?.apellidos].filter(Boolean).join(" ") ||
            "—"}
        </dd>
        <dt className="text-primario font-medium">Correo</dt>
        <dd>{usuario?.correo ?? user.email}</dd>
        <dt className="text-primario font-medium">Teléfono</dt>
        <dd>{usuario?.telefono ?? "—"}</dd>
      </dl>
      <Link
        href="/mis-personas"
        className="bg-primario text-fondo hover:bg-primario/90 rounded-lg px-4 py-2 text-center font-medium"
      >
        Mis personas
      </Link>
      <form action={cerrarSesion}>
        <button
          type="submit"
          className="border-primario text-primario hover:bg-primario/10 rounded-lg border px-4 py-2 font-medium"
        >
          Cerrar sesión
        </button>
      </form>
    </main>
  );
}
