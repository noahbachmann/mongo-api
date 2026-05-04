type RequestOpts = {
	method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
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

	const collection = (name: string) => `/api/collection/${encodeURIComponent(name)}`
	const doc = (name: string, id: string) => `${collection(name)}/documents/${encodeURIComponent(id)}`

	return {
		// databases (no ?db=)
		listDbs: () => request('/api/db', { needsDb: false }),
		dbStats: (name: string) => request(`/api/db/${encodeURIComponent(name)}/stats`, { needsDb: false }),
		dropDb: (name: string) => request(`/api/db/${encodeURIComponent(name)}`, { method: 'DELETE', needsDb: false }),

		// collections
		listCollections: () => request('/api/collection'),
		createCollection: (name: string) => request(collection(name), { method: 'POST' }),
		dropCollection: (name: string) => request(collection(name), { method: 'DELETE' }),
		collectionStats: (name: string) => request(`${collection(name)}/stats`),

		// documents
		listDocuments: (name: string, opts?: { filter?: string; limit?: number; skip?: number }) =>
			request(`${collection(name)}/documents`, { query: opts as Record<string, unknown> | undefined }),
		insertDocument: (name: string, body: unknown) =>
			request(`${collection(name)}/documents`, { method: 'POST', body }),
		getDocument: (name: string, id: string) => request(doc(name, id)),
		updateDocument: (name: string, id: string, body: unknown) => request(doc(name, id), { method: 'PUT', body }),
		deleteDocument: (name: string, id: string) => request(doc(name, id), { method: 'DELETE' }),

		// MongoDB has no explicit create-db; materialize one by creating its first collection.
		createDbWithCollection: (dbName: string, collName: string) =>
			$fetch(collection(collName), { baseURL, method: 'POST', query: { db: dbName } }),
	}
}

