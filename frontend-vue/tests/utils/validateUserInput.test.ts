import { validateUserInput } from '../../src/utils/validateUserInput'

describe('validateUserInput', () => {
	describe('valid JSON', () => {
		it('returns the input for a valid JSON object string', () => {
			const input = '{"name": "test"}'
			expect(validateUserInput(input)).toBe(input)
		})

		it('returns the input for a valid JSON array string', () => {
			const input = '[1, 2, 3]'
			expect(validateUserInput(input)).toBe(input)
		})

		it('returns the input for a valid JSON number string', () => {
			expect(validateUserInput('42')).toBe('42')
		})

		it('returns the input for a valid JSON string (quoted)', () => {
			expect(validateUserInput('"hello"')).toBe('"hello"')
		})

		it('returns the input for "null"', () => {
			expect(validateUserInput('null')).toBe('null')
		})

		it('returns the input for "true"', () => {
			expect(validateUserInput('true')).toBe('true')
		})

		it('preserves original formatting/whitespace of input', () => {
			const input = '{\n  "a":  1\n}'
			expect(validateUserInput(input)).toBe(input)
		})
	})

	describe('invalid JSON', () => {
		it('throws Error for malformed JSON', () => {
			expect(() => validateUserInput('{bad}')).toThrow(Error)
		})

		it('throws Error with message starting with "Invalid JSON:"', () => {
			expect(() => validateUserInput('{bad}')).toThrow(/^Invalid JSON:/)
		})

		it('throws Error for empty string', () => {
			expect(() => validateUserInput('')).toThrow(Error)
		})

		it('throws Error for unquoted string', () => {
			expect(() => validateUserInput('hello')).toThrow(Error)
		})

		it('throws Error for trailing comma in object', () => {
			expect(() => validateUserInput('{"a": 1,}')).toThrow(Error)
		})
	})
})
