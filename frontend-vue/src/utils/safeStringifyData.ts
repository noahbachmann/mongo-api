export function safeStringifyData(data: unknown): string {
	if (data === undefined || data === null || data === '') return '(no content)'
	try {
		return JSON.stringify(data, null, 2)
	} catch {
		return String(data)
	}
}
