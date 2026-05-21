# AGENTS.md

## Cursor Cloud specific instructions

This is a **Next.js 15 + Prisma (SQLite) + Tailwind CSS** monolithic app for contractor/subcontractor management (HYEV). No microservices, no Docker required.

### Quick reference

| Task | Command |
|------|---------|
| Install deps | `npm install` (runs `prisma generate` via postinstall) |
| Create/sync DB | `DATABASE_URL="file:./dev.db" npx prisma db push` |
| Dev server | `DATABASE_URL="file:./dev.db" npm run dev` (port 3002, Turbopack) |
| Lint | `npm run lint` |
| DB browser | `npm run db:studio` |

### Important caveats

- **DATABASE_URL must be set** for all Prisma commands and the dev server. The `.env.local` file is gitignored; create it with `DATABASE_URL="file:./dev.db"` or pass it inline.
- **No test framework** is configured (no Jest/Vitest/Playwright). Lint (`npm run lint`) is the only automated check.
- **Firebase is optional** — the app works fully without Firebase env vars; Firestore cloud sync simply won't activate.
- **SQLite is file-based** — no external database process needed. The DB file lives at `prisma/dev.db`.
- The dev server uses **Turbopack** by default (`npm run dev`). Use `npm run dev:webpack` if Turbopack causes issues.
