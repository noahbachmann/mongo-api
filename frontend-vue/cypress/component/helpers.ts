import App from '../../src/App.vue'
import { useCurrentDb } from '../../src/composables/useCurrentDb'

export const dbList = [{ name: 'project' }, { name: 'admin' }]
export const collList = [{ name: 'users' }, { name: 'posts' }]
export const sampleDocs = {
	documents: [
		{ _id: { $oid: 'abc1' }, name: 'Alice', age: 30 },
		{ _id: { $oid: 'abc2' }, name: 'Bob', age: 25 },
	],
}

export function setupDefaultIntercepts() {
	useCurrentDb().value = 'project'
	cy.intercept('GET', '**/api/db', { body: dbList }).as('listDbs')
	cy.intercept('GET', '**/api/collection?db=*', { body: collList }).as('listCollections')
}

export function mountApp() {
	cy.mount(App)
	cy.wait('@listDbs')
	cy.wait('@listCollections')
}

export function selectGeneralCollection(name: string) {
	cy.get('[data-cy="current-coll"]').select(name)
}

export function selectCrudCollection(name: string) {
	cy.get('[data-cy="crud-coll-select"]').select(name)
}

export function goToCrud() {
	cy.get('[data-cy="tab-crud"]').click()
}

export function goToGeneral() {
	cy.get('[data-cy="tab-general"]').click()
}

export function typePair(container: string, index: number, key: string, value: string) {
	cy.get(`[data-cy="${container}"]`).find('[data-cy="kv-key"]').eq(index).clear().type(key)
	cy.get(`[data-cy="${container}"]`).find('[data-cy="kv-value"]').eq(index).clear().type(value)
}
