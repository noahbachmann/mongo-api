export function buildJsonFromPairs(pairs: Array<{ key: string; value: string }>): string {
	const obj: Record<string, unknown> = {}
	for (const { key, value } of pairs) {
		if (!key.trim()) continue
		const trimmed = value.trim()
		try {
			obj[key.trim()] = JSON.parse(trimmed)
		} catch {
			obj[key.trim()] = trimmed
		}
	}
	return JSON.stringify(obj)
}
