import { describe, expect, it } from "vitest";
import {
  esquemaBloqueo,
  esquemaFranja,
  esquemaParametrosAgenda,
} from "./agenda";

describe("esquemaFranja", () => {
  const valida = {
    diaSemana: "1",
    horaInicio: "08:00",
    horaFin: "12:00",
    modalidades: ["presencial"],
  };

  it("acepta una franja válida", () => {
    expect(esquemaFranja.safeParse(valida).success).toBe(true);
  });

  it("rechaza fin igual o anterior al inicio", () => {
    expect(
      esquemaFranja.safeParse({ ...valida, horaFin: "08:00" }).success,
    ).toBe(false);
    expect(
      esquemaFranja.safeParse({ ...valida, horaFin: "07:00" }).success,
    ).toBe(false);
  });

  it("rechaza horas mal escritas y días fuera de rango", () => {
    expect(
      esquemaFranja.safeParse({ ...valida, horaInicio: "8:00" }).success,
    ).toBe(false);
    expect(
      esquemaFranja.safeParse({ ...valida, horaFin: "24:00" }).success,
    ).toBe(false);
    expect(esquemaFranja.safeParse({ ...valida, diaSemana: "7" }).success).toBe(
      false,
    );
  });

  it("exige al menos una modalidad", () => {
    expect(
      esquemaFranja.safeParse({ ...valida, modalidades: [] }).success,
    ).toBe(false);
  });
});

describe("esquemaBloqueo", () => {
  it("acepta un rango válido y rechaza uno invertido", () => {
    const ok = {
      inicio: "2026-12-24T00:00",
      fin: "2026-12-26T00:00",
      motivo: "Vacaciones",
    };
    expect(esquemaBloqueo.safeParse(ok).success).toBe(true);
    expect(
      esquemaBloqueo.safeParse({ ...ok, inicio: ok.fin, fin: ok.inicio })
        .success,
    ).toBe(false);
  });
});

describe("esquemaParametrosAgenda", () => {
  const validos = {
    descansoMin: "15",
    antelacionMinHoras: "12",
    horizonteDias: "60",
    granularidadMin: "30",
  };

  it("acepta los valores de ejemplo de la guía", () => {
    expect(esquemaParametrosAgenda.safeParse(validos).success).toBe(true);
  });

  it("solo permite granularidad de 15 o 30 minutos", () => {
    expect(
      esquemaParametrosAgenda.safeParse({ ...validos, granularidadMin: "20" })
        .success,
    ).toBe(false);
  });

  it("rechaza un horizonte de 0 días", () => {
    expect(
      esquemaParametrosAgenda.safeParse({ ...validos, horizonteDias: "0" })
        .success,
    ).toBe(false);
  });
});
