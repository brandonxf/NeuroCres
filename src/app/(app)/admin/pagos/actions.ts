"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";

const texto = z.string().trim().max(120);

const esquema = z.object({
  medio: z.enum(["transferencia", "llave", "qr", "nequi"]),
  titular: texto,
  banco: texto,
  tipoCuenta: texto,
  numero: texto,
  llave: texto,
  activo: z.boolean(),
});

// Solo el administrador puede escribir: lo garantiza RLS.
export async function guardarMedioDePago(formData: FormData) {
  const parsed = esquema.safeParse({
    medio: formData.get("medio"),
    titular: formData.get("titular") ?? "",
    banco: formData.get("banco") ?? "",
    tipoCuenta: formData.get("tipoCuenta") ?? "",
    numero: formData.get("numero") ?? "",
    llave: formData.get("llave") ?? "",
    activo: formData.get("activo") === "on",
  });
  if (!parsed.success) redirect("/admin/pagos?error=Revisa los datos.");
  const v = parsed.data;

  // Un medio activo debe tener con qué pagar: si no, la persona no sabría a dónde enviar.
  if (v.activo && !v.numero && !v.llave) {
    redirect(
      `/admin/pagos?error=${encodeURIComponent("Para activar un medio escribe el número o la llave.")}`,
    );
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("configuracion_pagos")
    .update({
      titular: v.titular || null,
      banco: v.banco || null,
      tipo_cuenta: v.tipoCuenta || null,
      numero: v.numero || null,
      llave: v.llave || null,
      activo: v.activo,
    })
    .eq("medio", v.medio)
    .select("medio");

  if (error || !data?.length) {
    redirect("/admin/pagos?error=No pudimos guardar. Intenta de nuevo.");
  }
  revalidatePath("/admin/pagos");
  redirect(`/admin/pagos?ok=${v.medio}`);
}
