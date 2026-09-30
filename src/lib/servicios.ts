export const TIPOS_SERVICIO = {
  individual: "Individual",
  proceso: "Proceso",
  paquete: "Paquete",
  grupal: "Grupal",
} as const;

export const MODALIDADES = {
  presencial: "Presencial",
  virtual: "Virtual",
} as const;

export type TipoServicio = keyof typeof TIPOS_SERVICIO;
export type Modalidad = keyof typeof MODALIDADES;

const formatoCop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/** $150.000 */
export function formatearCop(valor: number): string {
  return formatoCop.format(valor).replace(/\s/g, "");
}

/**
 * Anticipo y saldo de un servicio. El anticipo se redondea hacia arriba al peso
 * para que anticipo + saldo siempre sumen el precio exacto.
 */
export function calcularAnticipo(precioCop: number, anticipoPct: number) {
  const anticipo = Math.ceil((precioCop * anticipoPct) / 100);
  return { anticipo, saldo: precioCop - anticipo };
}

/** Nombre corto para la URL: "Atención Psicológica" → "atencion-psicologica". */
export function slugDeNombre(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function textoModalidades(modalidades: string[]): string {
  return modalidades.map((m) => MODALIDADES[m as Modalidad] ?? m).join(" · ");
}
