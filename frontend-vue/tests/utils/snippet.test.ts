import { snippet } from '../../src/utils/snippet'

describe('snippet', () => {
	describe('whitespace collapsing', () => {
		it('collapses multiple spaces into one', () => {
			expect(snippet('a   b   c')).toBe('a b c')
		})

		it('collapses tabs and newlines into single spaces', () => {
			expect(snippet('a\t\nb')).toBe('a b')
		})

		it('trims leading and trailing whitespace', () => {
			expect(snippet('  hello  ')).toBe('hello')
		})
	})

	describe('empty/blank input', () => {
		it('returns "<json>" for empty string', () => {
			expect(snippet('')).toBe('<json>')
		})

		it('returns "<json>" for whitespace-only string', () => {
			expect(snippet('   \t\n  ')).toBe('<json>')
		})
	})

	describe('truncation with default max=60', () => {
		it('returns full string when length < 60', () => {
			const s = 'a'.repeat(50)
			expect(snippet(s)).toBe(s)
		})

		it('returns full string when length is exactly 60', () => {
			const s = 'a'.repeat(60)
			expect(snippet(s)).toBe(s)
		})

		it('truncates to 59 chars + … when length > 60', () => {
			const s = 'a'.repeat(61)
			expect(snippet(s)).toBe('a'.repeat(59) + '…')
		})
	})

	describe('custom max parameter', () => {
		it('truncates to max-1 chars + … for max=10', () => {
			const s = 'a'.repeat(20)
			expect(snippet(s, 10)).toBe('a'.repeat(9) + '…')
		})

		it('does not truncate when string fits within custom max', () => {
			expect(snippet('short', 10)).toBe('short')
		})
	})
})
