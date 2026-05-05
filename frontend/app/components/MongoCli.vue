<script setup lang="ts">
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

	type Command = { kind: CommandKind; db?: string; collection?: string; id?: string }

	type DocItem = { id: string | null; json: string }

	type HistoryEntry = {
		cmd: string
		output: string
		error?: boolean
		documents?: { collection: string; items: DocItem[] }
	}

	type Ctx = {
		cmd: Command
		currentDb: Ref<string>
		jsonInput: Ref<string>
		docsFilter: Ref<string>
		docsLimit: Ref<number>
		docsSkip: Ref<number>
	}

	type RunCtx = Ctx & {
		api: ReturnType<typeof useMongoApi>
		entry: HistoryEntry
		loadDocsInto: (col: string, e: HistoryEntry) => Promise<void>
	}

	type CommandSpec = {
		preview: (ctx: Ctx) => string
		run: (ctx: RunCtx) => Promise<unknown>
		needsCurrentDb?: boolean
		danger?: boolean
		validate?: (ctx: Ctx) => boolean
		refresh?: 'dbs' | 'collections' | 'docs'
		keepJsonOnSubmit?: boolean
		onSuccess?: (ctx: RunCtx) => void
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
	const newCollectionInput = ref('')
	const dropDbTarget = ref('')
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

	function parseJsonInput(): unknown {
		try {
			return JSON.parse(jsonInput.value)
		} catch (err) {
			throw new Error(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`)
		}
	}

	const commands: Record<CommandKind, CommandSpec> = {
		'show-dbs': {
			needsCurrentDb: false,
			preview: () => 'show dbs',
			run: ({ api }) => api.listDbs(),
			refresh: 'dbs',
		},
		'show-collections': {
			preview: ({ currentDb }) => `show collections${currentDb.value ? ` --db=${currentDb.value}` : ''}`,
			run: ({ api }) => api.listCollections(),
			refresh: 'collections',
		},
		'create-db': {
			needsCurrentDb: false,
			preview: ({ cmd }) => `use ${cmd.db}; db.createCollection("${cmd.collection}")`,
			run: ({ api, cmd }) => api.createDbWithCollection(cmd.db!, cmd.collection!),
			validate: ({ cmd }) => Boolean(cmd.db && cmd.collection),
			refresh: 'dbs',
			onSuccess: ({ cmd, currentDb }) => {
				currentDb.value = cmd.db!
				newDbName.value = ''
				newCollectionInput.value = ''
			},
		},
		'drop-db': {
			needsCurrentDb: false,
			danger: true,
			preview: ({ cmd }) => `use ${cmd.db}; db.dropDatabase()`,
			run: ({ api, cmd }) => api.dropDb(cmd.db!),
			validate: ({ cmd }) => Boolean(cmd.db),
			refresh: 'dbs',
			onSuccess: ({ cmd, currentDb }) => {
				if (currentDb.value === cmd.db) currentDb.value = ''
			},
		},
		'create-collection': {
			preview: ({ cmd }) => `db.createCollection("${cmd.collection}")`,
			run: ({ api, cmd }) => api.createCollection(cmd.collection!),
			refresh: 'collections',
			onSuccess: () => {
				newCollectionInput.value = ''
			},
		},
		'drop-collection': {
			danger: true,
			preview: ({ cmd }) => `db.dropCollection("${cmd.collection}")`,
			run: ({ api, cmd }) => api.dropCollection(cmd.collection!),
			refresh: 'collections',
		},
		'show-documents': {
			preview: ({ cmd, docsFilter, docsSkip, docsLimit }) =>
				`db.${cmd.collection}.find(${docsFilter.value || '{}'}).skip(${docsSkip.value}).limit(${docsLimit.value})`,
			run: async ({ cmd, entry, loadDocsInto }) => {
				await loadDocsInto(cmd.collection!, entry)
				return entry.documents?.items ?? []
			},
		},
		'insert-document': {
			preview: ({ cmd, jsonInput }) => `db.${cmd.collection}.insertOne(${snippet(jsonInput.value)})`,
			run: ({ api, cmd }) => api.insertDocument(cmd.collection!, parseJsonInput()),
			validate: ({ jsonInput }) => jsonInput.value.trim().length > 0,
			refresh: 'docs',
			keepJsonOnSubmit: true,
			onSuccess: () => {
				jsonInput.value = ''
			},
		},
		'update-document': {
			preview: ({ cmd, jsonInput }) =>
				`db.${cmd.collection}.updateOne({_id: "${cmd.id}"}, ${snippet(jsonInput.value)})`,
			run: ({ api, cmd }) => api.updateDocument(cmd.collection!, cmd.id!, parseJsonInput()),
			validate: ({ cmd, jsonInput }) => Boolean(cmd.id) && jsonInput.value.trim().length > 0,
			refresh: 'docs',
			keepJsonOnSubmit: true,
			onSuccess: () => {
				jsonInput.value = ''
			},
		},
		'update-documents': {
			preview: ({ cmd, docsFilter, jsonInput }) =>
				`db.${cmd.collection}.updateMany(${docsFilter.value || '{}'}, ${snippet(jsonInput.value)})`,
			run: ({ api, cmd, docsFilter }) => api.updateDocuments(cmd.collection!, docsFilter.value || undefined),
			validate: ({ cmd, jsonInput }) => Boolean(cmd.collection) && jsonInput.value.trim().length > 0,
			refresh: 'docs',
			keepJsonOnSubmit: true,
			onSuccess: () => {
				jsonInput.value = ''
			},
		},
		'delete-document': {
			danger: true,
			preview: ({ cmd }) => `db.${cmd.collection}.deleteOne({_id: "${cmd.id}"})`,
			run: ({ api, cmd }) => api.deleteDocument(cmd.collection!, cmd.id!),
			validate: ({ cmd }) => Boolean(cmd.collection && cmd.id),
			refresh: 'docs',
		},
	}

	function makeCtx(cmd: Command): Ctx {
		return { cmd, currentDb, jsonInput, docsFilter, docsLimit, docsSkip }
	}

	const commandPreview = computed(() => {
		const c = command.value
		return c ? commands[c.kind].preview(makeCtx(c)) : ''
	})

	const isDangerCommand = computed(() => Boolean(command.value && commands[command.value.kind].danger))

	const canSubmit = computed(() => {
		const c = command.value
		if (!c) return false
		const spec = commands[c.kind]
		if (spec.needsCurrentDb !== false && !currentDb.value) return false
		return spec.validate ? spec.validate(makeCtx(c)) : true
	})

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
		// Force reactivity update
		history.value = [...history.value]
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

	function stage(kind: CommandKind, extras: Omit<Command, 'kind'> = {}) {
		command.value = { kind, ...extras }
		if (kind !== 'drop-collection') dropCollectionTarget.value = ''
		if (kind !== 'drop-db') dropDbTarget.value = ''
	}

	function onEditDoc(collection: string, doc: DocItem) {
		if (!doc.id) return
		jsonInput.value = doc.json
		stage('update-document', { collection, id: doc.id })
		nextTick(() => jsonInputEl.value?.focus())
	}

	async function submit() {
		if (!canSubmit.value || running.value || !command.value) return
		const cmd = command.value
		const spec = commands[cmd.kind]
		const cmdPreview = commandPreview.value
		running.value = true

		const entry: HistoryEntry = { cmd: cmdPreview, output: '…' }
		history.value.push(entry)
		command.value = null
		dropDbTarget.value = ''
		dropCollectionTarget.value = ''
		await nextTick()
		scrollToBottom()

		try {
			const runCtx: RunCtx = { ...makeCtx(cmd), api, entry, loadDocsInto }
			const result = await spec.run(runCtx)
			if (!entry.documents) entry.output = formatOutput(result)
			spec.onSuccess?.(runCtx)
			if (spec.refresh === 'dbs') await refreshDbs()
			if (spec.refresh === 'collections') await refreshCollections()
			if (spec.refresh === 'docs') await appendDocsRefresh(cmd.collection!)
		} catch (err: unknown) {
			entry.output = err instanceof Error ? err.message : String(err)
			entry.error = true
			if (spec.keepJsonOnSubmit) command.value = cmd
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
		const target = e.target as HTMLElement
		const isInForm = target?.matches('input, textarea, select')

		if (e.key === 'Enter') {
			// If in a form field, let the field's @keydown.enter handle it (stage)
			// If NOT in a form field, submit the staged command
			if (canSubmit.value && !running.value && (!isInForm || e.metaKey || e.ctrlKey)) {
				e.preventDefault()
				submit()
			}
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
	<div class="min-h-screen bg-gray-700 flex items-center justify-center p-0 sm:p-12 md:p-24">
		<div
			class="w-full max-w-4xl sm:rounded-md border border-secondary/15 bg-secondary text-surface font-mono shadow-lg overflow-hidden">
			<!-- header / db selector -->
			<div class="flex items-center justify-between px-16 py-10 bg-primary/30 border-b border-surface/10 text-sm">
				<div class="flex items-center gap-8">
					<span class="size-10 rounded-full bg-accent/80" />
					<span class="size-10 rounded-full bg-bright-primary/70" />
					<span class="text-surface/60 ml-8">mongo-cli</span>
				</div>
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
										@click="
											doc.id &&
											stage('delete-document', { collection: entry.documents!.collection, id: doc.id })
										">
										del
									</button>
								</div>
							</div>
							<pre class="text-surface/80 text-xs whitespace-pre-wrap wrap-break-word">{{ doc.json }}</pre>
						</div>
					</div>
				</div>

				<div
					v-if="commandPreview || command"
					class="flex items-center justify-between gap-8">
					<span
						v-if="commandPreview"
						class="text-bright-primary">
						$ {{ commandPreview }}<span class="inline-block animate-pulse ml-2">▌</span>
					</span>
					<span v-else />
					<button
						type="button"
						class="btn shrink-0"
						:class="isDangerCommand ? 'btn-danger' : 'btn-submit'"
						:disabled="!canSubmit || running"
						@click="submit">
						{{ running ? 'running…' : 'submit' }}
					</button>
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
						@click="stage('show-dbs')">
						show dbs
					</button>

					<div class="flex items-center gap-6 px-8 py-4 rounded-sm border border-surface/20">
						<span class="text-surface/70 text-sm">create</span>
						<input
							v-model="newDbName"
							placeholder="database"
							class="input-cli w-100"
							@keydown.enter.prevent="stage('create-db', { db: newDbName, collection: newCollectionInput })" />
						<input
							v-model="newCollectionInput"
							placeholder="collection"
							class="input-cli w-120"
							@keydown.enter.prevent="stage('create-db', { db: newDbName, collection: newCollectionInput })" />
						<button
							type="button"
							class="btn btn-cmd"
							:disabled="!newDbName || !newCollectionInput"
							@click="stage('create-db', { db: newDbName, collection: newCollectionInput })">
							stage
						</button>
					</div>

					<div class="flex items-center gap-6 px-8 py-4 rounded-sm border border-surface/20">
						<span class="text-surface/70 text-sm">delete</span>
						<select
							v-model="dropDbTarget"
							class="input-cli"
							@change="dropDbTarget && stage('drop-db', { db: dropDbTarget })">
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

				<!-- Separator: DB → Collection -->
				<label class="flex items-center gap-8">
					<div class="flex-1 border-t border-surface/20" />
					<span class="text-surface/40 uppercase">current database:</span>
					<select
						v-model="currentDb"
						class="input-cli">
						<option value="">— select db —</option>
						<option
							v-for="d in dbs"
							:key="d"
							:value="d">
							{{ d }}
						</option>
					</select>
				</label>

				<!-- COLLECTION row -->
				<div
					class="flex flex-wrap items-center gap-8"
					:class="!currentDb ? 'opacity-50' : ''">
					<span class="text-surface/40 text-xs uppercase tracking-wide w-80">Collection</span>

					<button
						type="button"
						class="btn btn-cmd"
						:disabled="!currentDb"
						:title="!currentDb ? 'select a db first' : ''"
						@click="stage('show-collections')">
						show collections
					</button>

					<div class="flex items-center gap-6 px-8 py-4 rounded-sm border border-surface/20">
						<span class="text-surface/70 text-sm">create</span>
						<input
							v-model="newCollectionInput"
							:disabled="!currentDb"
							placeholder="collection"
							class="input-cli w-140"
							@keydown.enter.prevent="stage('create-collection', { collection: newCollectionInput })" />
						<button
							type="button"
							class="btn btn-cmd"
							:disabled="!currentDb || !newCollectionInput"
							@click="stage('create-collection', { collection: newCollectionInput })">
							stage
						</button>
					</div>

					<div class="flex items-center gap-6 px-8 py-4 rounded-sm border border-surface/20">
						<span class="text-surface/70 text-sm">delete</span>
						<select
							v-model="dropCollectionTarget"
							:disabled="!currentDb"
							class="input-cli"
							@change="dropCollectionTarget && stage('drop-collection', { collection: dropCollectionTarget })">
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

				<!-- Separator: Collection → Document -->
				<label class="flex items-center gap-8">
					<div class="flex-1 border-t border-surface/20" />
					<span class="text-surface/40 uppercase">current collection:</span>
					<select
						v-model="docsCollection"
						:disabled="!currentDb || !collections.length"
						class="input-cli disabled:opacity-40">
						<option value="">— select coll —</option>
						<option
							v-for="c in collections"
							:key="c"
							:value="c">
							{{ c }}
						</option>
					</select>
				</label>

				<!-- DOCUMENT section -->
				<div
					class="flex flex-col gap-8"
					:class="!docsCollection ? 'opacity-50' : ''">
					<span class="text-surface/40 text-xs uppercase tracking-wide">Document</span>

					<!-- limit & skip -->
					<div class="flex items-center gap-8">
						<label class="flex items-center gap-4 text-surface/70 text-sm">
							limit:
							<input
								v-model.number="docsLimit"
								:disabled="!docsCollection"
								type="number"
								min="1"
								class="input-cli w-60" />
						</label>
						<label class="flex items-center gap-4 text-surface/70 text-sm">
							skip:
							<input
								v-model.number="docsSkip"
								:disabled="!docsCollection"
								type="number"
								min="0"
								class="input-cli w-60" />
						</label>
					</div>

					<!-- filter + input grid -->
					<div class="grid grid-cols-[1fr_6fr_3fr] gap-8 items-start">
						<!-- Row 1: filter -->
						<span class="text-surface/70 text-sm pt-6">filter:</span>
						<textarea
							v-model="docsFilter"
							:disabled="!docsCollection"
							rows="2"
							placeholder='{"field": "value"}'
							class="bg-secondary text-surface border border-surface/20 rounded-sm px-8 py-6 text-xs font-mono focus:outline-none focus:border-bright-primary disabled:opacity-40 disabled:cursor-not-allowed" />
						<div class="flex flex-col">
							<button
								type="button"
								class="btn btn-cmd"
								:disabled="!currentDb || !docsCollection"
								@click="stage('show-documents', { collection: docsCollection })">
								find
							</button>
						</div>

						<!-- Row 2: input -->
						<span class="text-surface/70 text-sm pt-6">input:</span>
						<textarea
							ref="jsonInputEl"
							v-model="jsonInput"
							:disabled="!docsCollection"
							rows="3"
							placeholder='{"name": "alpha"}'
							class="bg-secondary text-surface border border-surface/20 rounded-sm px-8 py-6 text-xs font-mono focus:outline-none focus:border-bright-primary disabled:opacity-40 disabled:cursor-not-allowed" />
						<div class="flex flex-col gap-4">
							<button
								type="button"
								class="btn btn-cmd"
								:disabled="!currentDb || !docsCollection || !jsonInput.trim()"
								@click="stage('insert-document', { collection: docsCollection })">
								insert
							</button>
							<button
								type="button"
								class="btn btn-cmd"
								:disabled="!currentDb || !docsCollection || !jsonInput.trim()"
								@click="stage('update-document', { collection: docsCollection })">
								updateOne
							</button>
							<button
								type="button"
								class="btn btn-cmd"
								:disabled="!currentDb || !docsCollection || !jsonInput.trim()"
								@click="stage('update-documents', { collection: docsCollection })">
								updateMany
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

