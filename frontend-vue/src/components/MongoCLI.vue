<script setup lang="ts">
	import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
	import { useMongoApi } from '../composables/useMongoApi'
	import { useCurrentDb } from '../composables/useCurrentDb'
	import { stringifyNames } from '../utils/stringifyNames'
	import { normalizeDocuments } from '../utils/normalizeDocuments'
	import { safeStringifyData } from '../utils/safeStringifyData'
	import { snippet } from '../utils/snippet'
	import { validateUserInput } from '../utils/validateUserInput'

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

	type HistoryEntry = {
		cmd: string
		output: string
		error?: boolean
		documents?: { collection: string; items: string[] }
	}

	type CommandSpec = {
		preview: (cmd: Command) => string
		run: (cmd: Command, entry: HistoryEntry) => Promise<unknown>
		needsCurrentDb?: boolean
		danger?: boolean
		validate?: (cmd: Command) => boolean
		refresh?: 'dbs' | 'collections' | 'docs'
		keepJsonOnSubmit?: boolean
		onSuccess?: (cmd: Command) => void
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

	const commands: Record<CommandKind, CommandSpec> = {
		'show-dbs': {
			needsCurrentDb: false,
			preview: () => 'show dbs',
			run: () => api.listDbs(),
			refresh: 'dbs',
		},
		'show-collections': {
			preview: () => `show collections${currentDb.value ? ` --db=${currentDb.value}` : ''}`,
			run: () => api.listCollections(),
			refresh: 'collections',
		},
		'create-db': {
			needsCurrentDb: false,
			preview: (cmd) => `use ${cmd.db}; db.createCollection("${cmd.collection}")`,
			run: (cmd) => api.createDbWithCollection(cmd.db!, cmd.collection!),
			validate: (cmd) => Boolean(cmd.db && cmd.collection),
			refresh: 'dbs',
			onSuccess: (cmd) => {
				currentDb.value = cmd.db!
				newDbName.value = ''
				newCollectionInput.value = ''
			},
		},
		'drop-db': {
			needsCurrentDb: false,
			danger: true,
			preview: (cmd) => `use ${cmd.db}; db.dropDatabase()`,
			run: (cmd) => api.dropDb(cmd.db!),
			validate: (cmd) => Boolean(cmd.db),
			refresh: 'dbs',
			onSuccess: (cmd) => {
				if (currentDb.value === cmd.db) currentDb.value = ''
			},
		},
		'create-collection': {
			preview: (cmd) => `db.createCollection("${cmd.collection}")`,
			run: (cmd) => api.createCollection(cmd.collection!),
			refresh: 'collections',
			onSuccess: () => {
				newCollectionInput.value = ''
			},
		},
		'drop-collection': {
			danger: true,
			preview: (cmd) => `db.dropCollection("${cmd.collection}")`,
			run: (cmd) => api.dropCollection(cmd.collection!),
			refresh: 'collections',
		},
		'show-documents': {
			preview: (cmd) =>
				`db.${cmd.collection}.find(${docsFilter.value || '{}'}).skip(${docsSkip.value}).limit(${docsLimit.value})`,
			run: async (cmd, entry) => {
				await fetchDocs(cmd.collection!, entry)
				return entry.documents?.items ?? []
			},
		},
		'insert-document': {
			preview: (cmd) => `db.${cmd.collection}.insertOne(${snippet(jsonInput.value)})`,
			run: (cmd) => api.insertDocument(cmd.collection!, validateUserInput(jsonInput.value)),
			validate: () => jsonInput.value.trim().length > 0,
			refresh: 'docs',
			keepJsonOnSubmit: true,
			onSuccess: () => {
				jsonInput.value = ''
			},
		},
		'update-document': {
			preview: (cmd) => `db.${cmd.collection}.updateOne(${docsFilter.value || '{}'}, ${snippet(jsonInput.value)})`,
			run: (cmd) =>
				api.updateDocument(
					cmd.collection!,
					validateUserInput(jsonInput.value),
					validateUserInput(docsFilter.value) || undefined,
				),
			validate: (cmd) => Boolean(cmd.collection) && jsonInput.value.trim().length > 0,
			refresh: 'docs',
			keepJsonOnSubmit: true,
			onSuccess: () => {
				jsonInput.value = ''
				docsFilter.value = ''
			},
		},
		'update-documents': {
			preview: (cmd) => `db.${cmd.collection}.updateMany(${docsFilter.value || '{}'}, ${snippet(jsonInput.value)})`,
			run: (cmd) =>
				api.updateDocuments(
					cmd.collection!,
					validateUserInput(jsonInput.value),
					validateUserInput(docsFilter.value) || undefined,
				),
			validate: (cmd) => Boolean(cmd.collection) && jsonInput.value.trim().length > 0,
			refresh: 'docs',
			keepJsonOnSubmit: true,
			onSuccess: () => {
				jsonInput.value = ''
				docsFilter.value = ''
			},
		},
		'delete-document': {
			danger: true,
			preview: (cmd) => `db.${cmd.collection}.deleteOne({_id: "${cmd.id}"})`,
			run: (cmd) => api.deleteDocument(cmd.collection!, cmd.id!),
			validate: (cmd) => Boolean(cmd.collection && cmd.id),
			refresh: 'docs',
		},
	}

	const commandPreview = computed(() => {
		const c = command.value
		return c ? commands[c.kind].preview(c) : ''
	})

	const isDangerCommand = computed(() => Boolean(command.value && commands[command.value.kind].danger))

	const canSubmit = computed(() => {
		const c = command.value
		if (!c) return false
		const spec = commands[c.kind]
		if (spec.needsCurrentDb !== false && !currentDb.value) return false
		return spec.validate ? spec.validate(c) : true
	})

	async function refreshDbs() {
		try {
			dbs.value = stringifyNames(await api.listDbs())
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
			collections.value = stringifyNames(await api.listCollections())
			if (docsCollection.value && !collections.value.includes(docsCollection.value)) docsCollection.value = ''
			if (dropCollectionTarget.value && !collections.value.includes(dropCollectionTarget.value))
				dropCollectionTarget.value = ''
		} catch {
			collections.value = []
		}
	}

	async function fetchDocs(collection: string, entry: HistoryEntry) {
		const docs = await api.listDocuments(collection, {
			filter: docsFilter.value || undefined,
			limit: docsLimit.value,
			skip: docsSkip.value,
		})
		entry.output = safeStringifyData(docs)
		entry.documents = { collection, items: normalizeDocuments(docs) }
		// Force reactivity update
		history.value = [...history.value]
	}

	async function validateDocsFetch(collection: string) {
		const refreshEntry: HistoryEntry = {
			cmd: `db.${currentDb.value}.${collection}.find() // validation`,
			output: '…',
		}
		history.value.push(refreshEntry)
		try {
			await fetchDocs(collection, refreshEntry)
		} catch (err) {
			refreshEntry.output = err instanceof Error ? err.message : String(err)
			refreshEntry.error = true
		}
		await nextTick()
		scrollToBottom()
	}

	async function stage(kind: CommandKind, extras: Omit<Command, 'kind'> = {}) {
		command.value = { kind, ...extras }
		if (kind !== 'drop-collection') dropCollectionTarget.value = ''
		if (kind !== 'drop-db') dropDbTarget.value = ''
		await nextTick()
		scrollToBottom()
	}

	function onEditDoc(collection: string, doc: string) {
		let parsed: Record<string, unknown> = {}
		try {
			parsed = JSON.parse(doc)
		} catch {
			return
		}
		const { _id, ...rest } = parsed
		docsFilter.value = JSON.stringify({ _id })
		jsonInput.value = JSON.stringify(rest, null, 2)
		stage('update-document', { collection })
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
			const result = await spec.run(cmd, entry)
			if (!entry.documents) entry.output = safeStringifyData(result)
			spec.onSuccess?.(cmd)
			if (spec.refresh === 'dbs') await refreshDbs()
			if (spec.refresh === 'collections') await refreshCollections()
			if (spec.refresh === 'docs') await validateDocsFetch(cmd.collection!)
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
				data-cy="terminal"
				class="px-16 py-16 h-400 overflow-y-auto text-sm leading-relaxed">
				<div
					v-if="!history.length && !commandPreview"
					data-cy="empty-state"
					class="text-surface/40">
					Pick a command below, then press submit.
				</div>

				<div
					v-for="(entry, i) in history"
					:key="i"
					data-cy="history-entry"
					class="mb-12">
					<div data-cy="history-cmd" class="text-bright-primary">$ {{ entry.cmd }}</div>
					<pre
						v-if="!entry.documents"
						data-cy="history-output"
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
							:key="j"
							data-cy="doc-card"
							class="border border-surface/10 rounded-sm p-8">
							<div class="flex justify-end mb-4 gap-4">
								<button
									type="button"
									data-cy="doc-edit"
									class="btn-inline"
									@click="onEditDoc(entry.documents!.collection, doc)">
									edit
								</button>
								<button
									type="button"
									data-cy="doc-del"
									class="btn-inline"
									@click="
										stage('delete-document', {
											collection: entry.documents!.collection,
											id: JSON.parse(doc)._id,
										})
									">
									del
								</button>
							</div>
							<pre class="text-surface/80 text-xs whitespace-pre-wrap wrap-break-word">{{ doc }}</pre>
						</div>
					</div>
				</div>

				<div
					v-if="commandPreview || command"
					class="flex items-center justify-between gap-8">
					<span
						v-if="commandPreview"
						data-cy="cmd-preview"
						class="text-bright-primary">
						$ {{ commandPreview }}<span class="inline-block animate-pulse ml-2">▌</span>
					</span>
					<span v-else />
					<button
						type="button"
						data-cy="submit-btn"
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
						data-cy="show-dbs-btn"
						class="btn btn-cmd"
						@click="stage('show-dbs')">
						show dbs
					</button>

					<div class="flex items-center gap-6 px-8 py-4 rounded-sm border border-surface/20">
						<span class="text-surface/70 text-sm">create</span>
						<input
							v-model="newDbName"
							data-cy="create-db-name"
							placeholder="database"
							class="input-cli w-100"
							@keydown.enter.prevent="stage('create-db', { db: newDbName, collection: newCollectionInput })" />
						<input
							v-model="newCollectionInput"
							data-cy="create-db-coll"
							placeholder="collection"
							class="input-cli w-120"
							@keydown.enter.prevent="stage('create-db', { db: newDbName, collection: newCollectionInput })" />
						<button
							type="button"
							data-cy="create-db-stage"
							class="btn btn-cmd"
							:disabled="!newDbName || !newCollectionInput"
							@click="stage('create-db', { db: newDbName, collection: newCollectionInput })">
							stage
						</button>
					</div>

					<div class="flex items-center gap-6 px-8 py-10 rounded-sm border border-surface/20">
						<span class="text-surface/70 text-sm">delete db</span>
						<select
							v-model="dropDbTarget"
							data-cy="drop-db-select"
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
						data-cy="current-db"
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
						data-cy="show-colls-btn"
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
							data-cy="create-coll-input"
							:disabled="!currentDb"
							placeholder="collection"
							class="input-cli w-140"
							@keydown.enter.prevent="stage('create-collection', { collection: newCollectionInput })" />
						<button
							type="button"
							data-cy="create-coll-stage"
							class="btn btn-cmd"
							:disabled="!currentDb || !newCollectionInput"
							@click="stage('create-collection', { collection: newCollectionInput })">
							stage
						</button>
					</div>

					<div class="flex items-center gap-6 px-8 py-10 rounded-sm border border-surface/20">
						<span class="text-surface/70 text-sm">delete coll</span>
						<select
							v-model="dropCollectionTarget"
							data-cy="drop-coll-select"
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
						data-cy="current-coll"
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
								data-cy="docs-limit"
								:disabled="!docsCollection"
								type="number"
								min="1"
								class="input-cli w-60" />
						</label>
						<label class="flex items-center gap-4 text-surface/70 text-sm">
							skip:
							<input
								v-model.number="docsSkip"
								data-cy="docs-skip"
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
							data-cy="docs-filter"
							:disabled="!docsCollection"
							rows="2"
							placeholder='{"field": "value"}'
							class="bg-secondary text-surface border border-surface/20 rounded-sm px-8 py-6 text-xs font-mono focus:outline-none focus:border-bright-primary disabled:opacity-40 disabled:cursor-not-allowed" />
						<div class="flex flex-col">
							<button
								type="button"
								data-cy="find-btn"
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
							data-cy="json-input"
							:disabled="!docsCollection"
							rows="3"
							placeholder='{"name": "alpha"}'
							class="bg-secondary text-surface border border-surface/20 rounded-sm px-8 py-6 text-xs font-mono focus:outline-none focus:border-bright-primary disabled:opacity-40 disabled:cursor-not-allowed" />
						<div class="flex flex-col gap-4">
							<button
								type="button"
								data-cy="insert-btn"
								class="btn btn-cmd"
								:disabled="!currentDb || !docsCollection || !jsonInput.trim()"
								@click="stage('insert-document', { collection: docsCollection })">
								insert
							</button>
							<button
								type="button"
								data-cy="update-one-btn"
								class="btn btn-cmd"
								:disabled="!currentDb || !docsCollection || !jsonInput.trim()"
								@click="stage('update-document', { collection: docsCollection })">
								updateOne
							</button>
							<button
								type="button"
								data-cy="update-many-btn"
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

