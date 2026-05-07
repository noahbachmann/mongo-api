import { useMongoApi } from '../../src/composables/useMongoApi'
import { useCurrentDb } from '../../src/composables/useCurrentDb'

function mockFetch(body: unknown = '', status = 200, statusText = 'OK') {
	return vi.fn().mockResolvedValue({
		ok: status >= 200 && status < 300,
		status,
		statusText,
		text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
	})
}

function fetchedURL(fetchFn: ReturnType<typeof vi.fn>): URL {
	return new URL(fetchFn.mock.calls[0][0])
}

function fetchedInit(fetchFn: ReturnType<typeof vi.fn>): RequestInit {
	return fetchFn.mock.calls[0][1] ?? {}
}

describe('useMongoApi', () => {
	let api: ReturnType<typeof useMongoApi>
	let fetchFn: ReturnType<typeof vi.fn>

	beforeEach(() => {
		useCurrentDb().value = 'testdb'
		fetchFn = mockFetch()
		vi.stubGlobal('fetch', fetchFn)
		vi.stubGlobal('location', { origin: 'http://localhost:3000' })
		api = useMongoApi()
	})

	afterEach(() => {
		vi.unstubAllGlobals()
	})

	describe('requireDb (implicit via collection/doc methods)', () => {
		it('throws when currentDb is empty', () => {
			useCurrentDb().value = ''
			expect(() => api.listCollections()).toThrow('No database selected')
		})
	})

	describe('listDbs', () => {
		it('calls GET /api/db without ?db= param', async () => {
			await api.listDbs()
			const url = fetchedURL(fetchFn)
			expect(url.pathname).toBe('/api/db')
			expect(url.searchParams.has('db')).toBe(false)
			expect(fetchedInit(fetchFn).method).toBe('GET')
		})

		it('returns parsed JSON response', async () => {
			fetchFn = mockFetch([{ name: 'db1' }])
			vi.stubGlobal('fetch', fetchFn)
			api = useMongoApi()
			const result = await api.listDbs()
			expect(result).toEqual([{ name: 'db1' }])
		})
	})

	describe('dbStats', () => {
		it('calls GET /api/db/{name}/stats without ?db=', async () => {
			await api.dbStats('mydb')
			const url = fetchedURL(fetchFn)
			expect(url.pathname).toBe('/api/db/mydb/stats')
			expect(url.searchParams.has('db')).toBe(false)
		})

		it('URL-encodes the database name', async () => {
			await api.dbStats('my db')
			const url = fetchedURL(fetchFn)
			expect(url.pathname).toBe('/api/db/my%20db/stats')
		})
	})

	describe('dropDb', () => {
		it('calls DELETE /api/db/{name}', async () => {
			await api.dropDb('mydb')
			const url = fetchedURL(fetchFn)
			expect(url.pathname).toBe('/api/db/mydb')
			expect(fetchedInit(fetchFn).method).toBe('DELETE')
		})
	})

	describe('listCollections', () => {
		it('calls GET /api/collection?db=testdb', async () => {
			await api.listCollections()
			const url = fetchedURL(fetchFn)
			expect(url.pathname).toBe('/api/collection')
			expect(url.searchParams.get('db')).toBe('testdb')
			expect(fetchedInit(fetchFn).method).toBe('GET')
		})
	})

	describe('createCollection', () => {
		it('calls POST /api/collection/{name}?db=testdb', async () => {
			await api.createCollection('users')
			const url = fetchedURL(fetchFn)
			expect(url.pathname).toBe('/api/collection/users')
			expect(url.searchParams.get('db')).toBe('testdb')
			expect(fetchedInit(fetchFn).method).toBe('POST')
		})
	})

	describe('dropCollection', () => {
		it('calls DELETE /api/collection/{name}?db=testdb', async () => {
			await api.dropCollection('users')
			const url = fetchedURL(fetchFn)
			expect(url.pathname).toBe('/api/collection/users')
			expect(url.searchParams.get('db')).toBe('testdb')
			expect(fetchedInit(fetchFn).method).toBe('DELETE')
		})
	})

	describe('collectionStats', () => {
		it('calls GET /api/collection/{name}/stats?db=testdb', async () => {
			await api.collectionStats('users')
			const url = fetchedURL(fetchFn)
			expect(url.pathname).toBe('/api/collection/users/stats')
			expect(url.searchParams.get('db')).toBe('testdb')
		})
	})

	describe('listDocuments', () => {
		it('calls GET with db param', async () => {
			await api.listDocuments('users')
			const url = fetchedURL(fetchFn)
			expect(url.pathname).toBe('/api/collection/users/documents')
			expect(url.searchParams.get('db')).toBe('testdb')
		})

		it('includes filter, limit, skip query params when provided', async () => {
			await api.listDocuments('users', { filter: '{"x":1}', limit: 10, skip: 5 })
			const url = fetchedURL(fetchFn)
			expect(url.searchParams.get('filter')).toBe('{"x":1}')
			expect(url.searchParams.get('limit')).toBe('10')
			expect(url.searchParams.get('skip')).toBe('5')
		})

		it('omits filter/limit/skip when not provided', async () => {
			await api.listDocuments('users')
			const url = fetchedURL(fetchFn)
			expect(url.searchParams.has('filter')).toBe(false)
			expect(url.searchParams.has('limit')).toBe(false)
			expect(url.searchParams.has('skip')).toBe(false)
		})
	})

	describe('insertDocument', () => {
		it('calls POST with JSON body', async () => {
			await api.insertDocument('users', { name: 'Alice' })
			const url = fetchedURL(fetchFn)
			expect(url.pathname).toBe('/api/collection/users/documents')
			expect(fetchedInit(fetchFn).method).toBe('POST')
			expect(fetchedInit(fetchFn).body).toBe(JSON.stringify({ name: 'Alice' }))
		})

		it('sets Content-Type: application/json header', async () => {
			await api.insertDocument('users', { a: 1 })
			const headers = fetchedInit(fetchFn).headers as Record<string, string>
			expect(headers['Content-Type']).toBe('application/json')
		})
	})

	describe('getDocument', () => {
		it('calls GET /api/collection/{name}/documents/{id}?db=testdb', async () => {
			await api.getDocument('users', 'abc123')
			const url = fetchedURL(fetchFn)
			expect(url.pathname).toBe('/api/collection/users/documents/abc123')
			expect(url.searchParams.get('db')).toBe('testdb')
		})

		it('URL-encodes the document ID', async () => {
			await api.getDocument('users', 'id with spaces')
			const url = fetchedURL(fetchFn)
			expect(url.pathname).toContain('id%20with%20spaces')
		})
	})

	describe('updateDocument', () => {
		it('calls PATCH on /documents/single with body', async () => {
			await api.updateDocument('users', { name: 'Bob' })
			const url = fetchedURL(fetchFn)
			expect(url.pathname).toBe('/api/collection/users/documents/single')
			expect(fetchedInit(fetchFn).method).toBe('PATCH')
			expect(fetchedInit(fetchFn).body).toBe(JSON.stringify({ name: 'Bob' }))
		})

		it('includes filter query param when provided', async () => {
			await api.updateDocument('users', { name: 'Bob' }, '{"_id":"1"}')
			const url = fetchedURL(fetchFn)
			expect(url.searchParams.get('filter')).toBe('{"_id":"1"}')
		})
	})

	describe('updateDocuments', () => {
		it('calls PATCH on /documents with body', async () => {
			await api.updateDocuments('users', { active: true })
			const url = fetchedURL(fetchFn)
			expect(url.pathname).toBe('/api/collection/users/documents')
			expect(fetchedInit(fetchFn).method).toBe('PATCH')
		})

		it('includes filter query param when provided', async () => {
			await api.updateDocuments('users', { active: true }, '{"role":"admin"}')
			const url = fetchedURL(fetchFn)
			expect(url.searchParams.get('filter')).toBe('{"role":"admin"}')
		})
	})

	describe('deleteDocument', () => {
		it('calls DELETE /api/collection/{name}/documents/{id}?db=testdb', async () => {
			await api.deleteDocument('users', 'abc123')
			const url = fetchedURL(fetchFn)
			expect(url.pathname).toBe('/api/collection/users/documents/abc123')
			expect(url.searchParams.get('db')).toBe('testdb')
			expect(fetchedInit(fetchFn).method).toBe('DELETE')
		})
	})

	describe('createDbWithCollection', () => {
		it('calls POST /api/collection/{collName}?db={dbName}', async () => {
			await api.createDbWithCollection('newdb', 'firstColl')
			const url = fetchedURL(fetchFn)
			expect(url.pathname).toBe('/api/collection/firstColl')
			expect(url.searchParams.get('db')).toBe('newdb')
			expect(fetchedInit(fetchFn).method).toBe('POST')
		})

		it('does not use requireDb (works regardless of currentDb)', async () => {
			useCurrentDb().value = ''
			await expect(api.createDbWithCollection('newdb', 'coll')).resolves.not.toThrow()
		})
	})

	describe('error handling', () => {
		it('throws error with "status statusText" for non-ok response', async () => {
			fetchFn = mockFetch('', 404, 'Not Found')
			vi.stubGlobal('fetch', fetchFn)
			api = useMongoApi()
			await expect(api.listDbs()).rejects.toThrow('404 Not Found')
		})

		it('returns undefined for empty response body', async () => {
			fetchFn = mockFetch('')
			vi.stubGlobal('fetch', fetchFn)
			api = useMongoApi()
			const result = await api.listDbs()
			expect(result).toBeUndefined()
		})

		it('parses JSON from response text', async () => {
			fetchFn = mockFetch({ result: true })
			vi.stubGlobal('fetch', fetchFn)
			api = useMongoApi()
			const result = await api.listDbs()
			expect(result).toEqual({ result: true })
		})
	})
})
