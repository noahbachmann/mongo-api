type RequestOpts = {
	method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
	body?: unknown
	needsDb?: boolean
	query?: Record<string, unknown>
}

export function useMongoApi() {
	const baseURL = useRuntimeConfig().public.apiBase || undefined
	const currentDb = useCurrentDb()

	const requireDb = () => {
		if (!currentDb.value) throw new Error('No database selected. Pick one from the db-dropdown first.')
		return currentDb.value
	}

	const request = <T = unknown>(path: string, opts: RequestOpts = {}) => {
		const query: Record<string, unknown> = { ...(opts.query ?? {}) }
		if (opts.needsDb !== false) query.db = requireDb()
		return $fetch<T>(path, {
			baseURL,
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
		updateDocument: (name: string, body: unknown, filter?: string) =>
			request(`${collectionURL(name)}/documents/single`, {
				method: 'PATCH',
				body,
				query: filter ? { filter } : undefined,
			}),
		updateDocuments: (name: string, body: unknown, filter?: string) =>
			request(`${collectionURL(name)}/documents`, {
				method: 'PATCH',
				body,
				query: filter ? { filter } : undefined,
			}),
		deleteDocument: (name: string, id: string) => request(documentURL(name, id), { method: 'DELETE' }),

		// MongoDB has no explicit create-db; materialize one by creating its first collection.
		createDbWithCollection: (dbName: string, collName: string) =>
			$fetch(collectionURL(collName), { baseURL, method: 'POST', query: { db: dbName } }),
	}
}

