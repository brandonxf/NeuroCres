import { requerirRol } from "@/lib/auth/roles";

export default async function LayoutProfesional({
  children,
}: LayoutProps<"/profesional">) {
  await requerirRol("profesional");
  return <>{children}</>;
}
