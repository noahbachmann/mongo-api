export function useMongoApi() {
	const baseURL = useRuntimeConfig().public.apiBase || undefined
	const currentDb = useCurrentDb()

	const db = () => {
		if (!currentDb.value) throw new Error('No database selected. Pick one from the db dropdown first.')
		return currentDb.value
	}

	return {
		listDbs: () => $fetch('/api/db', { baseURL }),
		listCollections: () => $fetch('/api/collection', { baseURL, query: { db: db() } }),
		dropCollection: (name: string) =>
			$fetch(`/api/collection/${encodeURIComponent(name)}`, {
				method: 'DELETE',
				baseURL,
				query: { db: db() },
			}),
	}
}
