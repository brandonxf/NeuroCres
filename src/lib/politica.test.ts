import { describe, expect, it } from "vitest";
import { describirConsecuencia, type Consecuencia } from "./politica";

const base: Consecuencia = {
  tramo: "sin_costo",
  permitida: true,
  retener_cop: 0,
  devolver_cop: 0,
  trasladar_cop: 0,
  cobrar_cop: 0,
};

describe("describirConsecuencia", () => {
  it("cancelar con tiempo: se devuelve el anticipo", () => {
    const r = describirConsecuencia(
      { ...base, devolver_cop: 75000 },
      "cancelar",
    );
    expect(r.titulo).toBe("Sin costo");
    expect(r.lineas).toEqual(["Se te devuelven $75.000."]);
  });

  it("reprogramar con tiempo: el anticipo pasa a la nueva fecha", () => {
    const r = describirConsecuencia(
      { ...base, trasladar_cop: 75000 },
      "reprogramar",
    );
    expect(r.lineas).toEqual([
      "$75.000 de tu anticipo pasan a la nueva fecha.",
    ]);
  });

  it("reprogramación gratuita en el tramo intermedio", () => {
    const r = describirConsecuencia(
      { ...base, tramo: "intermedio", trasladar_cop: 75000 },
      "reprogramar",
    );
    expect(r.titulo).toBe("Sin costo (reprogramación gratuita)");
  });

  it("cargo parcial: muestra lo retenido y lo devuelto", () => {
    const r = describirConsecuencia(
      { ...base, tramo: "intermedio", retener_cop: 45000, devolver_cop: 30000 },
      "cancelar",
    );
    expect(r.titulo).toBe("Hay un cargo parcial");
    expect(r.lineas).toEqual([
      "Se retienen $45.000 de tu anticipo.",
      "Se te devuelven $30.000.",
    ]);
  });

  it("tramo tardío: retiene el anticipo y cobra el saldo", () => {
    const r = describirConsecuencia(
      { ...base, tramo: "tardio", retener_cop: 75000, cobrar_cop: 75000 },
      "cancelar",
    );
    expect(r.titulo).toBe("Se cobra la sesión completa");
    expect(r.lineas).toContain("Quedan por pagar $75.000.");
  });

  it("no permite reprogramar con muy poco tiempo", () => {
    const r = describirConsecuencia(
      { ...base, tramo: "tardio", permitida: false },
      "reprogramar",
    );
    expect(r.permitida).toBe(false);
  });

  it("cancela la profesional: devolución total", () => {
    const r = describirConsecuencia(
      { ...base, tramo: "profesional", devolver_cop: 75000 },
      "cancelar",
    );
    expect(r.titulo).toBe("Sin costo para ti");
  });
});
