export const MEDIOS_PAGO = {
  transferencia: "Transferencia bancaria",
  llave: "Llave",
  qr: "Código QR",
  nequi: "Nequi",
  efectivo: "Efectivo",
} as const;

export type MedioPago = keyof typeof MEDIOS_PAGO;

export const ESTADOS_PAGO = {
  pendiente: "Pendiente",
  comprobante_recibido: "Comprobante recibido",
  verificado: "Verificado",
  rechazado: "Rechazado",
  pagado_en_consulta: "Pagado en consulta",
  reembolsado: "Reembolsado",
  expirado: "Expirado",
} as const;

export const MOTIVOS_RECHAZO = {
  monto_incorrecto: "El monto no es el correcto",
  comprobante_ilegible: "El comprobante no se lee bien",
  no_aparece_pago: "No aparece el pago",
  otro: "Otro motivo",
} as const;

export type MotivoRechazo = keyof typeof MOTIVOS_RECHAZO;

/** El efectivo solo sirve para el saldo de una cita presencial. */
export function medioPermitido(
  medio: MedioPago,
  concepto: "anticipo" | "saldo" | "otro",
  modalidad: "presencial" | "virtual",
): boolean {
  if (medio !== "efectivo") return true;
  return concepto === "saldo" && modalidad === "presencial";
}
