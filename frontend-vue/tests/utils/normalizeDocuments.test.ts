import { normalizeDocuments } from '../../src/utils/normalizeDocuments'

describe('normalizeDocuments', () => {
	describe('unwrapping .documents property', () => {
		it('unwraps data.documents when present', () => {
			const result = normalizeDocuments({ documents: [{ _id: '1', name: 'a' }] })
			expect(result).toEqual([JSON.stringify({ _id: '1', name: 'a' }, null, 2)])
		})

		it('uses data directly when no .documents property', () => {
			const result = normalizeDocuments([{ _id: '1' }])
			expect(result).toEqual([JSON.stringify({ _id: '1' }, null, 2)])
		})
	})

	describe('non-array input', () => {
		it('returns [] when unwrapped value is not an array', () => {
			expect(normalizeDocuments({ documents: 'not-an-array' })).toEqual([])
		})

		it('returns [] for null', () => {
			expect(normalizeDocuments(null)).toEqual([])
		})

		it('returns [] for undefined', () => {
			expect(normalizeDocuments(undefined)).toEqual([])
		})
	})

	describe('array of objects', () => {
		it('stringifies each object item via safeStringifyData', () => {
			const result = normalizeDocuments([{ a: 1 }, { b: 2 }])
			expect(result).toEqual([
				JSON.stringify({ a: 1 }, null, 2),
				JSON.stringify({ b: 2 }, null, 2),
			])
		})
	})

	describe('array of JSON strings', () => {
		it('parses string items via JSON.parse, then re-stringifies', () => {
			const result = normalizeDocuments(['{"x":1}'])
			expect(result).toEqual([JSON.stringify({ x: 1 }, null, 2)])
		})

		it('returns "(no content)" for items that parse to null', () => {
			const result = normalizeDocuments(['null'])
			expect(result).toEqual(['(no content)'])
		})
	})

	describe('error cases', () => {
		it('throws if a string item is not valid JSON', () => {
			expect(() => normalizeDocuments(['not valid json'])).toThrow()
		})
	})
})
