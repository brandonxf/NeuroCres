import { describe, expect, it } from "vitest";
import { generarIcs } from "./ics";

const base = {
  uid: "abc-123",
  titulo: "Cita en NeuroCres",
  inicio: new Date("2026-10-06T15:00:00Z"),
  fin: new Date("2026-10-06T16:00:00Z"),
};
const ahora = new Date("2026-10-01T12:00:00Z");

describe("generarIcs", () => {
  it("genera un evento válido con las horas en UTC", () => {
    const ics = generarIcs(base, ahora);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261006T150000Z");
    expect(ics).toContain("DTEND:20261006T160000Z");
    expect(ics).toContain("DTSTAMP:20261001T120000Z");
    expect(ics).toContain("UID:abc-123@neurocres");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("escapa comas, punto y coma y saltos de línea", () => {
    const ics = generarIcs(
      {
        ...base,
        lugar: "Calle 1, Oficina 2; Piso 3",
        descripcion: "Línea 1\nLínea 2",
      },
      ahora,
    );
    expect(ics).toContain("LOCATION:Calle 1\\, Oficina 2\; Piso 3");
    expect(ics).toContain("DESCRIPTION:Línea 1\\nLínea 2");
  });

  it("omite lugar y descripción si no hay", () => {
    const ics = generarIcs(base, ahora);
    expect(ics).not.toContain("LOCATION");
    expect(ics).not.toContain("DESCRIPTION");
  });
});
