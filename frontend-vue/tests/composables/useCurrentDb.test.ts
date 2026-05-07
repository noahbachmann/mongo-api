import { isRef } from 'vue'

describe('useCurrentDb', () => {
	beforeEach(() => {
		vi.resetModules()
	})

	async function loadUseCurrentDb() {
		const mod = await import('../../src/composables/useCurrentDb')
		return mod.useCurrentDb
	}

	it('returns a Vue ref', async () => {
		const useCurrentDb = await loadUseCurrentDb()
		expect(isRef(useCurrentDb())).toBe(true)
	})

	it('has default value "project"', async () => {
		const useCurrentDb = await loadUseCurrentDb()
		expect(useCurrentDb().value).toBe('project')
	})

	it('is a singleton (same ref returned on multiple calls)', async () => {
		const useCurrentDb = await loadUseCurrentDb()
		const a = useCurrentDb()
		const b = useCurrentDb()
		expect(a).toBe(b)
		a.value = 'other'
		expect(b.value).toBe('other')
	})

	it('value can be changed', async () => {
		const useCurrentDb = await loadUseCurrentDb()
		const db = useCurrentDb()
		db.value = 'testdb'
		expect(db.value).toBe('testdb')
	})
})
