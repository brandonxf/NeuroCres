import { describe, expect, it } from "vitest";
import {
  calcularAnticipo,
  formatearCop,
  slugDeNombre,
  textoModalidades,
} from "./servicios";

describe("calcularAnticipo", () => {
  // Tabla de tarifas del plan: precio → anticipo mínimo (50%) → saldo.
  it.each([
    [150000, 75000, 75000],
    [140000, 70000, 70000],
    [440000, 220000, 220000],
    [550000, 275000, 275000],
    [520000, 260000, 260000],
    [1000000, 500000, 500000],
  ])("precio %i → anticipo %i y saldo %i", (precio, anticipo, saldo) => {
    expect(calcularAnticipo(precio, 50)).toEqual({ anticipo, saldo });
  });

  it("redondea el anticipo hacia arriba y el saldo completa el precio", () => {
    const r = calcularAnticipo(100001, 50);
    expect(r).toEqual({ anticipo: 50001, saldo: 50000 });
    expect(r.anticipo + r.saldo).toBe(100001);
  });

  it("cubre los extremos 0% y 100%", () => {
    expect(calcularAnticipo(150000, 0)).toEqual({ anticipo: 0, saldo: 150000 });
    expect(calcularAnticipo(150000, 100)).toEqual({
      anticipo: 150000,
      saldo: 0,
    });
  });
});

describe("formatearCop", () => {
  it("usa punto de miles y sin decimales", () => {
    expect(formatearCop(150000)).toBe("$150.000");
    expect(formatearCop(1000000)).toBe("$1.000.000");
  });
});

describe("slugDeNombre", () => {
  it("quita tildes, símbolos y espacios sobrantes", () => {
    expect(slugDeNombre("Atención Psicológica Individual")).toBe(
      "atencion-psicologica-individual",
    );
    expect(slugDeNombre("Rehabilitación Cognitiva · Plan 4")).toBe(
      "rehabilitacion-cognitiva-plan-4",
    );
    expect(slugDeNombre("  --Hola!  ")).toBe("hola");
  });
});

describe("textoModalidades", () => {
  it("muestra las etiquetas legibles", () => {
    expect(textoModalidades(["presencial", "virtual"])).toBe(
      "Presencial · Virtual",
    );
  });
});
