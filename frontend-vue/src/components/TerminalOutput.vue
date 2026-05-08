<script setup lang="ts">
	import { ref } from 'vue'

	defineProps<{
		history: HistoryEntry[]
		commandPreview: string
		hasCommand: boolean
		isDanger: boolean
		canSubmit: boolean
		running: boolean
	}>()

	const emit = defineEmits<{
		submit: []
		'edit-doc': [collection: string, doc: string]
		'delete-doc': [collection: string, id: string]
		'clear-history': []
	}>()

	const terminalEl = ref<HTMLElement | null>(null)

	function scrollToBottom() {
		const el = terminalEl.value
		if (el) el.scrollTop = el.scrollHeight
	}

	defineExpose({ scrollToBottom })
</script>

<template>
	<div class="grid grid-cols-1 *:col-span-full *:row-span-full relative">
		<div
			ref="terminalEl"
			data-cy="terminal"
			class="px-16 py-16 h-400 overflow-y-auto text-sm leading-relaxed scrollbar-styled">
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
				<div
					data-cy="history-cmd"
					class="text-bright-primary">
					$ {{ entry.cmd }}
				</div>
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
								@click="emit('edit-doc', entry.documents!.collection, doc)">
								edit
							</button>
							<button
								type="button"
								data-cy="doc-del"
								class="btn-inline"
								@click="emit('delete-doc', entry.documents!.collection, JSON.parse(doc)._id.$oid)">
								del
							</button>
						</div>
						<pre class="text-surface/80 text-xs whitespace-pre-wrap wrap-break-word">{{ doc }}</pre>
					</div>
				</div>
			</div>

			<div
				v-if="hasCommand"
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
					:class="isDanger ? 'btn-danger' : 'btn-submit'"
					:disabled="!canSubmit || running"
					@click="emit('submit')">
					{{ running ? 'running…' : 'submit' }}
				</button>
			</div>
		</div>
		<button
			type="button"
			class="bg-white/60 hover:bg-white hover:border-white border border-white/90 text-black absolute top-10 right-15 py-2 px-6 rounded-sm hover:cursor-pointer transition-all"
			@click="emit('clear-history')">
			clear
		</button>
	</div>
</template>

