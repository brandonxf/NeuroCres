import type { NextRequest } from "next/server";
import { actualizarSesion } from "@/lib/supabase/sesion";

export async function proxy(request: NextRequest) {
  return actualizarSesion(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
