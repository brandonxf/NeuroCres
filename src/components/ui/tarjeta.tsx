import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function Tarjeta({ className, ...resto }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-tarjeta border-borde bg-superficie border p-5 shadow-sm",
        className,
      )}
      {...resto}
    />
  );
}
