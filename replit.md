# Manajemen Inventori Gudang

Aplikasi manajemen inventori gudang berbasis web untuk melacak material masuk dan keluar menggunakan scan QR code / barcode.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/gudang run dev` — run the frontend (port 24430, preview at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + shadcn/ui + wouter
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- QR scanning: jsQR (camera), qrcode (generation)
- Export: jsPDF, xlsx

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for API contracts
- `lib/db/src/schema/` — Drizzle table definitions (users, materials, scanSessions)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/gudang/src/pages/` — Frontend pages
- `artifacts/gudang/src/lib/auth-context.tsx` — Auth context + localStorage token management

## Architecture decisions

- Token auth via Base64-encoded payload (userId:username:timestamp) stored in localStorage — lightweight, no JWT library needed
- Password hashing via SHA256 + static salt (no bcrypt dependency in server)
- History endpoint builds records from scan_in (completed) + scan_out tables on the fly
- Serial numbers are globally unique across all scan sessions (UNIQUE constraint)
- QR code data for a box = all serial numbers joined by newline, used for scan-out matching

## Product

- **Login** — username/password with role-based access (master/user)
- **Dashboard** — total material in/out/stock, per-material stats, recent activity feed, filter by material
- **Scan Material** — Scan masuk (select material → scan serial numbers → generate QR) and Scan keluar (scan box QR)
- **Riwayat** — History of all scans, export to PDF/XLSX, print QR codes, master can delete records
- **Master** (master only) — Manage materials and users

## Default accounts

- `admin` / `admin123` — role: master
- `operator1` / `user123` — role: user

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always rebuild libs (`pnpm run typecheck:libs`) after schema changes before typechecking the API server
- The `LoginResponse` schema was renamed to `AuthResult` in openapi.yaml to avoid TS2308 collision with Orval-generated type names
- After installing new pnpm packages in the frontend artifact, restart the gudang workflow for Vite to pick them up cleanly

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
