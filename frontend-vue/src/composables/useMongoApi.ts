import { useCurrentDb } from './useCurrentDb'

type RequestOpts = {
	method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
	body?: unknown
	needsDb?: boolean
	query?: Record<string, unknown>
}

async function apiFetch<T>(
	path: string,
	init: Omit<RequestInit, 'body'> & { query?: Record<string, unknown>; body?: unknown } = {},
): Promise<T> {
	const base = import.meta.env.VITE_API_BASE ?? ''
	const { query, body, ...rest } = init
	const url = new URL(path, base || location.origin)
	if (query) Object.entries(query).forEach(([k, v]) => v != null && url.searchParams.set(k, String(v)))
	const res = await fetch(url.toString(), {
		...rest,
		body: body !== undefined ? JSON.stringify(body) : undefined,
		headers: body !== undefined ? { 'Content-Type': 'application/json', ...rest.headers } : rest.headers,
	})
	if (!res.ok) {
		const body = await res.text().catch(() => '')
		throw new Error(body || `${res.status} ${res.statusText}`)
	}
	const text = await res.text()
	return (text ? JSON.parse(text) : undefined) as T
}

export function useMongoApi() {
	const currentDb = useCurrentDb()

	const requireDb = () => {
		if (!currentDb.value) throw new Error('No database selected. Pick one from the db-dropdown first.')
		return currentDb.value
	}

	const request = <T = unknown>(path: string, opts: RequestOpts = {}) => {
		const query: Record<string, unknown> = { ...(opts.query ?? {}) }
		if (opts.needsDb !== false) query.db = requireDb()
		return apiFetch<T>(path, {
			method: opts.method ?? 'GET',
			body: opts.body,
			query,
		})
	}

	const collectionURL = (name: string) => `/api/collection/${encodeURIComponent(name)}`
	const documentURL = (name: string, id: string) => `${collectionURL(name)}/documents/${encodeURIComponent(id)}`

	return {
		// databases (no ?db=)
		listDbs: () => request('/api/db', { needsDb: false }),
		dbStats: (name: string) => request(`/api/db/${encodeURIComponent(name)}/stats`, { needsDb: false }),
		dropDb: (name: string) => request(`/api/db/${encodeURIComponent(name)}`, { method: 'DELETE', needsDb: false }),

		// collections
		listCollections: () => request('/api/collection'),
		createCollection: (name: string) => request(collectionURL(name), { method: 'POST' }),
		dropCollection: (name: string) => request(collectionURL(name), { method: 'DELETE' }),
		collectionStats: (name: string) => request(`${collectionURL(name)}/stats`),

		// documents
		listDocuments: (cName: string, queryOpts?: { filter?: string; limit?: number; skip?: number }) =>
			request(`${collectionURL(cName)}/documents`, { query: queryOpts as Record<string, unknown> | undefined }),
		insertDocument: (name: string, body: unknown) =>
			request(`${collectionURL(name)}/documents`, { method: 'POST', body }),
		getDocument: (name: string, id: string) => request(documentURL(name, id)),
		updateDocument: (name: string, body: any, filter?: string) => {
			const parsed = filter ? JSON.parse(filter) : undefined

			const id = parsed?.id

			if (id) {
				return request(`${collectionURL(name)}/documents/${id}`, {
					method: 'PATCH',
					body,
				})
			}

			return request(`${collectionURL(name)}/documents/single`, {
				method: 'PATCH',
				body,
				query: filter ? { filter } : undefined,
			})
		},
		updateDocuments: (name: string, body: unknown, filter?: string) =>
			request(`${collectionURL(name)}/documents`, {
				method: 'PATCH',
				body,
				query: filter ? { filter } : undefined,
			}),
		deleteDocument: (name: string, id: string) => request(documentURL(name, id), { method: 'DELETE' }),
		deleteDocuments: (name: string, filter?: string) =>
			request(`${collectionURL(name)}/documents`, {
				method: 'DELETE',
				query: filter ? { filter } : undefined,
			}),

		// MongoDB has no explicit create-db; materialize one by creating its first collection.
		createDbWithCollection: (dbName: string, collName: string) =>
			apiFetch(collectionURL(collName), { method: 'POST', query: { db: dbName } }),
	}
}

