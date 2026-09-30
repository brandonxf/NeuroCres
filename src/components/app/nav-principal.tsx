"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export type ItemNav = { href: string; etiqueta: string };

export function NavPrincipal({ items }: { items: ItemNav[] }) {
  const ruta = usePathname();

  return (
    <nav
      aria-label="Principal"
      className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0"
    >
      <ul className="flex min-w-max gap-1">
        {items.map((item) => {
          const activo = ruta === item.href || ruta.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={activo ? "page" : undefined}
                className={cn(
                  "rounded-control inline-flex min-h-11 items-center px-3 text-sm font-medium transition-colors",
                  activo
                    ? "bg-primario text-fondo"
                    : "text-primario hover:bg-primario/10",
                )}
              >
                {item.etiqueta}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
