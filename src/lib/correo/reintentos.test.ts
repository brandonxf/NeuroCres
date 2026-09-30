import { describe, expect, it } from "vitest";
import { esperaMinutos, MAX_INTENTOS } from "./reintentos";

describe("esperaMinutos", () => {
  it("duplica la espera en cada intento fallido", () => {
    expect([1, 2, 3, 4].map(esperaMinutos)).toEqual([10, 20, 40, 80]);
  });
  it("no da valores raros con cero intentos", () => {
    expect(esperaMinutos(0)).toBe(10);
  });
  it("da por fallido tras cinco intentos", () => {
    expect(MAX_INTENTOS).toBe(5);
  });
});
