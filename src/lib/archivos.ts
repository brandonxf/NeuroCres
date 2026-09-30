export const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024;

export const TIPOS_PERMITIDOS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
} as const;

export type TipoMime = keyof typeof TIPOS_PERMITIDOS;

const FIRMAS: Record<TipoMime, number[]> = {
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "application/pdf": [0x25, 0x50, 0x44, 0x46], // %PDF
};

/** Tipo real del archivo según sus primeros bytes (no confía en el nombre ni en el tipo declarado). */
export function detectarTipo(bytes: Uint8Array): TipoMime | null {
  for (const [tipo, firma] of Object.entries(FIRMAS) as [
    TipoMime,
    number[],
  ][]) {
    if (firma.every((b, i) => bytes[i] === b)) return tipo;
  }
  return null;
}

export type ResultadoValidacion =
  | { ok: true; tipo: TipoMime; extension: string }
  | { ok: false; error: string };

export function validarArchivo(bytes: Uint8Array): ResultadoValidacion {
  if (bytes.byteLength === 0) {
    return { ok: false, error: "El archivo está vacío." };
  }
  if (bytes.byteLength > TAMANO_MAXIMO_BYTES) {
    return { ok: false, error: "El archivo supera los 5 MB." };
  }
  const tipo = detectarTipo(bytes);
  if (!tipo) {
    return { ok: false, error: "Solo se permiten archivos JPG, PNG o PDF." };
  }
  return { ok: true, tipo, extension: TIPOS_PERMITIDOS[tipo] };
}
