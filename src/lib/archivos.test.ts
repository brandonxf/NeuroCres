import { describe, expect, it } from "vitest";
import { TAMANO_MAXIMO_BYTES, detectarTipo, validarArchivo } from "./archivos";

const con = (firma: number[], relleno = 10) =>
  new Uint8Array([...firma, ...new Array(relleno).fill(0)]);

describe("detectarTipo", () => {
  it("reconoce JPG, PNG y PDF por su contenido", () => {
    expect(detectarTipo(con([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectarTipo(con([0x89, 0x50, 0x4e, 0x47]))).toBe("image/png");
    expect(detectarTipo(con([0x25, 0x50, 0x44, 0x46]))).toBe("application/pdf");
  });

  it("rechaza ejecutables y HTML aunque se llamen .pdf", () => {
    expect(detectarTipo(new TextEncoder().encode("<html><script>"))).toBeNull();
    expect(detectarTipo(con([0x4d, 0x5a]))).toBeNull(); // MZ (.exe)
  });
});

describe("validarArchivo", () => {
  it("acepta un PDF pequeño", () => {
    const r = validarArchivo(con([0x25, 0x50, 0x44, 0x46]));
    expect(r).toEqual({ ok: true, tipo: "application/pdf", extension: "pdf" });
  });

  it("rechaza archivos vacíos y de más de 5 MB", () => {
    expect(validarArchivo(new Uint8Array()).ok).toBe(false);
    const grande = con([0x25, 0x50, 0x44, 0x46], TAMANO_MAXIMO_BYTES);
    expect(validarArchivo(grande)).toEqual({
      ok: false,
      error: "El archivo supera los 5 MB.",
    });
  });
});
