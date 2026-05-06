import { ref } from 'vue'

const currentDb = ref('project')

export function useCurrentDb() {
	return currentDb
}
