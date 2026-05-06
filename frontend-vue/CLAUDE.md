# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Vue 3 + Vite frontend that provides a visual admin UI for a MongoDB instance. It talks over HTTP to a separate **MongoApi** backend (an OpenAPI-described service exposing database, collection, and document operations). All data access goes through that backend — there is no direct MongoDB driver in this repo.

## Stack and package manager

- Vue `^3.5`, Vite `^8`, TypeScript.
- **Use `pnpm`** — the project ships a `pnpm-lock.yaml`. Do not run `npm install` or `yarn`.

## Directory structure

Source root is `src/`:

- `src/components/` — Vue SFCs
- `src/composables/` — composables (e.g. `useMongoApi`, `useCurrentDb`)
- `src/assets/` — static assets
- `src/App.vue` — root component
- `src/main.ts` — entry point
- `src/style.css` — global CSS and Tailwind v4 theme

Project root: `public/` (static assets), `vite.config.ts`, `tsconfig.json`.

## Backend API contract (MongoApi)

Base path: `/api`. Every collection/document endpoint requires a `?db=<name>` query parameter.

**Database** — `/api/db`

- `GET /api/db` — list databases
- `GET /api/db/{dbName}/stats` — db stats
- `DELETE /api/db/{dbName}` — drop db

**Collection** — `/api/collection` (all require `?db=`)

- `GET /api/collection?db=` — list collections
- `POST /api/collection/{name}?db=` — create collection
- `DELETE /api/collection/{name}?db=` — drop collection
- `GET /api/collection/{name}/stats?db=` — collection stats

**Documents** — under a collection (all require `?db=`)

- `GET /api/collection/{name}/documents?db=&filter=&limit=50&skip=0` — list/query (filter is a JSON string; default page size 50)
- `POST /api/collection/{name}/documents?db=` — insert (JSON body)
- `GET|PUT|DELETE /api/collection/{name}/documents/{id}?db=` — read/update/delete by id

### API integration pattern

- `src/composables/useMongoApi.ts` wraps native `fetch` with the base URL and auto-appends `?db=` from the current selection.
- `src/composables/useCurrentDb.ts` holds shared current-database state as a module-level `ref` — one singleton across all composable calls.
- The backend base URL is set via the `VITE_API_BASE` env var. For local dev, the Vite dev proxy in `vite.config.ts` forwards `/api` to `http://localhost:8080` (override with `VITE_API_BASE`).

## TypeScript

Config is split across `tsconfig.json` → `tsconfig.app.json` / `tsconfig.node.json`. Type-check with `vue-tsc -b`.

## Conventions

- Vue 3 SFCs with `<script setup lang="ts">`.
- **Always import explicitly** — there are no auto-imports. Import Vue composition API from `'vue'` and composables with relative paths.

## Styling

- **Tailwind v4** via `@tailwindcss/vite` plugin (wired in `vite.config.ts`). CSS-first config in `src/style.css`.
- **Do not use inline `style="..."` attributes**, and avoid `<style>` blocks unless a utility cannot express the rule.
- **Spacing scale is `--spacing: 1px`** (set in `style.css`). `p-4` = 4px, `gap-12` = 12px, `mt-24` = 24px.
- **Colors live as theme tokens** in `style.css` under `@theme`. Use semantic utilities (`bg-primary`, `text-secondary`, `border-accent`, `bg-bright-primary`, `bg-surface`) rather than raw hex or Tailwind's default palette.

### Color theme — "Verdant" (MongoDB-aligned)

| Token                    | Hex       | Role                                                  |
| ------------------------ | --------- | ----------------------------------------------------- |
| `--color-primary`        | `#00684A` | Deep forest green — primary actions, active state     |
| `--color-bright-primary` | `#13AA52` | Mongo leaf green — hover, highlights, success         |
| `--color-secondary`      | `#1C1C1C` | Rich ink — body text, structural lines                |
| `--color-accent`         | `#F5B82E` | Warm amber — warnings, badges, attention              |
| `--color-surface`        | `#FAFAF7` | Warm off-white — page background                      |
