import type { ReactNode } from "react";

export function TarjetaAuth({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white/70 p-6 shadow-sm">
        <h1 className="text-primario mb-6 text-2xl font-bold">{titulo}</h1>
        {children}
      </div>
    </main>
  );
}

export function Aviso({
  error,
  mensaje,
}: {
  error?: string;
  mensaje?: string;
}) {
  if (!error && !mensaje) return null;
  return (
    <p
      role={error ? "alert" : "status"}
      className={`rounded-lg px-3 py-2 text-sm ${
        error ? "bg-red-50 text-red-800" : "bg-secundario/30 text-primario"
      }`}
    >
      {error ?? mensaje}
    </p>
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
    <button
      type="submit"
      disabled={enviando}
      className="bg-primario text-fondo hover:bg-primario/90 rounded-lg px-4 py-2 font-medium transition disabled:opacity-60"
    >
      {enviando ? "Un momento…" : children}
    </button>
  );
}
