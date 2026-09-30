# NeuroCres

Sistema de gestión de atención psicológica y neuropsicológica: agenda, pagos con anticipo, consentimientos, procesos, informes, grupales y paquetes.

La guía de trabajo está en [`docs/NeuroCres_Guia_de_Implementacion_por_Fases.pdf`](docs/NeuroCres_Guia_de_Implementacion_por_Fases.pdf).

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS · Supabase (Postgres, Auth, Storage, RLS) · Vercel.

## Levantar el proyecto

Requisitos: Node 22+ y npm.

```bash
git clone https://github.com/brandonxf/NeuroCres.git
cd NeuroCres
npm install
cp .env.example .env.local   # completar con las claves del proyecto Supabase de desarrollo
npm run dev
```

Abrir http://localhost:3000.

## Scripts

| Comando          | Qué hace                  |
| ---------------- | ------------------------- |
| `npm run dev`    | Servidor de desarrollo    |
| `npm run build`  | Compilación de producción |
| `npm run lint`   | ESLint                    |
| `npm run format` | Prettier                  |
| `npm test`       | Pruebas (Vitest)          |

## Base de datos

Las migraciones viven en `supabase/migrations/` y se versionan en el repositorio. Una migración ya aplicada nunca se edita: se crea otra.

Entornos: `neurocres-dev` (desarrollo) y `neurocres-prod` (producción). Nunca se prueba sobre producción.

## Marca

| Color      | Hex       |
| ---------- | --------- |
| Primario   | `#214B45` |
| Secundario | `#9EAB95` |
| Acento     | `#C78F74` |
| Fondo      | `#E8E4D8` |
| Texto      | `#383838` |
