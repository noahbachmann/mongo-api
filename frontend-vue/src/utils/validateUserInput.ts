export function validateUserInput(input: string): string {
	try {
		JSON.parse(input)
		return input
	} catch (err) {
		throw new Error(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`)
	}
}
