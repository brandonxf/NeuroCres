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

## Estado

| Fase                                | Contenido                                                                                     | Estado                                                    |
| ----------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 0 · Fundamentos                     | Cuentas, roles, permisos por fila, personas, auditoría, almacenamiento privado                | Terminada                                                 |
| 1 · MVP                             | Catálogo, agenda, reserva, consentimientos, política, pagos con comprobante, correos, paneles | Implementada (falta revisión legal y prueba en navegador) |
| 2 · Procesos, resultados e informes |                                                                                               | Pendiente                                                 |
| 3 · Grupales y paquetes             |                                                                                               | Pendiente                                                 |
| 4 · Seguimiento y crecimiento       |                                                                                               | Pendiente                                                 |

## Variables de entorno

| Variable                                                    | Uso                                                                                                                        |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente de Supabase                                                                                                        |
| `SUPABASE_SERVICE_ROLE_KEY`                                 | Solo servidor: envío de correos y tareas del sistema                                                                       |
| `NEXT_PUBLIC_APP_URL`                                       | URL pública, para los enlaces de los correos                                                                               |
| `RESEND_API_KEY`, `EMAIL_FROM`                              | Correos (por defecto `onboarding@resend.dev`, que solo entrega al dueño de la cuenta de Resend hasta verificar un dominio) |
| `CRON_SECRET`                                               | Secreto con el que la base de datos invoca `/api/cron/notificaciones`                                                      |

## Tareas programadas

Dos trabajos de `pg_cron` en Supabase, sin secretos en el repositorio:

- `expirar-cupos-vencidos` (cada 10 min): cancela las citas pendientes cuyo cupo venció y libera el horario.
- `enviar-notificaciones` (cada 5 min): llama a `/api/cron/notificaciones`. La URL y el secreto están en el Vault de Supabase (`app_url` y `cron_secret`); el secreto debe coincidir con `CRON_SECRET` en Vercel.

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

## Usuarios de prueba

Contraseña de todos: `NeuroCres#Prueba1`

| Correo                       | Roles                          |
| ---------------------------- | ------------------------------ |
| `consultante@neurocres.test` | consultante                    |
| `responsable@neurocres.test` | consultante, responsable_legal |
| `profesional@neurocres.test` | consultante, profesional       |
| `admin@neurocres.test`       | consultante, administrador     |

## Pruebas de base de datos

Los permisos y las reglas de negocio están en SQL y se prueban con pgTAP (`supabase/tests/database/`). Con el CLI de Supabase: `npm run test:db`. Sin él, cada archivo se puede ejecutar completo en el editor SQL de Supabase (termina con `rollback`, no deja datos).

## Antes de atender a personas reales

- Un abogado debe revisar los consentimientos, la autorización de datos y la política de cancelación (hoy son borradores marcados como tales) y publicarse la versión final desde Administración.
- Cargar los datos reales de los medios de pago, la dirección del consultorio y el enlace de la sala virtual.
- Verificar un dominio en Resend y definir `EMAIL_FROM`.
- Borrar los usuarios de prueba y activar la protección contra contraseñas filtradas en Supabase.
- Desactivar la protección de despliegues de Vercel (Vercel Auth) para que el sitio sea público.

## Marca

| Color      | Hex       |
| ---------- | --------- |
| Primario   | `#214B45` |
| Secundario | `#9EAB95` |
| Acento     | `#C78F74` |
| Fondo      | `#E8E4D8` |
| Texto      | `#383838` |
