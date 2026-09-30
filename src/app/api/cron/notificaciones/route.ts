import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { procesarNotificaciones } from "@/lib/correo/procesar";

// Nunca se guarda en caché: cada llamada procesa la cola.
export const dynamic = "force-dynamic";

function autorizado(peticion: Request): boolean {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return false;
  const recibido = peticion.headers.get("authorization") ?? "";
  const esperado = `Bearer ${secreto}`;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** La invoca la base de datos cada 5 minutos (pg_cron) con el secreto compartido. */
export async function GET(peticion: Request) {
  if (!autorizado(peticion)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const resumen = await procesarNotificaciones();
  return NextResponse.json(resumen);
}
