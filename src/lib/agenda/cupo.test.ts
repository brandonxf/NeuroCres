import { describe, expect, it } from "vitest";
import { horasDeRetencion } from "./cupo";

const ahora = new Date("2026-10-01T12:00:00Z");
const en = (horas: number) => new Date(ahora.getTime() + horas * 36e5);

describe("horasDeRetencion", () => {
  it("con una cita lejana retiene 12 horas", () => {
    expect(horasDeRetencion(en(72), ahora)).toBe(12);
  });
  it("con una cita en menos de 24 horas retiene solo 2", () => {
    expect(horasDeRetencion(en(20), ahora)).toBe(2);
  });
  it("nunca retiene más de lo que falta para la cita", () => {
    expect(horasDeRetencion(en(1), ahora)).toBe(1);
  });
  it("respeta lo que configure el administrador", () => {
    expect(horasDeRetencion(en(72), ahora, { horas: 6 })).toBe(6);
  });
});
