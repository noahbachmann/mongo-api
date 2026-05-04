# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Nuxt 4 frontend that provides a visual admin UI for a MongoDB instance. It talks over HTTP to a separate **MongoApi** backend (an OpenAPI-described service exposing database, collection, and document operations). All data access goes through that backend — there is no direct MongoDB driver in this repo.

The repo is currently a fresh Nuxt scaffold; most application code (pages, components, composables, API client) has yet to be written.

## Stack and package manager

- Nuxt `^4.4.4`, Vue `^3.5.33`, vue-router `^5.0.6`, TypeScript.
- **Use `pnpm`** — the project ships a `pnpm-lock.yaml`. Do not run `npm install` or `yarn`; that creates a second lockfile and drifts dependencies.

## Nuxt 4 directory convention (read this before adding files)

Nuxt **4** uses `app/` as the source root, unlike Nuxt 3 where these folders sit at the project root. Place new code under `app/`:

- `app/pages/**` — file-based routes
- `app/components/**` — auto-imported components
- `app/composables/**` — auto-imported composables (e.g. `useMongoApi`)
- `app/layouts/**` — layouts
- `app/app.vue` — root component (currently shows `<NuxtWelcome />`; replace once real pages exist)

Stay at the project root: `public/` (static assets), `nuxt.config.ts`, `tsconfig.json`. Never hand-edit `.nuxt/` — it is regenerated.

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

Because `?db=` is on nearly every call, build it into a shared layer rather than inlining `$fetch` per page:

- A composable like `app/composables/useMongoApi.ts` that wraps `$fetch` (or `useFetch`) with the base URL and auto-appends `?db=` from the current selection.
- A "current database" state via `useState('currentDb', () => '')` so pages share the selection without prop-drilling.

The backend URL is not yet wired. When adding it, use Nuxt runtime config:

```ts
// nuxt.config.ts
runtimeConfig: {
	public: {
		apiBase: "";
	}
} // NUXT_PUBLIC_API_BASE overrides at runtime
```

For local dev, prefer a Nitro dev proxy in `nuxt.config.ts` (`nitro.devProxy`) over enabling CORS on the backend.

## TypeScript

`tsconfig.json` only references the auto-generated `.nuxt/tsconfig.*.json` files — type config flows from Nuxt. Edit `nuxt.config.ts` (e.g. `typescript.strict`) rather than the root `tsconfig.json`.

## Conventions

- Vue 3 SFCs with `<script setup lang="ts">`.
- Rely on Nuxt auto-imports — do **not** manually import `ref`, `computed`, `useState`, `useFetch`, `$fetch`, `definePageMeta`, etc., nor components under `app/components/`. Manually importing them suppresses Nuxt's auto-import handling and creates inconsistent code.
