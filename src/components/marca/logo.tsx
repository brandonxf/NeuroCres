import { cn } from "@/lib/cn";

/** Isotipo: una neurona que brota (núcleo, ramas y hojas), en los colores de marca. */
export function Isotipo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      className={cn("size-9", className)}
    >
      <rect width="48" height="48" rx="12" fill="#214B45" />
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
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Isotipo />
      <span className="text-primario text-xl font-bold tracking-tight">
        NeuroCres
      </span>
    </span>
  );
}
