import type { ReactNode } from "react";
import Link from "next/link";
import { Boton } from "@/components/ui/boton";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Logo } from "@/components/marca/logo";

export { Aviso } from "@/components/ui/aviso";

export function TarjetaAuth({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-10">
      <Link href="/" aria-label="NeuroCres, ir al inicio">
        <Logo />
      </Link>
      <Tarjeta className="w-full max-w-md p-6">
        <h1 className="text-primario mb-6 text-2xl font-bold">{titulo}</h1>
        {children}
      </Tarjeta>
    </main>
  );
}

export function BotonEnviar({
  enviando,
  children,
}: {
  enviando: boolean;
  children: ReactNode;
}) {
  return (
    <Boton type="submit" cargando={enviando}>
      {children}
    </Boton>
  );
}
