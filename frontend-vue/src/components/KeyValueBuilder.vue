<script setup lang="ts">
	const props = defineProps<{
		modelValue: Array<{ key: string; value: string }>
		disabled?: boolean
	}>()

	const emit = defineEmits<{
		'update:modelValue': [value: Array<{ key: string; value: string }>]
	}>()

	function addPair() {
		emit('update:modelValue', [...props.modelValue, { key: '', value: '' }])
	}

	function removePair(index: number) {
		const updated = props.modelValue.filter((_, i) => i !== index)
		emit('update:modelValue', updated.length ? updated : [{ key: '', value: '' }])
	}

	function updateKey(index: number, key: string) {
		emit(
			'update:modelValue',
			props.modelValue.map((p, i) => (i === index ? { ...p, key } : p)),
		)
	}

	function updateValue(index: number, value: string) {
		emit(
			'update:modelValue',
			props.modelValue.map((p, i) => (i === index ? { ...p, value } : p)),
		)
	}
</script>

<template>
	<div class="flex flex-col gap-4">
		<div
			v-for="(pair, i) in modelValue"
			:key="i"
			class="flex max-sm:flex-col sm:items-center gap-6">
			<input
				:value="pair.key"
				:disabled="disabled"
				placeholder="key"
				class="input-cli sm:w-120"
				@input="updateKey(i, ($event.target as HTMLInputElement).value)" />
			<input
				:value="pair.value"
				:disabled="disabled"
				placeholder="value"
				class="input-cli flex-1"
				@input="updateValue(i, ($event.target as HTMLInputElement).value)" />
			<button
				type="button"
				class="rounded-sm border border-accent hover:bg-accent text-accent hover:text-secondary hover:cursor-pointer size-16 sm:size-20 font-bold transition-all"
				:disabled="disabled"
				@click="removePair(i)">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="2"
					stroke="currentColor">
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						d="M6 18 18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
		<button
			type="button"
			class="btn-inline self-start"
			:disabled="disabled"
			@click="addPair">
			+ add pair
		</button>
	</div>
</template>

