<script setup lang="ts">
	import { ref, computed, watch } from 'vue'
	import { useCurrentDb } from '../composables/useCurrentDb'
	import { useShell } from '../composables/useShell'
	import { buildJsonFromPairs } from '../utils/buildJsonFromPairs'
	import KeyValueBuilder from './KeyValueBuilder.vue'

	const currentDb = useCurrentDb()
	const { dbs, collections, running, stage } = useShell()

	const selectedCollection = ref('')
	const filterPairs = ref([{ key: '', value: '' }])
	const bodyPairs = ref([{ key: '', value: '' }])

	function buildFilter(): string | undefined {
		const json = buildJsonFromPairs(filterPairs.value)
		return json === '{}' ? undefined : json
	}

	function buildBody(): string {
		return buildJsonFromPairs(bodyPairs.value)
	}

	function onEditDoc(collection: string, doc: string) {
		let parsed: Record<string, unknown> = {}
		try {
			parsed = JSON.parse(doc)
		} catch {
			return
		}
		const {
			_id: { $oid: id },
			...rest
		} = parsed
		filterPairs.value = [{ key: 'id', value: String(id) }]
		const restPairs = Object.entries(rest).map(([key, value]) => ({
			key,
			value: typeof value === 'string' ? value : JSON.stringify(value),
		}))
		bodyPairs.value = restPairs.length ? restPairs : [{ key: '', value: '' }]
		selectedCollection.value = collection
	}

	const canRun = computed(() => Boolean(currentDb.value && selectedCollection.value && !running.value))
	const hasBody = computed(() => buildBody() !== '{}')
	const hasFilterId = computed(() => filterPairs.value.some((p) => p.key.trim() === 'id' && p.value.trim()))

	watch(collections, (cols) => {
		if (selectedCollection.value && !cols.includes(selectedCollection.value)) {
			selectedCollection.value = ''
		}
	})

	defineExpose({ onEditDoc })
</script>

<template>
	<!-- control panel -->
	<div class="px-16 py-12 bg-primary/15 border-t border-surface/10 flex flex-col gap-10">
		<!-- DB + Collection selectors -->
		<div class="flex flex-wrap items-center gap-12">
			<label class="flex items-center gap-8">
				<span class="text-surface/40 text-xs uppercase tracking-wide">Database</span>
				<select
					v-model="currentDb"
					data-cy="crud-db-select"
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

			<label class="flex items-center gap-8">
				<span class="text-surface/40 text-xs uppercase tracking-wide">Collection</span>
				<select
					v-model="selectedCollection"
					data-cy="crud-coll-select"
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
		</div>

		<div class="border-t border-surface/10" />

		<!-- Filter builder -->
		<div
			data-cy="crud-filter"
			class="flex flex-col gap-6"
			:class="!canRun ? 'opacity-50' : ''">
			<span class="text-surface/40 text-sm uppercase tracking-wide">Filter</span>
			<KeyValueBuilder
				v-model="filterPairs"
				:disabled="!canRun" />
		</div>

		<!-- Body builder -->
		<div
			data-cy="crud-body"
			class="flex flex-col gap-6"
			:class="!canRun ? 'opacity-50' : ''">
			<span class="text-surface/40 text-sm uppercase tracking-wide">Body</span>
			<KeyValueBuilder
				v-model="bodyPairs"
				:disabled="!canRun" />
		</div>

		<div class="border-t border-surface/10" />

		<!-- Operation buttons -->
		<div class="flex flex-wrap items-center gap-6">
			<button
				type="button"
				data-cy="crud-find-btn"
				class="btn btn-cmd"
				:disabled="!canRun"
				@click="stage('show-documents', { collection: selectedCollection, filter: buildFilter() })">
				find
			</button>
			<button
				type="button"
				data-cy="crud-insert-btn"
				class="btn btn-cmd"
				:disabled="!canRun || !hasBody"
				@click="stage('insert-document', { collection: selectedCollection, body: buildBody() })">
				insert
			</button>
			<button
				type="button"
				data-cy="crud-update-one-btn"
				class="btn btn-cmd"
				:disabled="!canRun || !hasBody"
				@click="
					stage('update-document', { collection: selectedCollection, filter: buildFilter(), body: buildBody() })
				">
				updateOne
			</button>
			<button
				type="button"
				data-cy="crud-update-many-btn"
				class="btn btn-cmd"
				:disabled="!canRun || !hasBody"
				@click="
					stage('update-documents', { collection: selectedCollection, filter: buildFilter(), body: buildBody() })
				">
				updateMany
			</button>
			<button
				type="button"
				data-cy="crud-delete-one-btn"
				class="btn btn-cmd btn-danger"
				:disabled="!canRun || !hasFilterId"
				:title="!hasFilterId ? 'add id to filter' : ''"
				@click="
					stage('delete-document', {
						collection: selectedCollection,
						id: filterPairs.find((p) => p.key.trim() === 'id')?.value.trim(),
					})
				">
				deleteOne
			</button>
			<button
				type="button"
				data-cy="crud-delete-many-btn"
				class="btn btn-cmd btn-danger"
				:disabled="!canRun || hasFilterId"
				:title="hasFilterId ? 'id in filter' : ''"
				@click="stage('delete-documents', { collection: selectedCollection, filter: buildFilter() })">
				deleteMany
			</button>
		</div>
	</div>
</template>

