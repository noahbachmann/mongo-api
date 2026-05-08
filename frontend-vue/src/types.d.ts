type HistoryEntry = {
	cmd: string
	output: string
	error?: boolean
	documents?: { collection: string; items: string[] }
}

type CommandKind =
	| 'show-dbs'
	| 'show-collections'
	| 'create-db'
	| 'drop-db'
	| 'create-collection'
	| 'drop-collection'
	| 'show-documents'
	| 'insert-document'
	| 'update-document'
	| 'update-documents'
	| 'delete-document'
	| 'delete-documents'

type Command = {
	kind: CommandKind
	db?: string
	collection?: string
	id?: string
	filter?: string
	body?: string
	limit?: number
	skip?: number
	afterSuccess?: () => void
}
