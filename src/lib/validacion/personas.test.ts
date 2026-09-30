import { describe, expect, it } from "vitest";
import { esquemaPersonaNueva } from "./personas";

const adulto = {
  modo: "propia",
  parentesco: "",
  nombres: "Ana",
  apellidos: "Pérez",
  tipoDocumento: "CC",
  numeroDocumento: "1000001",
  fechaNacimiento: "1990-05-10",
  telefono: "",
  correo: "",
} as const;

const problemas = (datos: unknown) => {
  const r = esquemaPersonaNueva.safeParse(datos);
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
};

describe("esquemaPersonaNueva", () => {
  it("acepta una persona adulta propia", () => {
    expect(problemas(adulto)).toEqual([]);
  });

  it("no deja crear una cuenta propia de un menor", () => {
    expect(
      problemas({
        ...adulto,
        tipoDocumento: "TI",
        fechaNacimiento: "2018-01-01",
      }),
    ).toContain("fechaNacimiento");
  });

  it("acepta un menor a cargo con parentesco", () => {
    expect(
      problemas({
        ...adulto,
        modo: "a_cargo",
        parentesco: "madre",
        tipoDocumento: "TI",
        fechaNacimiento: "2018-01-01",
      }),
    ).toEqual([]);
  });

  it("exige parentesco cuando es a cargo", () => {
    expect(
      problemas({
        ...adulto,
        modo: "a_cargo",
        tipoDocumento: "TI",
        fechaNacimiento: "2018-01-01",
      }),
    ).toContain("parentesco");
  });

  it("no acepta cédula de ciudadanía en un menor", () => {
    expect(
      problemas({
        ...adulto,
        modo: "a_cargo",
        parentesco: "padre",
        fechaNacimiento: "2018-01-01",
      }),
    ).toContain("tipoDocumento");
  });

  it("rechaza fechas futuras y documentos con letras en CC/TI/RC", () => {
    expect(problemas({ ...adulto, fechaNacimiento: "2999-01-01" })).toContain(
      "fechaNacimiento",
    );
    expect(problemas({ ...adulto, numeroDocumento: "10A0001" })).toContain(
      "numeroDocumento",
    );
  });

  it("acepta pasaporte alfanumérico", () => {
    expect(
      problemas({
        ...adulto,
        tipoDocumento: "PA",
        numeroDocumento: "AB123456",
      }),
    ).toEqual([]);
  });
});
