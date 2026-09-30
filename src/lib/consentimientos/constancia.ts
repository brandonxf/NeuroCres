import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { formatInTimeZone } from "date-fns-tz";

export type DatosConstancia = {
  titulo: string;
  version: number;
  /** Texto exacto que se mostró y se firmó (Markdown). */
  contenido: string;
  persona: { nombre: string; documento: string };
  firmante: { nombre: string; documento: string; calidad: string };
  asentimientoMenor: boolean;
  hashContenido: string;
  consentimientoId: string;
  firmadoAt: Date;
  /** Imagen PNG del trazo de la firma, si la hubo. */
  firmaPng?: Uint8Array;
};

const CALIDADES: Record<string, string> = {
  titular: "Titular",
  responsable_legal: "Responsable legal",
};

/** Quita la sintaxis Markdown para escribir el texto plano en el PDF. */
export function markdownATexto(md: string): string {
  return md
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((linea) =>
      linea
        .replace(/^\s{0,3}#{1,6}\s+/, "")
        .replace(/^\s*>\s?/, "")
        .replace(/^\s*[-*]\s+/, "• ")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/_(.+?)_/g, "$1"),
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Reemplaza lo que la fuente estándar no puede dibujar, para que el PDF nunca falle. */
function limpiar(texto: string, fuente: PDFFont): string {
  const soportados = new Set(fuente.getCharacterSet());
  return Array.from(texto)
    .map((c) => (soportados.has(c.codePointAt(0)!) || c === "\n" ? c : "?"))
    .join("");
}

function partirEnLineas(
  texto: string,
  fuente: PDFFont,
  tamano: number,
  ancho: number,
): string[] {
  const lineas: string[] = [];
  for (const parrafo of texto.split("\n")) {
    if (parrafo.trim() === "") {
      lineas.push("");
      continue;
    }
    let actual = "";
    for (const palabra of parrafo.split(/\s+/)) {
      const prueba = actual ? `${actual} ${palabra}` : palabra;
      if (fuente.widthOfTextAtSize(prueba, tamano) <= ancho) {
        actual = prueba;
      } else {
        if (actual) lineas.push(actual);
        actual = palabra;
      }
    }
    if (actual) lineas.push(actual);
  }
  return lineas;
}

/** PDF de constancia de un consentimiento firmado. */
export async function generarConstancia(
  d: DatosConstancia,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const verde = rgb(0.13, 0.29, 0.27); // #214B45, color primario de la marca
  const gris = rgb(0.35, 0.35, 0.35);

  const ANCHO = 595.28;
  const ALTO = 841.89;
  const MARGEN = 56;
  const ancho = ANCHO - MARGEN * 2;

  let pagina = pdf.addPage([ANCHO, ALTO]);
  let y = ALTO - MARGEN;

  const asegurarEspacio = (necesario: number) => {
    if (y - necesario < MARGEN) {
      pagina = pdf.addPage([ANCHO, ALTO]);
      y = ALTO - MARGEN;
    }
  };

  const escribir = (
    texto: string,
    opciones: {
      fuente?: PDFFont;
      tamano?: number;
      color?: ReturnType<typeof rgb>;
    } = {},
  ) => {
    const fuente = opciones.fuente ?? normal;
    const tamano = opciones.tamano ?? 10;
    const interlineado = tamano * 1.4;
    for (const linea of partirEnLineas(
      limpiar(texto, fuente),
      fuente,
      tamano,
      ancho,
    )) {
      asegurarEspacio(interlineado);
      if (linea) {
        pagina.drawText(linea, {
          x: MARGEN,
          y: y - tamano,
          size: tamano,
          font: fuente,
          color: opciones.color ?? rgb(0.15, 0.15, 0.15),
        });
      }
      y -= interlineado;
    }
  };

  escribir("NeuroCres · Constancia de consentimiento", {
    fuente: negrita,
    tamano: 16,
    color: verde,
  });
  y -= 6;

  const fecha =
    formatInTimeZone(d.firmadoAt, "America/Bogota", "dd/MM/yyyy HH:mm") +
    " (hora de Bogotá)";
  const filas: [string, string][] = [
    ["Documento", `${d.titulo} (versión ${d.version})`],
    ["Persona atendida", `${d.persona.nombre} · ${d.persona.documento}`],
    [
      "Firmante",
      `${d.firmante.nombre} · ${d.firmante.documento} · ${CALIDADES[d.firmante.calidad] ?? d.firmante.calidad}`,
    ],
    ["Fecha y hora de la firma", fecha],
  ];
  if (d.asentimientoMenor) {
    filas.push(["Asentimiento del menor", "Sí, quedó registrado"]);
  }
  for (const [etiqueta, valor] of filas) {
    escribir(etiqueta, { fuente: negrita, tamano: 9, color: gris });
    escribir(valor, { tamano: 10 });
  }

  y -= 10;
  escribir("Texto firmado", { fuente: negrita, tamano: 12, color: verde });
  y -= 2;
  escribir(markdownATexto(d.contenido), { tamano: 10 });

  y -= 14;
  if (d.firmaPng) {
    const imagen = await pdf.embedPng(d.firmaPng);
    const escala = Math.min(200 / imagen.width, 80 / imagen.height, 1);
    const w = imagen.width * escala;
    const h = imagen.height * escala;
    asegurarEspacio(h + 24);
    pagina.drawImage(imagen, { x: MARGEN, y: y - h, width: w, height: h });
    y -= h + 6;
  }
  escribir(d.firmante.nombre, { fuente: negrita, tamano: 10 });

  y -= 14;
  escribir(`Huella del texto firmado (SHA-256): ${d.hashContenido}`, {
    tamano: 8,
    color: gris,
  });
  escribir(`Identificador del registro: ${d.consentimientoId}`, {
    tamano: 8,
    color: gris,
  });

  return pdf.save();
}
