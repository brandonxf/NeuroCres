import { describe, expect, it } from "vitest";
import { generarConstancia, markdownATexto } from "./constancia";

const base = {
  titulo: "Consentimiento informado",
  version: 1,
  contenido:
    "> **BORRADOR**\n\n## Título\n\nTexto con ñ, tildes áéíóú y símbolos ↔ ✓.\n\n- Primer punto\n- Segundo punto",
  persona: { nombre: "Ana Pérez", documento: "CC 12345678" },
  firmante: {
    nombre: "Ana Pérez",
    documento: "CC 12345678",
    calidad: "titular",
  },
  asentimientoMenor: false,
  hashContenido: "a".repeat(64),
  consentimientoId: "00000000-0000-0000-0000-000000000001",
  firmadoAt: new Date("2026-10-01T15:30:00Z"),
};

describe("markdownATexto", () => {
  it("quita encabezados, citas y énfasis y deja viñetas", () => {
    expect(
      markdownATexto("> **BORRADOR**\n\n## Título\n\n- Uno\n- Dos\n\n*fin*"),
    ).toBe("BORRADOR\n\nTítulo\n\n• Uno\n• Dos\n\nfin");
  });
});

describe("generarConstancia", () => {
  it("genera un PDF válido aunque el texto tenga caracteres fuera de la fuente estándar", async () => {
    const bytes = await generarConstancia(base);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });

  it("pagina los textos largos sin fallar", async () => {
    const largo = Array.from(
      { length: 200 },
      (_, i) => `Párrafo ${i} de un texto muy largo.`,
    ).join("\n\n");
    const bytes = await generarConstancia({ ...base, contenido: largo });
    expect(bytes.byteLength).toBeGreaterThan(5000);
  });
});
