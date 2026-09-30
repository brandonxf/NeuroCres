import { describe, expect, it } from "vitest";
import { esquemaRegistro, esquemaRestablecer } from "./auth";

const base = {
  nombres: "Ana",
  apellidos: "Pérez",
  telefono: "3001234567",
  correo: "  ANA@Correo.com ",
  contrasena: "clave1234",
  confirmacion: "clave1234",
};

describe("esquemaRegistro", () => {
  it("normaliza el correo y acepta datos válidos", () => {
    const r = esquemaRegistro.safeParse(base);
    expect(r.success && r.data.correo).toBe("ana@correo.com");
  });

  it("rechaza contraseñas sin número o muy cortas", () => {
    expect(
      esquemaRegistro.safeParse({
        ...base,
        contrasena: "sololetras",
        confirmacion: "sololetras",
      }).success,
    ).toBe(false);
    expect(
      esquemaRegistro.safeParse({
        ...base,
        contrasena: "a1",
        confirmacion: "a1",
      }).success,
    ).toBe(false);
  });

  it("rechaza confirmación distinta", () => {
    expect(
      esquemaRegistro.safeParse({ ...base, confirmacion: "otra1234" }).success,
    ).toBe(false);
  });

  it("rechaza teléfonos con letras", () => {
    expect(
      esquemaRegistro.safeParse({ ...base, telefono: "abc" }).success,
    ).toBe(false);
  });
});

describe("esquemaRestablecer", () => {
  it("exige que coincidan", () => {
    expect(
      esquemaRestablecer.safeParse({
        contrasena: "clave1234",
        confirmacion: "x",
      }).success,
    ).toBe(false);
  });
});
