export function stringifyNames(data: unknown): string[] {
	if (!Array.isArray(data)) return []
	return data
		.map((item) => {
			if (typeof item === 'string') return item
			if (item && typeof item === 'object' && 'name' in item) return String((item as { name: unknown }).name)
			return String(item)
		})
		.filter(Boolean)
}
