import { describe, expect, it } from "vitest";
import { aFilaServicio, esquemaServicio } from "./servicios";

const valido = {
  nombre: "Atención Psicológica Individual",
  slug: "",
  descripcion: "Sesión individual.",
  poblacion: "",
  tipo: "individual",
  duracionMin: "60",
  precioCop: "150000",
  anticipoPct: "50",
  modalidades: ["presencial", "virtual"],
  requierePresencial: false,
  requiereConsentimiento: true,
  requiereFormulario: false,
  requiereAnticipo: true,
  agendableEnLinea: true,
  activo: true,
  orden: "10",
};

describe("esquemaServicio", () => {
  it("acepta un servicio válido", () => {
    expect(esquemaServicio.safeParse(valido).success).toBe(true);
  });

  it("rechaza precio con puntos o letras", () => {
    expect(
      esquemaServicio.safeParse({ ...valido, precioCop: "150.000" }).success,
    ).toBe(false);
    expect(
      esquemaServicio.safeParse({ ...valido, precioCop: "abc" }).success,
    ).toBe(false);
  });

  it("rechaza anticipo mayor a 100", () => {
    expect(
      esquemaServicio.safeParse({ ...valido, anticipoPct: "101" }).success,
    ).toBe(false);
  });

  it("exige al menos una modalidad", () => {
    expect(
      esquemaServicio.safeParse({ ...valido, modalidades: [] }).success,
    ).toBe(false);
  });

  it("si requiere presencialidad, solo permite la modalidad presencial", () => {
    const r = esquemaServicio.safeParse({
      ...valido,
      requierePresencial: true,
    });
    expect(r.success).toBe(false);
    expect(
      esquemaServicio.safeParse({
        ...valido,
        requierePresencial: true,
        modalidades: ["presencial"],
      }).success,
    ).toBe(true);
  });

  it("rechaza slug con mayúsculas o espacios", () => {
    expect(
      esquemaServicio.safeParse({ ...valido, slug: "Mi Servicio" }).success,
    ).toBe(false);
  });
});

describe("aFilaServicio", () => {
  it("convierte texto a números y vacíos a null", () => {
    const fila = aFilaServicio(
      esquemaServicio.parse({ ...valido, duracionMin: "" }),
    );
    expect(fila.precio_cop).toBe(150000);
    expect(fila.anticipo_pct).toBe(50);
    expect(fila.duracion_min).toBeNull();
    expect(fila.poblacion).toBeNull();
    expect(fila.orden).toBe(10);
  });
});
