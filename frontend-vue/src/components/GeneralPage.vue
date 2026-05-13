<script setup lang="ts">
	import { ref, watch, nextTick } from 'vue'
	import { useCurrentDb } from '../composables/useCurrentDb'
	import { useShell } from '../composables/useShell'

	const currentDb = useCurrentDb()
	const { dbs, collections, command, stage } = useShell()

	const jsonInputEl = ref<HTMLTextAreaElement | null>(null)

	const newDbName = ref('')
	const newCollectionInput = ref('')
	const dropDbTarget = ref('')
	const dropCollectionTarget = ref('')
	const docsCollection = ref('')
	const docsFilter = ref('')
	const docsLimit = ref(50)
	const docsSkip = ref(0)
	const jsonInput = ref('')

	function stageCreateDb() {
		stage('create-db', {
			db: newDbName.value,
			collection: newCollectionInput.value,
			afterSuccess: () => {
				newDbName.value = ''
				newCollectionInput.value = ''
			},
		})
	}

	function stageCreateCollection() {
		stage('create-collection', {
			collection: newCollectionInput.value,
			afterSuccess: () => {
				newCollectionInput.value = ''
			},
		})
	}

	function stageInsert() {
		stage('insert-document', {
			collection: docsCollection.value,
			body: jsonInput.value,
			afterSuccess: () => {
				jsonInput.value = ''
			},
		})
	}

	function stageUpdateOne() {
		stage('update-document', {
			collection: docsCollection.value,
			filter: docsFilter.value || undefined,
			body: jsonInput.value,
			afterSuccess: () => {
				jsonInput.value = ''
				docsFilter.value = ''
			},
		})
	}

	function stageUpdateMany() {
		stage('update-documents', {
			collection: docsCollection.value,
			filter: docsFilter.value || undefined,
			body: jsonInput.value,
			afterSuccess: () => {
				jsonInput.value = ''
				docsFilter.value = ''
			},
		})
	}

	function onEditDoc(collection: string, doc: string) {
		let parsed: Record<string, unknown> = {}
		try {
			parsed = JSON.parse(doc)
		} catch {
			return
		}
		const {
			// @ts-ignore
			_id: { $oid: id },
			...rest
		} = parsed
		const filter = JSON.stringify({ id })
		const body = JSON.stringify(rest, null, 2)
		docsFilter.value = filter
		jsonInput.value = body
		docsCollection.value = collection
		nextTick(() => jsonInputEl.value?.focus())
	}

	watch(command, (cmd) => {
		if (cmd?.kind !== 'drop-collection') dropCollectionTarget.value = ''
		if (cmd?.kind !== 'drop-db') dropDbTarget.value = ''
	})

	watch(collections, (cols) => {
		if (docsCollection.value && !cols.includes(docsCollection.value)) docsCollection.value = ''
		if (dropCollectionTarget.value && !cols.includes(dropCollectionTarget.value)) dropCollectionTarget.value = ''
	})

	defineExpose({ onEditDoc })
</script>

<template>
	<!-- command bar -->
	<div class="px-16 py-12 bg-primary/15 border-t border-surface/10 flex flex-col gap-10">
		<!-- DB row -->
		<div class="flex flex-col max-sm:justify-center max-sm:items-center sm:items-start gap-10">
			<div class="flex max-sm:flex-col w-full items-center max-sm:gap-4 gap-8">
				<span class="text-surface text-sm uppercase tracking-wide">databases</span>

				<button
					type="button"
					data-cy="show-dbs-btn"
					class="btn btn-cmd max-sm:w-200"
					@click="stage('show-dbs')">
					show dbs
				</button>
			</div>
			<div class="flex max-sm:flex-col sm:items-center gap-6 p-8 rounded-sm border border-surface/20">
				<span class="text-surface/70 text-sm self-center">create db</span>
				<input
					v-model="newDbName"
					data-cy="create-db-name"
					placeholder="database"
					class="input-cli sm:w-100"
					@keydown.enter.prevent="stageCreateDb()" />
				<input
					v-model="newCollectionInput"
					data-cy="create-db-coll"
					placeholder="collection"
					class="input-cli sm:w-120"
					@keydown.enter.prevent="stageCreateDb()" />
				<button
					type="button"
					data-cy="create-db-stage"
					class="btn btn-cmd"
					:disabled="!newDbName || !newCollectionInput"
					@click="stageCreateDb()">
					stage
				</button>
			</div>

			<div class="flex items-center gap-6 p-8 rounded-sm border border-surface/20">
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
		<label class="flex max-sm:flex-col items-end sm:items-center gap-8 pt-10 pb-2">
			<div class="max-sm:w-full flex-1 border-t border-surface/20" />
			<div class="flex gap-6 items-center">
				<span class="text-surface/40 max-sm:text-xs uppercase">current database:</span>
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
			</div>
			<div class="max-sm:w-full sm:hidden flex-1 border-t border-surface/20" />
		</label>

		<!-- COLLECTION row -->
		<div
			class="flex flex-col max-sm:items-center items-start gap-10"
			:class="!currentDb ? 'opacity-50' : ''">
			<div class="flex max-sm:flex-col gap-4 sm:gap-8 w-full items-center">
				<p class="text-surface text-sm uppercase tracking-wide">Collections</p>

				<button
					type="button"
					data-cy="show-colls-btn"
					class="btn btn-cmd max-sm:w-200"
					:disabled="!currentDb"
					:title="!currentDb ? 'select a db first' : ''"
					@click="stage('show-collections')">
					show collections
				</button>
			</div>

			<div class="flex max-sm:flex-col gap-6 p-8 rounded-sm border border-surface/20">
				<span class="text-surface/70 text-sm self-center">create collection</span>
				<input
					v-model="newCollectionInput"
					data-cy="create-coll-input"
					:disabled="!currentDb"
					placeholder="collection"
					class="input-cli sm:w-140"
					@keydown.enter.prevent="stageCreateCollection()" />
				<button
					type="button"
					data-cy="create-coll-stage"
					class="btn btn-cmd"
					:disabled="!currentDb || !newCollectionInput"
					@click="stageCreateCollection()">
					stage
				</button>
			</div>

			<div class="flex max-sm:items-center gap-6 px-8 py-10 rounded-sm border border-surface/20">
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
		<label class="flex max-sm:flex-col items-end sm:items-center gap-8 pt-10 pb-2">
			<div class="max-sm:w-full flex-1 border-t border-surface/20" />
			<div class="flex gap-6 items-center">
				<span class="text-surface/40 max-sm:text-xs uppercase">current collection:</span>
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
			</div>
			<div class="max-sm:w-full sm:hidden flex-1 border-t border-surface/20" />
		</label>

		<!-- DOCUMENT section -->
		<div
			class="flex flex-col gap-8"
			:class="!docsCollection ? 'opacity-50' : ''">
			<span class="text-surface text-sm uppercase tracking-wide max-sm:self-center">Documents</span>

			<!-- limit & skip -->
			<div class="flex items-center gap-8 max-sm:self-center">
				<label class="flex items-center gap-2 text-surface/70 text-xs uppercase">
					limit:
					<input
						v-model.number="docsLimit"
						data-cy="docs-limit"
						:disabled="!docsCollection"
						type="number"
						min="1"
						class="input-cli w-60" />
				</label>
				<label class="flex items-center gap-2 uppercase text-surface/70 text-xs">
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
			<div class="grid sm:grid-cols-[1fr_6fr_3fr] gap-8 items-start">
				<!-- Row 1: filter -->
				<span class="text-surface/70 text-sm uppercase tracking-wide pt-6">filter:</span>
				<textarea
					v-model="docsFilter"
					data-cy="docs-filter"
					:disabled="!docsCollection"
					rows="2"
					placeholder='{"field": "value"}'
					class="bg-secondary text-surface border border-surface/20 rounded-sm px-8 py-6 text-xs font-mono focus:outline-none focus:border-bright-primary disabled:opacity-40 disabled:cursor-not-allowed" />
				<div class="flex flex-col gap-4">
					<button
						type="button"
						data-cy="find-btn"
						class="btn btn-cmd"
						:disabled="!currentDb || !docsCollection"
						@click="
							stage('show-documents', {
								collection: docsCollection,
								filter: docsFilter || undefined,
								limit: docsLimit,
								skip: docsSkip,
							})
						">
						find
					</button>
					<button
						type="button"
						data-cy="delete-many-btn"
						class="btn btn-cmd btn-danger"
						:disabled="!currentDb || !docsCollection"
						@click="stage('delete-documents', { collection: docsCollection, filter: docsFilter || undefined })">
						deleteMany
					</button>
				</div>

				<!-- Row 2: input -->
				<span class="text-surface/70 text-sm pt-6 tracking-wide uppercase">body:</span>
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
						@click="stageInsert()">
						insert
					</button>
					<button
						type="button"
						data-cy="update-one-btn"
						class="btn btn-cmd"
						:disabled="!currentDb || !docsCollection || !jsonInput.trim()"
						@click="stageUpdateOne()">
						updateOne
					</button>
					<button
						type="button"
						data-cy="update-many-btn"
						class="btn btn-cmd"
						:disabled="!currentDb || !docsCollection || !jsonInput.trim()"
						@click="stageUpdateMany()">
						updateMany
					</button>
				</div>
			</div>
		</div>
	</div>
</template>

