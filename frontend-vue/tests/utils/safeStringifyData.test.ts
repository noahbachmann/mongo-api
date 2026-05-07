import { safeStringifyData } from '../../src/utils/safeStringifyData'

describe('safeStringifyData', () => {
	it('returns "(no content)" for undefined', () => {
		expect(safeStringifyData(undefined)).toBe('(no content)')
	})

	it('returns "(no content)" for null', () => {
		expect(safeStringifyData(null)).toBe('(no content)')
	})

	it('returns "(no content)" for empty string', () => {
		expect(safeStringifyData('')).toBe('(no content)')
	})

	it('JSON-stringifies a plain object with 2-space indent', () => {
		expect(safeStringifyData({ a: 1 })).toBe(JSON.stringify({ a: 1 }, null, 2))
	})

	it('JSON-stringifies an array with 2-space indent', () => {
		expect(safeStringifyData([1, 2, 3])).toBe(JSON.stringify([1, 2, 3], null, 2))
	})

	it('JSON-stringifies a number', () => {
		expect(safeStringifyData(42)).toBe('42')
	})

	it('JSON-stringifies a boolean', () => {
		expect(safeStringifyData(true)).toBe('true')
	})

	it('JSON-stringifies a string (wraps in quotes)', () => {
		expect(safeStringifyData('hello')).toBe('"hello"')
	})

	it('stringifies nested objects', () => {
		const data = { a: { b: { c: 1 } } }
		expect(safeStringifyData(data)).toBe(JSON.stringify(data, null, 2))
	})

	it('falls back to String(data) when JSON.stringify throws', () => {
		const circular: Record<string, unknown> = {}
		circular.self = circular
		expect(safeStringifyData(circular)).toBe(String(circular))
	})
})
