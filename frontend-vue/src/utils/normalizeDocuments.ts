import { safeStringifyData } from './safeStringifyData'

export function normalizeDocuments(data: unknown): string[] {
	let arr = data
	if (data && typeof data === 'object' && 'documents' in data) {
		arr = (data as { documents: unknown }).documents
	}
	if (!Array.isArray(arr)) return []
	return arr.map((item) => {
		const parsed = typeof item === 'string' ? JSON.parse(item) : item
		return safeStringifyData(parsed)
	})
}
