import { requerirRol } from "@/lib/auth/roles";

export default async function LayoutAdmin({ children }: LayoutProps<"/admin">) {
  await requerirRol("administrador");
  return <>{children}</>;
}
