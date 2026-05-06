import { ref } from "vue";

export function useCurrentDb() {
	const currentDb = ref('project')

   function update(newDb: string){
      currentDb.value = newDb;
   }

   return { currentDb, update }
}
