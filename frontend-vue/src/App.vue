<script setup lang="ts">
	import { ref, computed, watch, provide, onMounted, onBeforeUnmount, nextTick } from 'vue'
	import { useMongoApi } from './composables/useMongoApi'
	import { useCurrentDb } from './composables/useCurrentDb'
	import { shellKey } from './composables/useShell'
	import { normalizeDocuments } from './utils/normalizeDocuments'
	import { safeStringifyData } from './utils/safeStringifyData'
	import { snippet } from './utils/snippet'
	import { validateUserInput } from './utils/validateUserInput'
	import { stringifyNames } from './utils/stringifyNames'
	import TerminalOutput from './components/TerminalOutput.vue'
	import GeneralPage from './components/GeneralPage.vue'
	import CrudPage from './components/CrudPage.vue'

	const api = useMongoApi()
	const currentDb = useCurrentDb()
	const activePage = ref<'general' | 'crud'>('general')

	const dbs = ref<string[]>([])
	const collections = ref<string[]>([])
	const history = ref<HistoryEntry[]>([])
	const running = ref(false)
	const command = ref<Command | null>(null)
	const terminalRef = ref<InstanceType<typeof TerminalOutput> | null>(null)
	const generalRef = ref<InstanceType<typeof GeneralPage> | null>(null)
	const crudRef = ref<InstanceType<typeof CrudPage> | null>(null)

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

	async function fetchDocs(collection: string, entry: HistoryEntry, filter?: string, limit?: number, skip?: number) {
		const docs = await api.listDocuments(collection, {
			filter: filter || undefined,
			limit: limit ?? 50,
			skip: skip ?? 0,
		})
		entry.output = safeStringifyData(docs)
		entry.documents = { collection, items: normalizeDocuments(docs) }
		history.value = [...history.value]
	}

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
		},
		'drop-collection': {
			danger: true,
			preview: (cmd) => `db.dropCollection("${cmd.collection}")`,
			run: (cmd) => api.dropCollection(cmd.collection!),
			refresh: 'collections',
		},
		'show-documents': {
			preview: (cmd) =>
				`db.${cmd.collection}.find(${cmd.filter || '{}'}).skip(${cmd.skip ?? 0}).limit(${cmd.limit ?? 50})`,
			run: async (cmd, entry) => {
				await fetchDocs(cmd.collection!, entry, cmd.filter, cmd.limit, cmd.skip)
				return entry.documents?.items ?? []
			},
		},
		'insert-document': {
			preview: (cmd) => `db.${cmd.collection}.insertOne(${snippet(cmd.body ?? '')})`,
			run: (cmd) => api.insertDocument(cmd.collection!, validateUserInput(cmd.body!)),
			validate: (cmd) => Boolean(cmd.collection && cmd.body?.trim()),
			refresh: 'docs',
			keepJsonOnSubmit: true,
		},
		'update-document': {
			preview: (cmd) => `db.${cmd.collection}.updateOne(${cmd.filter || '{}'}, ${snippet(cmd.body ?? '')})`,
			run: (cmd) =>
				api.updateDocument(
					cmd.collection!,
					validateUserInput(cmd.body!),
					cmd.filter ? validateUserInput(cmd.filter) : undefined,
				),
			validate: (cmd) => Boolean(cmd.collection && cmd.body?.trim()),
			refresh: 'docs',
			keepJsonOnSubmit: true,
		},
		'update-documents': {
			preview: (cmd) => `db.${cmd.collection}.updateMany(${cmd.filter || '{}'}, ${snippet(cmd.body ?? '')})`,
			run: (cmd) =>
				api.updateDocuments(
					cmd.collection!,
					validateUserInput(cmd.body!),
					cmd.filter ? validateUserInput(cmd.filter) : undefined,
				),
			validate: (cmd) => Boolean(cmd.collection && cmd.body?.trim()),
			refresh: 'docs',
			keepJsonOnSubmit: true,
		},
		'delete-document': {
			danger: true,
			preview: (cmd) => `db.${cmd.collection}.deleteOne({id: "${cmd.id}"})`,
			run: (cmd) => api.deleteDocument(cmd.collection!, cmd.id!),
			validate: (cmd) => Boolean(cmd.collection && cmd.id),
			refresh: 'docs',
		},
		'delete-documents': {
			danger: true,
			preview: (cmd) => `db.${cmd.collection}.deleteMany(${cmd.filter || '{}'})`,
			run: (cmd) => api.deleteDocuments(cmd.collection!, cmd.filter),
			validate: (cmd) => Boolean(cmd.collection),
			refresh: 'docs',
		},
	}

	const commandPreview = computed(() => {
		const c = command.value
		return c ? commands[c.kind].preview(c) : ''
	})

	const hasCommand = computed(() => !!command.value)
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
			return
		}
		try {
			collections.value = stringifyNames(await api.listCollections())
		} catch {
			collections.value = []
		}
	}

	function scrollToBottom() {
		terminalRef.value?.scrollToBottom()
	}

	async function execute(cmd: string, fn: (entry: HistoryEntry) => Promise<void>, onError?: (err: unknown) => void) {
		if (running.value) return
		running.value = true
		const entry: HistoryEntry = { cmd, output: '…' }
		history.value.push(entry)
		await nextTick()
		scrollToBottom()
		try {
			await fn(entry)
			history.value = [...history.value]
		} catch (err) {
			entry.output = err instanceof Error ? err.message : String(err)
			entry.error = true
			history.value = [...history.value]
			onError?.(err)
		} finally {
			running.value = false
			await nextTick()
			scrollToBottom()
		}
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
			history.value = [...history.value]
		}
		await nextTick()
		scrollToBottom()
	}

	async function stage(kind: CommandKind, extras: Omit<Command, 'kind'> = {}) {
		command.value = { kind, ...extras }
		await nextTick()
		scrollToBottom()
	}

	async function submit() {
		if (!canSubmit.value || running.value || !command.value) return
		const cmd = command.value
		const spec = commands[cmd.kind]
		const preview = commandPreview.value
		command.value = null

		await execute(
			preview,
			async (entry) => {
				const result = await spec.run(cmd, entry)
				if (!entry.documents) entry.output = safeStringifyData(result)
				spec.onSuccess?.(cmd)
				cmd.afterSuccess?.()
				if (spec.refresh === 'dbs') await refreshDbs()
				if (spec.refresh === 'collections') await refreshCollections()
				if (spec.refresh === 'docs') await validateDocsFetch(cmd.collection!)
			},
			() => {
				if (spec.keepJsonOnSubmit) command.value = cmd
			},
		)
	}

	function onKeydown(e: KeyboardEvent) {
		const target = e.target as HTMLElement
		const isInForm = target?.matches('input, textarea, select')

		if (e.key === 'Enter') {
			if (canSubmit.value && !running.value && (!isInForm || e.metaKey || e.ctrlKey)) {
				e.preventDefault()
				submit()
			}
		} else if (e.key === 'Escape' && command.value) {
			command.value = null
		}
	}

	function onEditDoc(collection: string, doc: string) {
		if (activePage.value === 'general') generalRef.value?.onEditDoc(collection, doc)
		else crudRef.value?.onEditDoc(collection, doc)
	}

	function onDeleteDoc(collection: string, id: string) {
		stage('delete-document', { collection, id })
	}

	watch(currentDb, () => {
		refreshCollections()
		const c = command.value
		if (c && c.kind !== 'show-dbs' && c.kind !== 'create-db' && c.kind !== 'drop-db') {
			command.value = null
		}
	})

	provide(shellKey, {
		dbs,
		collections,
		history,
		running,
		command,
		commandPreview,
		hasCommand,
		isDangerCommand,
		canSubmit,
		refreshDbs,
		refreshCollections,
		execute,
		stage,
		submit,
		scrollToBottom,
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
			<!-- header -->
			<div class="flex items-center justify-between px-16 py-10 bg-primary/30 border-b border-surface/10 text-sm">
				<div class="flex items-center gap-8">
					<span class="size-10 rounded-full bg-accent/80" />
					<span class="size-10 rounded-full bg-bright-primary/70" />
					<span class="text-surface/60 ml-8">mongo-cli</span>
				</div>
				<div class="flex items-center gap-6">
					<button
						type="button"
						class="btn btn-cmd"
						:class="activePage === 'general' ? 'border-bright-primary text-bright-primary' : ''"
						@click="activePage = 'general'">
						General
					</button>
					<button
						type="button"
						class="btn btn-cmd"
						:class="activePage === 'crud' ? 'border-bright-primary text-bright-primary' : ''"
						@click="activePage = 'crud'">
						CRUD
					</button>
				</div>
			</div>

			<!-- terminal -->
			<TerminalOutput
				ref="terminalRef"
				:history="history"
				:command-preview="commandPreview"
				:has-command="hasCommand"
				:is-danger="isDangerCommand"
				:can-submit="canSubmit"
				:running="running"
				@submit="submit()"
				@edit-doc="onEditDoc"
				@delete-doc="onDeleteDoc" />

			<!-- pages -->
			<GeneralPage
				v-show="activePage === 'general'"
				ref="generalRef" />
			<CrudPage
				v-show="activePage === 'crud'"
				ref="crudRef" />
		</div>
	</div>
</template>

