import { cn } from "@/lib/cn";
import { ESTADOS_CITA, type EstadoCita } from "@/lib/citas";

const COLORES: Record<EstadoCita, string> = {
  pendiente_pago: "bg-acento/30 text-texto",
  confirmada: "bg-primario text-fondo",
  completada: "bg-secundario/50 text-primario",
  cancelada: "bg-error/10 text-error",
  inasistencia: "bg-error/10 text-error",
  reprogramada: "bg-borde text-texto",
};

export function EstadoCitaEtiqueta({ estado }: { estado: string }) {
  const e = estado as EstadoCita;
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
        COLORES[e] ?? "bg-borde text-texto",
      )}
    >
      {ESTADOS_CITA[e] ?? estado}
    </span>
  );
}
