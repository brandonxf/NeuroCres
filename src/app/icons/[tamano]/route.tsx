import { ImageResponse } from "next/og";

export const dynamic = "force-static";

const TAMANOS: Record<
  string,
  { px: number; relleno: number; esquinas: number }
> = {
  "192": { px: 192, relleno: 0, esquinas: 0.25 },
  "512": { px: 512, relleno: 0, esquinas: 0.25 },
  // Maskable: el sistema recorta; dejamos margen de seguridad y fondo a sangre.
  "512-maskable": { px: 512, relleno: 0.18, esquinas: 0 },
};

export function generateStaticParams() {
  return Object.keys(TAMANOS).map((tamano) => ({ tamano }));
}

/** Isotipo de marca en PNG para el manifiesto PWA (mismo dibujo que <Isotipo />). */
export async function GET(
  _: Request,
  { params }: { params: Promise<{ tamano: string }> },
) {
  const { tamano } = await params;
  const cfg = TAMANOS[tamano];
  if (!cfg) return new Response("No encontrado", { status: 404 });

  const lado = cfg.px * (1 - cfg.relleno * 2);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#214B45",
        borderRadius: cfg.px * cfg.esquinas,
      }}
    >
      <svg width={lado} height={lado} viewBox="0 0 48 48">
        <g stroke="#9EAB95" strokeWidth="2.5" strokeLinecap="round" fill="none">
          <path d="M24 26 L24 12" />
          <path d="M24 26 L12 34" />
          <path d="M24 26 L36 34" />
        </g>
        <circle cx="24" cy="11" r="3.5" fill="#C78F74" />
        <circle cx="11" cy="35" r="3.5" fill="#E8E4D8" />
        <circle cx="37" cy="35" r="3.5" fill="#E8E4D8" />
        <circle cx="24" cy="26" r="5" fill="#E8E4D8" />
      </svg>
    </div>,
    { width: cfg.px, height: cfg.px },
  );
}
