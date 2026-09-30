import { describe, expect, it } from "vitest";
import { calcularEdad, esMenor, formatearFecha } from "./fechas";

describe("calcularEdad", () => {
  it("cuenta años cumplidos", () => {
    expect(calcularEdad("2010-06-15", "2026-06-14")).toBe(15);
    expect(calcularEdad("2010-06-15", "2026-06-15")).toBe(16);
    expect(calcularEdad("2008-09-30", "2026-09-30")).toBe(18);
  });

  it("detecta la mayoría de edad justo en el cumpleaños", () => {
    expect(esMenor("2008-10-01", "2026-09-30")).toBe(true);
    expect(esMenor("2008-09-30", "2026-09-30")).toBe(false);
  });
});

describe("formatearFecha", () => {
  it("escribe la fecha en español", () => {
    expect(formatearFecha("2018-05-05")).toBe("5 de mayo de 2018");
  });
});
