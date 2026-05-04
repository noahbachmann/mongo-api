export function useCurrentDb() {
	return useState<string>('currentDb', () => '')
}
