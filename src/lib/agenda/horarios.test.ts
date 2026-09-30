import { describe, expect, it } from "vitest";
import {
  calcularHorariosLibres,
  diaDeLaSemana,
  PARAMETROS_AGENDA_POR_DEFECTO,
  ventanaDelDia,
  type EntradaHorarios,
} from "./horarios";

const ZONA = "America/Bogota";
// Lunes 5 de octubre de 2026. Bogotá es UTC-5 todo el año.
const LUNES = "2026-10-05";
const utc = (iso: string) => new Date(iso);
const bog = (fecha: string, hora: string) => utc(`${fecha}T${hora}:00-05:00`);

const base: EntradaHorarios = {
  fecha: LUNES,
  zonaHoraria: ZONA,
  franjas: [
    {
      diaSemana: 1,
      horaInicio: "08:00:00",
      horaFin: "12:00:00",
      modalidades: ["presencial", "virtual"],
    },
  ],
  ocupados: [],
  duracionMin: 60,
  modalidad: "presencial",
  parametros: PARAMETROS_AGENDA_POR_DEFECTO,
  ahora: utc("2026-09-30T12:00:00Z"),
};

const horas = (e: EntradaHorarios) =>
  calcularHorariosLibres(e).map((h) =>
    h.inicio.toLocaleTimeString("en-GB", {
      timeZone: ZONA,
      hour: "2-digit",
      minute: "2-digit",
    }),
  );

describe("diaDeLaSemana", () => {
  it("0 es domingo y 1 es lunes", () => {
    expect(diaDeLaSemana("2026-10-04")).toBe(0);
    expect(diaDeLaSemana("2026-10-05")).toBe(1);
    expect(diaDeLaSemana("2026-10-10")).toBe(6);
  });
});

describe("calcularHorariosLibres", () => {
  it("ofrece horarios cada 30 min que caben completos en la franja", () => {
    expect(horas(base)).toEqual([
      "08:00",
      "08:30",
      "09:00",
      "09:30",
      "10:00",
      "10:30",
      "11:00",
    ]);
  });

  it("devuelve el inicio en UTC correcto para la hora de Bogotá", () => {
    const [primero] = calcularHorariosLibres(base);
    expect(primero.inicio.toISOString()).toBe("2026-10-05T13:00:00.000Z");
    expect(primero.fin.toISOString()).toBe("2026-10-05T14:00:00.000Z");
  });

  it("respeta la granularidad de 15 minutos", () => {
    const r = horas({
      ...base,
      parametros: { ...base.parametros, granularidadMin: 15 },
    });
    expect(r.slice(0, 3)).toEqual(["08:00", "08:15", "08:30"]);
    expect(r.at(-1)).toBe("11:00");
  });

  it("no ofrece nada un día sin franjas", () => {
    expect(horas({ ...base, fecha: "2026-10-06" })).toEqual([]);
  });

  it("filtra por modalidad de la franja", () => {
    const soloPresencial = {
      ...base,
      franjas: [{ ...base.franjas[0], modalidades: ["presencial"] }],
    };
    expect(horas({ ...soloPresencial, modalidad: "virtual" })).toEqual([]);
    expect(horas({ ...soloPresencial, modalidad: "presencial" })).not.toEqual(
      [],
    );
  });

  it("resta una cita activa sumando el descanso (antes y después)", () => {
    // Cita 09:00–10:00 con descanso hasta 10:15.
    const r = horas({
      ...base,
      ocupados: [{ inicio: bog(LUNES, "09:00"), fin: bog(LUNES, "10:15") }],
    });
    // 08:00 terminaría 09:00 y su descanso pisaría la cita; 10:00 aún cae en el descanso.
    expect(r).toEqual(["10:30", "11:00"]);
  });

  it("resta un bloqueo de todo el día", () => {
    expect(
      horas({
        ...base,
        ocupados: [
          { inicio: bog(LUNES, "00:00"), fin: bog("2026-10-06", "00:00") },
        ],
      }),
    ).toEqual([]);
  });

  it("un bloqueo parcial deja libres los horarios que no toca", () => {
    const r = horas({
      ...base,
      parametros: { ...base.parametros, descansoMin: 0 },
      ocupados: [{ inicio: bog(LUNES, "10:00"), fin: bog(LUNES, "11:00") }],
    });
    expect(r).toEqual(["08:00", "08:30", "09:00", "11:00"]);
  });

  it("respeta la antelación mínima", () => {
    // Son las 08:00 del lunes en Bogotá y se exigen 2 horas de antelación.
    const r = horas({
      ...base,
      ahora: bog(LUNES, "08:00"),
      parametros: { ...base.parametros, antelacionMinHoras: 2 },
    });
    expect(r[0]).toBe("10:00");
  });

  it("no ofrece horarios más allá del horizonte", () => {
    expect(
      horas({
        ...base,
        ahora: utc("2026-07-01T12:00:00Z"),
        parametros: { ...base.parametros, horizonteDias: 60 },
      }),
    ).toEqual([]);
  });

  it("no ofrece un horario si la cita no cabe antes del fin de la franja", () => {
    expect(horas({ ...base, duracionMin: 240 })).toEqual(["08:00"]);
    expect(horas({ ...base, duracionMin: 300 })).toEqual([]);
  });

  it("junta varias franjas del mismo día en orden", () => {
    const r = horas({
      ...base,
      franjas: [
        { ...base.franjas[0], horaInicio: "14:00", horaFin: "16:00" },
        { ...base.franjas[0], horaInicio: "08:00", horaFin: "09:00" },
      ],
    });
    expect(r).toEqual(["08:00", "14:00", "14:30", "15:00"]);
  });
});

describe("ventanaDelDia", () => {
  it("cubre las 24 horas del día local", () => {
    const v = ventanaDelDia(LUNES, ZONA);
    expect(v.inicio.toISOString()).toBe("2026-10-05T05:00:00.000Z");
    expect(v.fin.toISOString()).toBe("2026-10-06T05:00:00.000Z");
  });
});
