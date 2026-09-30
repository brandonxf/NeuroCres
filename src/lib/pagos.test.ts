import { describe, expect, it } from "vitest";
import { medioPermitido } from "./pagos";

describe("medioPermitido", () => {
  it("el efectivo solo sirve para el saldo de una cita presencial", () => {
    expect(medioPermitido("efectivo", "saldo", "presencial")).toBe(true);
    expect(medioPermitido("efectivo", "anticipo", "presencial")).toBe(false);
    expect(medioPermitido("efectivo", "saldo", "virtual")).toBe(false);
    expect(medioPermitido("efectivo", "anticipo", "virtual")).toBe(false);
  });

  it("los demás medios sirven para cualquier pago", () => {
    for (const m of ["transferencia", "llave", "qr", "nequi"] as const) {
      expect(medioPermitido(m, "anticipo", "virtual")).toBe(true);
      expect(medioPermitido(m, "saldo", "presencial")).toBe(true);
    }
  });
});
