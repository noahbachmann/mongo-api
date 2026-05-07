import { stringifyNames } from '../../src/utils/stringifyNames'

describe('stringifyNames', () => {
	describe('non-array input', () => {
		it('returns [] for undefined', () => {
			expect(stringifyNames(undefined)).toEqual([])
		})

		it('returns [] for null', () => {
			expect(stringifyNames(null)).toEqual([])
		})

		it('returns [] for a number', () => {
			expect(stringifyNames(42)).toEqual([])
		})

		it('returns [] for a string', () => {
			expect(stringifyNames('hello')).toEqual([])
		})

		it('returns [] for a plain object', () => {
			expect(stringifyNames({ name: 'test' })).toEqual([])
		})
	})

	describe('array of strings', () => {
		it('passes through string items as-is', () => {
			expect(stringifyNames(['alpha', 'beta'])).toEqual(['alpha', 'beta'])
		})

		it('filters out empty strings', () => {
			expect(stringifyNames(['a', '', 'b'])).toEqual(['a', 'b'])
		})
	})

	describe('array of objects with name property', () => {
		it('extracts .name from objects', () => {
			expect(stringifyNames([{ name: 'db1' }, { name: 'db2' }])).toEqual(['db1', 'db2'])
		})

		it('handles .name that is a number (converts via String())', () => {
			expect(stringifyNames([{ name: 123 }])).toEqual(['123'])
		})
	})

	describe('array of other types', () => {
		it('converts numbers to strings via String()', () => {
			expect(stringifyNames([1, 2, 3])).toEqual(['1', '2', '3'])
		})

		it('converts booleans to strings via String()', () => {
			expect(stringifyNames([true, false])).toEqual(['true', 'false'])
		})
	})

	describe('mixed arrays', () => {
		it('handles a mix of strings, objects-with-name, and primitives', () => {
			expect(stringifyNames(['raw', { name: 'obj' }, 99])).toEqual(['raw', 'obj', '99'])
		})
	})
})
