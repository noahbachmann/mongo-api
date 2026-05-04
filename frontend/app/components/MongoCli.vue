<script setup lang="ts">
	type Command =
		| { kind: 'show-dbs' }
		| { kind: 'show-collections' }
		| { kind: 'delete-collection'; collection: string }

	type HistoryEntry = {
		cmd: string
		output: string
		error?: boolean
	}

	const api = useMongoApi()
	const currentDb = useCurrentDb()

	const dbs = ref<string[]>([])
	const collections = ref<string[]>([])
	const command = ref<Command | null>(null)
	const deleteTarget = ref('')
	const history = ref<HistoryEntry[]>([])
	const running = ref(false)
	const terminalEl = ref<HTMLElement | null>(null)

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

	const commandPreview = computed(() => {
		const c = command.value
		if (!c) return ''
		if (c.kind === 'show-dbs') return 'show dbs'
		if (c.kind === 'show-collections') return `show collections${currentDb.value ? ` --db=${currentDb.value}` : ''}`
		const dbPart = currentDb.value || '<db>'
		return `db.${dbPart}.dropCollection("${c.collection}")`
	})

	const canSubmit = computed(() => {
		const c = command.value
		if (!c) return false
		if (c.kind === 'show-dbs') return true
		return Boolean(currentDb.value)
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
			return
		}
		try {
			collections.value = normalizeNames(await api.listCollections())
		} catch {
			collections.value = []
		}
	}

	function stage(c: Command) {
		command.value = c
		if (c.kind !== 'delete-collection') deleteTarget.value = ''
	}

	function onPickDelete() {
		if (deleteTarget.value) command.value = { kind: 'delete-collection', collection: deleteTarget.value }
	}

	async function submit() {
		if (!canSubmit.value || running.value || !command.value) return
		const c = command.value
		const cmd = commandPreview.value
		running.value = true

		const entry: HistoryEntry = { cmd, output: '…' }
		history.value.push(entry)
		command.value = null
		deleteTarget.value = ''
		await nextTick()
		scrollToBottom()

		try {
			let result: unknown
			if (c.kind === 'show-dbs') {
				result = await api.listDbs()
				dbs.value = normalizeNames(result)
			} else if (c.kind === 'show-collections') {
				result = await api.listCollections()
				collections.value = normalizeNames(result)
			} else {
				result = await api.dropCollection(c.collection)
				await refreshCollections()
			}
			entry.output = formatOutput(result)
		} catch (err: unknown) {
			entry.output = err instanceof Error ? err.message : String(err)
			entry.error = true
		} finally {
			running.value = false
			await nextTick()
			scrollToBottom()
		}
	}

	function formatOutput(data: unknown): string {
		if (data === undefined || data === null || data === '') return '(no content)'
		try {
			return JSON.stringify(data, null, 2)
		} catch {
			return String(data)
		}
	}

	function scrollToBottom() {
		const el = terminalEl.value
		if (el) el.scrollTop = el.scrollHeight
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && canSubmit.value && !running.value) {
			e.preventDefault()
			submit()
		} else if (e.key === 'Escape' && command.value) {
			command.value = null
			deleteTarget.value = ''
		}
	}

	watch(currentDb, () => {
		if (command.value?.kind === 'delete-collection') {
			command.value = null
			deleteTarget.value = ''
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
			class="w-full max-w-3xl sm:rounded-md border border-secondary/15 bg-secondary text-surface font-mono shadow-lg overflow-hidden">
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
						class="bg-secondary text-surface border border-surface/20 rounded-sm px-8 py-4 text-sm focus:outline-none focus:border-bright-primary">
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
						class="whitespace-pre-wrap wrap-break-word mt-2"
						:class="entry.error ? 'text-accent' : 'text-surface/90'"
						>{{ entry.output }}</pre
					>
				</div>

				<div
					v-if="commandPreview"
					class="text-bright-primary">
					$ {{ commandPreview }}<span class="inline-block animate-pulse ml-2">▌</span>
				</div>
			</div>

			<!-- command bar -->
			<div class="px-16 py-12 bg-primary/15 border-t border-surface/10 flex flex-wrap items-center gap-8">
				<button
					type="button"
					class="btn btn-cmd"
					@click="stage({ kind: 'show-dbs' })">
					show dbs
				</button>
				<button
					type="button"
					class="btn btn-cmd"
					:disabled="!currentDb"
					:title="!currentDb ? 'select a db first' : ''"
					@click="stage({ kind: 'show-collections' })">
					show collections
				</button>

				<div
					class="flex items-center gap-6 px-8 py-4 rounded-sm border border-surface/20"
					:class="!currentDb ? 'opacity-40' : ''">
					<span class="text-surface/70 text-sm">delete collection</span>
					<select
						v-model="deleteTarget"
						:disabled="!currentDb"
						class="bg-secondary text-surface border border-surface/20 rounded-sm px-6 py-2 text-sm focus:outline-none focus:border-bright-primary disabled:cursor-not-allowed"
						@change="onPickDelete">
						<option value="">— pick —</option>
						<option
							v-for="c in collections"
							:key="c"
							:value="c">
							{{ c }}
						</option>
					</select>
				</div>

				<div class="flex-1" />

				<button
					type="button"
					class="btn"
					:class="command?.kind === 'delete-collection' ? 'btn-danger' : 'btn-submit'"
					:disabled="!canSubmit || running"
					@click="submit">
					{{ running ? 'running…' : 'submit' }}
				</button>
			</div>
		</div>
	</div>
</template>

