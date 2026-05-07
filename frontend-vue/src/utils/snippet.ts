export function snippet(s: string, max = 60): string {
	const flat = s.replace(/\s+/g, ' ').trim()
	if (!flat) return '<json>'
	return flat.length > max ? flat.slice(0, max - 1) + '…' : flat
}
