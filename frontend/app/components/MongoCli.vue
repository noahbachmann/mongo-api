<script setup lang="ts">
	type Command =
		| { kind: 'show-dbs' }
		| { kind: 'show-collections' }
		| { kind: 'create-db'; dbName: string; firstCollection: string }
		| { kind: 'drop-db'; dbName: string }
		| { kind: 'create-collection'; name: string }
		| { kind: 'drop-collection'; collection: string }
		| { kind: 'show-documents'; collection: string }
		| { kind: 'insert-document'; collection: string }
		| { kind: 'update-document'; collection: string; id: string }
		| { kind: 'delete-document'; collection: string; id: string }

	type DocItem = { id: string | null; json: string }

	type HistoryEntry = {
		cmd: string
		output: string
		error?: boolean
		documents?: { collection: string; items: DocItem[] }
	}

	const api = useMongoApi()
	const currentDb = useCurrentDb()

	const dbs = ref<string[]>([])
	const collections = ref<string[]>([])
	const command = ref<Command | null>(null)
	const history = ref<HistoryEntry[]>([])
	const running = ref(false)
	const terminalEl = ref<HTMLElement | null>(null)
	const jsonInputEl = ref<HTMLTextAreaElement | null>(null)

	// per-control input state
	const newDbName = ref('')
	const newDbFirstCollection = ref('')
	const dropDbTarget = ref('')
	const newCollectionName = ref('')
	const dropCollectionTarget = ref('')
	const docsCollection = ref('')
	const docsFilter = ref('')
	const docsLimit = ref(50)
	const docsSkip = ref(0)
	const jsonInput = ref('')

	function normalizeNames(data: unknown): string[] {
		if (!Array.isArray(data)) return []
		return data
			.map((item) => {
				if (typeof item === 'string') return item
				if (item && typeof item === 'object' && 'name' in item) return String((item as { name: unknown }).name)
				return String(item)
			})
			.filter(Boolean)
	}

	function extractId(item: unknown): string | null {
		if (!item || typeof item !== 'object') return null
		const obj = item as Record<string, unknown>
		const raw = obj._id ?? obj.id
		if (typeof raw === 'string') return raw
		if (raw && typeof raw === 'object' && '$oid' in raw) return String((raw as { $oid: unknown }).$oid)
		if (raw != null) return String(raw)
		return null
	}

	function normalizeDocuments(data: unknown): DocItem[] {
		let arr = data
		if (data && typeof data === 'object' && 'documents' in data) {
			arr = (data as { documents: unknown }).documents
		}
		if (!Array.isArray(arr)) return []
		return arr.map((item) => {
			const parsed = typeof item === 'string' ? JSON.parse(item) : item
			return { id: extractId(parsed), json: safeStringify(parsed) }
		})
	}

	function safeStringify(v: unknown): string {
		try {
			return JSON.stringify(v, null, 2)
		} catch {
			return String(v)
		}
	}

	function formatOutput(data: unknown): string {
		if (data === undefined || data === null || data === '') return '(no content)'
		return safeStringify(data)
	}

	function snippet(s: string, max = 60): string {
		const flat = s.replace(/\s+/g, ' ').trim()
		if (!flat) return '<json>'
		return flat.length > max ? flat.slice(0, max - 1) + '…' : flat
	}

	const dangerKinds = new Set<Command['kind']>(['drop-db', 'drop-collection', 'delete-document'])
	const isDangerCommand = computed(() => Boolean(command.value && dangerKinds.has(command.value.kind)))

	const commandPreview = computed(() => {
		const c = command.value
		if (!c) return ''
		const dbPart = currentDb.value || '<db>'
		switch (c.kind) {
			case 'show-dbs':
				return 'show dbs'
			case 'show-collections':
				return `show collections${currentDb.value ? ` --db=${currentDb.value}` : ''}`
			case 'create-db':
				return `use ${c.dbName}; db.createCollection("${c.firstCollection}")`
			case 'drop-db':
				return `use ${c.dbName}; db.dropDatabase()`
			case 'create-collection':
				return `db.createCollection("${c.name}")`
			case 'drop-collection':
				return `db.dropCollection("${c.collection}")`
			case 'show-documents':
				return `db.${c.collection}.find(${docsFilter.value || '{}'}).skip(${docsSkip.value}).limit(${docsLimit.value})`
			case 'insert-document':
				return `db.${c.collection}.insertOne(${snippet(jsonInput.value)})`
			case 'update-document':
				return `db.${c.collection}.updateOne({_id: "${c.id}"}, ${snippet(jsonInput.value)})`
			case 'delete-document':
				return `db.${c.collection}.deleteOne({_id: "${c.id}"})`
		}
	})

	const canSubmit = computed(() => {
		const c = command.value
		if (!c) return false
		if (c.kind === 'show-dbs') return true
		if (c.kind === 'create-db') return Boolean(c.dbName && c.firstCollection)
		if (c.kind === 'drop-db') return Boolean(c.dbName)
		if (!currentDb.value) return false
		if (c.kind === 'insert-document' || c.kind === 'update-document') return jsonInput.value.trim().length > 0
		return true
	})

	function parseJsonInput(): { ok: true; value: unknown } | { ok: false; error: string } {
		try {
			return { ok: true, value: JSON.parse(jsonInput.value) }
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err.message : String(err) }
		}
	}

	async function refreshDbs() {
		try {
			dbs.value = normalizeNames(await api.listDbs())
		} catch {
			dbs.value = []
		}
	}

	async function refreshCollections() {
		if (!currentDb.value) {
			collections.value = []
			docsCollection.value = ''
			dropCollectionTarget.value = ''
			return
		}
		try {
			collections.value = normalizeNames(await api.listCollections())
			if (docsCollection.value && !collections.value.includes(docsCollection.value)) docsCollection.value = ''
			if (dropCollectionTarget.value && !collections.value.includes(dropCollectionTarget.value))
				dropCollectionTarget.value = ''
		} catch {
			collections.value = []
		}
	}

	async function loadDocsInto(collection: string, entry: HistoryEntry) {
		const docs = await api.listDocuments(collection, {
			filter: docsFilter.value || undefined,
			limit: docsLimit.value,
			skip: docsSkip.value,
		})
		entry.output = formatOutput(docs)
		entry.documents = { collection, items: normalizeDocuments(docs) }
	}

	async function appendDocsRefresh(collection: string) {
		const refreshEntry: HistoryEntry = {
			cmd: `db.${currentDb.value}.${collection}.find() // refreshed`,
			output: '…',
		}
		history.value.push(refreshEntry)
		try {
			await loadDocsInto(collection, refreshEntry)
		} catch (err) {
			refreshEntry.output = err instanceof Error ? err.message : String(err)
			refreshEntry.error = true
		}
		await nextTick()
		scrollToBottom()
	}

	function stage(c: Command) {
		command.value = c
		if (c.kind !== 'drop-collection') dropCollectionTarget.value = ''
		if (c.kind !== 'drop-db') dropDbTarget.value = ''
	}

	function stageCreateDb() {
		if (!newDbName.value || !newDbFirstCollection.value) return
		stage({ kind: 'create-db', dbName: newDbName.value, firstCollection: newDbFirstCollection.value })
	}
	function stageCreateCollection() {
		if (!newCollectionName.value) return
		stage({ kind: 'create-collection', name: newCollectionName.value })
	}
	function stageShowDocuments() {
		if (!docsCollection.value) return
		stage({ kind: 'show-documents', collection: docsCollection.value })
	}
	function stageInsertDocument() {
		if (!docsCollection.value || !jsonInput.value.trim()) return
		stage({ kind: 'insert-document', collection: docsCollection.value })
	}
	function onPickDropDb() {
		if (dropDbTarget.value) command.value = { kind: 'drop-db', dbName: dropDbTarget.value }
	}
	function onPickDropCollection() {
		if (dropCollectionTarget.value)
			command.value = { kind: 'drop-collection', collection: dropCollectionTarget.value }
	}

	function onEditDoc(collection: string, doc: DocItem) {
		if (!doc.id) return
		jsonInput.value = doc.json
		stage({ kind: 'update-document', collection, id: doc.id })
		nextTick(() => jsonInputEl.value?.focus())
	}
	function onDeleteDoc(collection: string, doc: DocItem) {
		if (!doc.id) return
		stage({ kind: 'delete-document', collection, id: doc.id })
	}

	async function submit() {
		if (!canSubmit.value || running.value || !command.value) return
		const c = command.value
		const cmd = commandPreview.value
		running.value = true

		const entry: HistoryEntry = { cmd, output: '…' }
		history.value.push(entry)
		// keep insert/update kinds non-cleared so jsonInput stays meaningful until submit succeeds
		const clearAfter = c.kind !== 'insert-document' && c.kind !== 'update-document'
		command.value = null
		dropDbTarget.value = ''
		dropCollectionTarget.value = ''
		await nextTick()
		scrollToBottom()

		try {
			let result: unknown = undefined
			let postRefreshDocs: string | null = null

			switch (c.kind) {
				case 'show-dbs':
					result = await api.listDbs()
					dbs.value = normalizeNames(result)
					break
				case 'show-collections':
					result = await api.listCollections()
					collections.value = normalizeNames(result)
					break
				case 'create-db':
					result = await api.createDbWithCollection(c.dbName, c.firstCollection)
					await refreshDbs()
					currentDb.value = c.dbName
					newDbName.value = ''
					newDbFirstCollection.value = ''
					break
				case 'drop-db':
					result = await api.dropDb(c.dbName)
					if (currentDb.value === c.dbName) currentDb.value = ''
					await refreshDbs()
					break
				case 'create-collection':
					result = await api.createCollection(c.name)
					await refreshCollections()
					newCollectionName.value = ''
					break
				case 'drop-collection':
					result = await api.dropCollection(c.collection)
					await refreshCollections()
					break
				case 'show-documents':
					await loadDocsInto(c.collection, entry)
					result = entry.documents?.items ?? []
					break
				case 'insert-document': {
					const parsed = parseJsonInput()
					if (!parsed.ok) throw new Error(`Invalid JSON: ${parsed.error}`)
					result = await api.insertDocument(c.collection, parsed.value)
					jsonInput.value = ''
					postRefreshDocs = c.collection
					break
				}
				case 'update-document': {
					const parsed = parseJsonInput()
					if (!parsed.ok) throw new Error(`Invalid JSON: ${parsed.error}`)
					result = await api.updateDocument(c.collection, c.id, parsed.value)
					jsonInput.value = ''
					postRefreshDocs = c.collection
					break
				}
				case 'delete-document':
					result = await api.deleteDocument(c.collection, c.id)
					postRefreshDocs = c.collection
					break
			}

			if (!entry.documents) entry.output = formatOutput(result)
			if (postRefreshDocs) await appendDocsRefresh(postRefreshDocs)
		} catch (err: unknown) {
			entry.output = err instanceof Error ? err.message : String(err)
			entry.error = true
			if (!clearAfter) {
				// restore the staged command on failure so the user can fix and retry
				command.value = c
			}
		} finally {
			running.value = false
			await nextTick()
			scrollToBottom()
		}
	}

	function scrollToBottom() {
		const el = terminalEl.value
		if (el) el.scrollTop = el.scrollHeight
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canSubmit.value && !running.value) {
			e.preventDefault()
			submit()
		} else if (e.key === 'Escape' && command.value) {
			command.value = null
			dropDbTarget.value = ''
			dropCollectionTarget.value = ''
		}
	}

	watch(currentDb, () => {
		const c = command.value
		if (c && c.kind !== 'show-dbs' && c.kind !== 'create-db' && c.kind !== 'drop-db') {
			command.value = null
		}
		refreshCollections()
	})

	onMounted(() => {
		refreshDbs()
		if (currentDb.value) refreshCollections()
		window.addEventListener('keydown', onKeydown)
	})

	onBeforeUnmount(() => {
		window.removeEventListener('keydown', onKeydown)
	})
</script>

<template>
	<div class="min-h-screen bg-surface flex items-center justify-center p-0 sm:p-12 md:p-24">
		<div
			class="w-full max-w-4xl sm:rounded-md border border-secondary/15 bg-secondary text-surface font-mono shadow-lg overflow-hidden">
			<!-- header / db selector -->
			<div class="flex items-center justify-between px-16 py-10 bg-primary/30 border-b border-surface/10 text-sm">
				<div class="flex items-center gap-8">
					<span class="size-10 rounded-full bg-accent/80" />
					<span class="size-10 rounded-full bg-bright-primary/70" />
					<span class="text-surface/60 ml-8">mongo-cli</span>
				</div>
				<label class="flex items-center gap-8">
					<span class="text-surface/60">current database:</span>
					<select
						v-model="currentDb"
						class="input-cli">
						<option value="">— select —</option>
						<option
							v-for="d in dbs"
							:key="d"
							:value="d">
							{{ d }}
						</option>
					</select>
				</label>
			</div>

			<!-- terminal body -->
			<div
				ref="terminalEl"
				class="px-16 py-16 h-400 overflow-y-auto text-sm leading-relaxed">
				<div
					v-if="!history.length && !commandPreview"
					class="text-surface/40">
					Pick a command below, then press submit.
				</div>

				<div
					v-for="(entry, i) in history"
					:key="i"
					class="mb-12">
					<div class="text-bright-primary">$ {{ entry.cmd }}</div>
					<pre
						v-if="!entry.documents"
						class="whitespace-pre-wrap wrap-break-word mt-2"
						:class="entry.error ? 'text-accent' : 'text-surface/90'"
						>{{ entry.output }}</pre
					>
					<div
						v-else
						class="mt-4 flex flex-col gap-6">
						<div
							v-if="!entry.documents.items.length"
							class="text-surface/50 italic">
							(no documents)
						</div>
						<div
							v-for="(doc, j) in entry.documents.items"
							:key="doc.id ?? j"
							class="border border-surface/10 rounded-sm p-8">
							<div class="flex justify-between items-center mb-4 gap-8">
								<span class="text-surface/50 text-xs truncate">_id: {{ doc.id ?? '(missing)' }}</span>
								<div class="flex gap-4 shrink-0">
									<button
										type="button"
										class="btn-inline"
										:disabled="!doc.id"
										@click="onEditDoc(entry.documents!.collection, doc)">
										edit
									</button>
									<button
										type="button"
										class="btn-inline"
										:disabled="!doc.id"
										@click="onDeleteDoc(entry.documents!.collection, doc)">
										del
									</button>
								</div>
							</div>
							<pre class="text-surface/80 text-xs whitespace-pre-wrap wrap-break-word">{{ doc.json }}</pre>
						</div>
					</div>
				</div>

				<div
					v-if="commandPreview"
					class="text-bright-primary">
					$ {{ commandPreview }}<span class="inline-block animate-pulse ml-2">▌</span>
				</div>
			</div>

			<!-- command bar -->
			<div class="px-16 py-12 bg-primary/15 border-t border-surface/10 flex flex-col gap-10">
				<!-- DB row -->
				<div class="flex flex-wrap items-center gap-8">
					<span class="text-surface/40 text-xs uppercase tracking-wide w-80">db</span>

					<button
						type="button"
						class="btn btn-cmd"
						@click="stage({ kind: 'show-dbs' })">
						show dbs
					</button>

					<div class="flex items-center gap-4 px-8 py-4 rounded-sm border border-surface/20">
						<span class="text-surface/70 text-sm">create</span>
						<input
							v-model="newDbName"
							placeholder="db name"
							class="input-cli w-100"
							@keydown.enter.prevent="stageCreateDb" />
						<input
							v-model="newDbFirstCollection"
							placeholder="first collection"
							class="input-cli w-100"
							@keydown.enter.prevent="stageCreateDb" />
						<button
							type="button"
							class="btn btn-cmd"
							:disabled="!newDbName || !newDbFirstCollection"
							@click="stageCreateDb">
							stage
						</button>
					</div>

					<div class="flex items-center gap-4 px-8 py-4 rounded-sm border border-surface/20">
						<span class="text-surface/70 text-sm">drop</span>
						<select
							v-model="dropDbTarget"
							class="input-cli"
							@change="onPickDropDb">
							<option value="">— pick —</option>
							<option
								v-for="d in dbs"
								:key="d"
								:value="d">
								{{ d }}
							</option>
						</select>
					</div>
				</div>

				<!-- COLLECTION row -->
				<div
					class="flex flex-wrap items-center gap-8"
					:class="!currentDb ? 'opacity-50' : ''">
					<span class="text-surface/40 text-xs uppercase tracking-wide w-80">collection</span>

					<button
						type="button"
						class="btn btn-cmd"
						:disabled="!currentDb"
						:title="!currentDb ? 'select a db first' : ''"
						@click="stage({ kind: 'show-collections' })">
						show collections
					</button>

					<div class="flex items-center gap-4 px-8 py-4 rounded-sm border border-surface/20">
						<span class="text-surface/70 text-sm">create</span>
						<input
							v-model="newCollectionName"
							:disabled="!currentDb"
							placeholder="collection name"
							class="input-cli w-140"
							@keydown.enter.prevent="stageCreateCollection" />
						<button
							type="button"
							class="btn btn-cmd"
							:disabled="!currentDb || !newCollectionName"
							@click="stageCreateCollection">
							stage
						</button>
					</div>

					<div class="flex items-center gap-4 px-8 py-4 rounded-sm border border-surface/20">
						<span class="text-surface/70 text-sm">drop</span>
						<select
							v-model="dropCollectionTarget"
							:disabled="!currentDb"
							class="input-cli"
							@change="onPickDropCollection">
							<option value="">— pick —</option>
							<option
								v-for="c in collections"
								:key="c"
								:value="c">
								{{ c }}
							</option>
						</select>
					</div>
				</div>

				<!-- DOCUMENT row -->
				<div
					class="flex flex-wrap items-center gap-8"
					:class="!currentDb ? 'opacity-50' : ''">
					<span class="text-surface/40 text-xs uppercase tracking-wide w-80">doc</span>

					<div class="flex items-center gap-4 px-8 py-4 rounded-sm border border-surface/20">
						<span class="text-surface/70 text-sm">collection</span>
						<select
							v-model="docsCollection"
							:disabled="!currentDb || !collections.length"
							class="input-cli">
							<option value="">— pick —</option>
							<option
								v-for="c in collections"
								:key="c"
								:value="c">
								{{ c }}
							</option>
						</select>
					</div>

					<div class="flex items-center gap-4 px-8 py-4 rounded-sm border border-surface/20">
						<span class="text-surface/70 text-sm">show</span>
						<input
							v-model="docsFilter"
							placeholder="filter (optional, JSON)"
							class="input-cli w-180" />
						<input
							v-model.number="docsLimit"
							type="number"
							min="1"
							class="input-cli w-60" />
						<input
							v-model.number="docsSkip"
							type="number"
							min="0"
							class="input-cli w-60" />
						<button
							type="button"
							class="btn btn-cmd"
							:disabled="!currentDb || !docsCollection"
							@click="stageShowDocuments">
							stage
						</button>
					</div>

					<button
						type="button"
						class="btn btn-cmd"
						:disabled="!currentDb || !docsCollection || !jsonInput.trim()"
						@click="stageInsertDocument">
						insert (uses JSON below)
					</button>
				</div>

				<!-- JSON textarea + submit -->
				<div class="flex items-stretch gap-8">
					<textarea
						ref="jsonInputEl"
						v-model="jsonInput"
						rows="3"
						placeholder='document JSON — e.g. {"name": "alpha"}'
						class="flex-1 bg-secondary text-surface border border-surface/20 rounded-sm px-8 py-6 text-xs font-mono focus:outline-none focus:border-bright-primary" />

					<button
						type="button"
						class="btn"
						:class="isDangerCommand ? 'btn-danger' : 'btn-submit'"
						:disabled="!canSubmit || running"
						@click="submit">
						{{ running ? 'running…' : 'submit' }}
					</button>
				</div>
			</div>
		</div>
	</div>
</template>

