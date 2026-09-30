import type { ComponentProps } from "react";
import { Campo } from "./campo";

/** Selector de fecha nativo (calendario del dispositivo). Valor en formato AAAA-MM-DD. */
export function SelectorFecha(
  props: Omit<ComponentProps<typeof Campo>, "type"> & {
    min?: string;
    max?: string;
  },
) {
  return <Campo type="date" {...props} />;
}
