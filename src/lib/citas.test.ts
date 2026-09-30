import { describe, expect, it } from "vitest";
import {
  ESTADOS_ACTIVOS,
  ESTADOS_CITA,
  esEstadoFinal,
  puedeTransicionar,
  TRANSICIONES,
  type EstadoCita,
} from "./citas";

const estados = Object.keys(ESTADOS_CITA) as EstadoCita[];

describe("transiciones de una cita", () => {
  it("una cita pendiente solo se confirma o se cancela", () => {
    expect(TRANSICIONES.pendiente_pago).toEqual(["confirmada", "cancelada"]);
  });

  it("una cita confirmada se cierra, se cancela o se reprograma", () => {
    expect(TRANSICIONES.confirmada).toEqual([
      "completada",
      "inasistencia",
      "cancelada",
      "reprogramada",
    ]);
  });

  it("completada, cancelada, inasistencia y reprogramada son finales", () => {
    for (const e of [
      "completada",
      "cancelada",
      "inasistencia",
      "reprogramada",
    ] as const) {
      expect(esEstadoFinal(e)).toBe(true);
    }
    expect(esEstadoFinal("pendiente_pago")).toBe(false);
  });

  it("no se puede volver atrás ni saltar estados", () => {
    expect(puedeTransicionar("confirmada", "pendiente_pago")).toBe(false);
    expect(puedeTransicionar("pendiente_pago", "completada")).toBe(false);
    expect(puedeTransicionar("cancelada", "confirmada")).toBe(false);
  });

  it("todo destino es un estado conocido", () => {
    for (const desde of estados) {
      for (const hacia of TRANSICIONES[desde]) {
        expect(estados).toContain(hacia);
      }
    }
  });

  it("solo pendiente y confirmada ocupan la agenda", () => {
    expect(ESTADOS_ACTIVOS).toEqual(["pendiente_pago", "confirmada"]);
  });
});
