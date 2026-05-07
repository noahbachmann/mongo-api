import MongoCLI from '../../src/components/MongoCLI.vue'
import { useCurrentDb } from '../../src/composables/useCurrentDb'

const dbList = [{ name: 'project' }, { name: 'admin' }]
const collList = [{ name: 'users' }, { name: 'posts' }]
const sampleDocs = {
	documents: [
		{ _id: 'abc1', name: 'Alice', age: 30 },
		{ _id: 'abc2', name: 'Bob', age: 25 },
	],
}

function mountCLI() {
	cy.mount(MongoCLI)
	cy.wait('@listDbs')
	cy.wait('@listCollections')
}

function selectCollection(name: string) {
	cy.get('[data-cy="current-coll"]').select(name)
}

beforeEach(() => {
	useCurrentDb().value = 'project'
	cy.intercept('GET', '**/api/db', { body: dbList }).as('listDbs')
	cy.intercept('GET', '**/api/collection?db=*', { body: collList }).as('listCollections')
})

describe('initial rendering', () => {
	it('renders the terminal header with mongo-cli label', () => {
		mountCLI()
		cy.contains('mongo-cli').should('be.visible')
	})

	it('shows empty state message when no history', () => {
		mountCLI()
		cy.get('[data-cy="empty-state"]').should('contain', 'Pick a command below')
	})

	it('calls listDbs and listCollections on mount', () => {
		mountCLI()
		cy.get('@listDbs.all').should('have.length', 1)
		cy.get('@listCollections.all').should('have.length', 1)
	})

	it('populates DB dropdown with fetched databases', () => {
		mountCLI()
		cy.get('[data-cy="current-db"]').find('option').should('have.length', 3)
		cy.get('[data-cy="current-db"]').find('option').eq(1).should('have.text', 'project')
	})

	it('populates collection dropdown after collections load', () => {
		mountCLI()
		cy.get('[data-cy="current-coll"]').find('option').should('have.length', 3)
	})

	it('has "project" pre-selected in DB dropdown', () => {
		mountCLI()
		cy.get('[data-cy="current-db"]').should('have.value', 'project')
	})
})

describe('show dbs', () => {
	it('stages command and shows preview when clicked', () => {
		mountCLI()
		cy.get('[data-cy="show-dbs-btn"]').click()
		cy.get('[data-cy="cmd-preview"]').should('contain', 'show dbs')
	})

	it('shows the submit button after staging', () => {
		mountCLI()
		cy.get('[data-cy="show-dbs-btn"]').click()
		cy.get('[data-cy="submit-btn"]').should('be.visible')
	})

	it('submits and shows result in history', () => {
		mountCLI()
		cy.intercept('GET', '**/api/db', { body: dbList }).as('showDbs')
		cy.get('[data-cy="show-dbs-btn"]').click()
		cy.get('[data-cy="submit-btn"]').click()
		cy.wait('@showDbs')
		cy.get('[data-cy="history-entry"]').should('have.length.at.least', 1)
		cy.get('[data-cy="history-cmd"]').first().should('contain', 'show dbs')
	})
})

describe('create db', () => {
	it('stage button is disabled when dbName is empty', () => {
		mountCLI()
		cy.get('[data-cy="create-db-stage"]').should('be.disabled')
	})

	it('stage button is disabled when collectionName is empty', () => {
		mountCLI()
		cy.get('[data-cy="create-db-name"]').type('newdb')
		cy.get('[data-cy="create-db-stage"]').should('be.disabled')
	})

	it('stage button is enabled when both fields are filled', () => {
		mountCLI()
		cy.get('[data-cy="create-db-name"]').type('newdb')
		cy.get('[data-cy="create-db-coll"]').type('newcoll')
		cy.get('[data-cy="create-db-stage"]').should('not.be.disabled')
	})

	it('stages with correct preview', () => {
		mountCLI()
		cy.get('[data-cy="create-db-name"]').should('not.be.disabled').type('newdb')
		cy.get('[data-cy="create-db-coll"]').type('newcoll')
		cy.get('[data-cy="create-db-stage"]').click()
		cy.get('[data-cy="cmd-preview"]').should('contain', 'use newdb')
		cy.get('[data-cy="cmd-preview"]').should('contain', 'createCollection("newcoll")')
	})

	it('Enter in dbName input stages the command', () => {
		mountCLI()
		cy.get('[data-cy="create-db-name"]').type('newdb')
		cy.get('[data-cy="create-db-coll"]').type('newcoll')
		cy.get('[data-cy="create-db-name"]').type('{enter}')
		cy.get('[data-cy="cmd-preview"]').should('contain', 'use newdb')
	})

	it('on successful submit, clears input fields and refreshes dbs', () => {
		cy.intercept('POST', '**/api/collection/newcoll?db=newdb', { body: {} }).as('createDb')
		mountCLI()
		cy.intercept('GET', '**/api/db', { body: [...dbList, { name: 'newdb' }] }).as('refreshDbs')
		cy.get('[data-cy="create-db-name"]').type('newdb')
		cy.get('[data-cy="create-db-coll"]').type('newcoll')
		cy.get('[data-cy="create-db-stage"]').click()
		cy.get('[data-cy="submit-btn"]').click()
		cy.wait('@createDb')
		cy.get('[data-cy="create-db-name"]').should('have.value', '')
	})
})

describe('drop db', () => {
	it('populates dropdown with fetched databases', () => {
		mountCLI()
		cy.get('[data-cy="drop-db-select"]').find('option').should('have.length', 3)
	})

	it('auto-stages drop command when a DB is selected', () => {
		mountCLI()
		cy.get('[data-cy="drop-db-select"]').select('admin')
		cy.get('[data-cy="cmd-preview"]').should('contain', 'dropDatabase()')
	})

	it('shows danger-styled submit button', () => {
		mountCLI()
		cy.get('[data-cy="drop-db-select"]').select('admin')
		cy.get('[data-cy="submit-btn"]').should('have.class', 'btn-danger')
	})

	it('on success clears currentDb if dropped db was current', () => {
		cy.intercept('DELETE', '**/api/db/project', { body: {} }).as('dropDb')
		mountCLI()
		cy.intercept('GET', '**/api/db', { body: [{ name: 'admin' }] }).as('refreshDbs')
		cy.get('[data-cy="drop-db-select"]').select('project')
		cy.get('[data-cy="submit-btn"]').click()
		cy.wait('@dropDb')
		cy.get('[data-cy="current-db"]').should('have.value', '')
	})
})

describe('current database dropdown', () => {
	it('changing the dropdown refreshes collections', () => {
		cy.intercept('GET', '**/api/collection?db=admin', { body: [{ name: 'logs' }] }).as('adminCollections')
		mountCLI()
		cy.get('[data-cy="current-db"]').select('admin')
		cy.wait('@adminCollections')
	})

	it('selecting empty clears collections', () => {
		mountCLI()
		cy.get('[data-cy="current-db"]').select('')
		cy.get('[data-cy="current-coll"]').should('be.disabled')
	})

	it('clears staged non-db command when DB changes', () => {
		mountCLI()
		cy.get('[data-cy="show-colls-btn"]').click()
		cy.get('[data-cy="cmd-preview"]').should('exist')
		cy.intercept('GET', '**/api/collection?db=admin', { body: collList }).as('adminColls')
		cy.get('[data-cy="current-db"]').select('admin')
		cy.get('[data-cy="cmd-preview"]').should('not.exist')
	})
})

describe('show collections', () => {
	it('button is disabled when no DB selected', () => {
		mountCLI()
		cy.get('[data-cy="current-db"]').select('')
		cy.get('[data-cy="show-colls-btn"]').should('be.disabled')
	})

	it('stages and submits correctly', () => {
		mountCLI()
		cy.intercept('GET', '**/api/collection?db=*', { body: collList }).as('showColls')
		cy.get('[data-cy="show-colls-btn"]').click()
		cy.get('[data-cy="cmd-preview"]').should('contain', 'show collections')
		cy.get('[data-cy="submit-btn"]').click()
		cy.wait('@showColls')
		cy.get('[data-cy="history-cmd"]').last().should('contain', 'show collections')
	})
})

describe('create collection', () => {
	it('stage button is disabled when no DB or empty input', () => {
		mountCLI()
		cy.get('[data-cy="create-coll-stage"]').should('be.disabled')
	})

	it('Enter in input stages command', () => {
		mountCLI()
		cy.get('[data-cy="create-coll-input"]').type('newcoll{enter}')
		cy.get('[data-cy="cmd-preview"]').should('contain', 'createCollection("newcoll")')
	})

	it('on success clears input and refreshes collections', () => {
		cy.intercept('POST', '**/api/collection/newcoll?db=*', { body: {} }).as('createColl')
		mountCLI()
		cy.intercept('GET', '**/api/collection?db=*', { body: [...collList, { name: 'newcoll' }] }).as('refreshColls')
		cy.get('[data-cy="create-coll-input"]').type('newcoll{enter}')
		cy.get('[data-cy="submit-btn"]').click()
		cy.wait('@createColl')
		cy.get('[data-cy="create-coll-input"]').should('have.value', '')
	})
})

describe('drop collection', () => {
	it('dropdown is disabled when no DB selected', () => {
		mountCLI()
		cy.get('[data-cy="current-db"]').select('')
		cy.get('[data-cy="drop-coll-select"]').should('be.disabled')
	})

	it('auto-stages on selection with danger styling', () => {
		mountCLI()
		cy.get('[data-cy="drop-coll-select"]').select('users')
		cy.get('[data-cy="cmd-preview"]').should('contain', 'dropCollection("users")')
		cy.get('[data-cy="submit-btn"]').should('have.class', 'btn-danger')
	})
})

describe('current collection dropdown', () => {
	it('is disabled when no DB selected', () => {
		mountCLI()
		cy.get('[data-cy="current-db"]').select('')
		cy.get('[data-cy="current-coll"]').should('be.disabled')
	})

	it('selecting a collection enables document operations', () => {
		mountCLI()
		selectCollection('users')
		cy.get('[data-cy="find-btn"]').should('not.be.disabled')
	})
})

describe('find documents', () => {
	it('find button is disabled when no collection selected', () => {
		mountCLI()
		cy.get('[data-cy="find-btn"]').should('be.disabled')
	})

	it('stages show-documents with correct preview', () => {
		mountCLI()
		selectCollection('users')
		cy.get('[data-cy="find-btn"]').click()
		cy.get('[data-cy="cmd-preview"]').should('contain', 'db.users.find')
		cy.get('[data-cy="cmd-preview"]').should('contain', 'limit(50)')
	})

	it('uses filter value in preview', () => {
		mountCLI()
		selectCollection('users')
		cy.get('[data-cy="docs-filter"]').type('{"age": 30}', { parseSpecialCharSequences: false })
		cy.get('[data-cy="find-btn"]').click()
		cy.get('[data-cy="cmd-preview"]').should('contain', '{"age": 30}')
	})

	it('renders document cards with edit/del buttons', () => {
		cy.intercept('GET', '**/api/collection/users/documents?*', { body: sampleDocs }).as('findDocs')
		mountCLI()
		selectCollection('users')
		cy.get('[data-cy="find-btn"]').click()
		cy.get('[data-cy="submit-btn"]').click()
		cy.wait('@findDocs')
		cy.get('[data-cy="doc-card"]').should('have.length', 2)
		cy.get('[data-cy="doc-edit"]').should('have.length', 2)
		cy.get('[data-cy="doc-del"]').should('have.length', 2)
	})

	it('shows "(no documents)" for empty results', () => {
		cy.intercept('GET', '**/api/collection/users/documents?*', { body: { documents: [] } }).as('findEmpty')
		mountCLI()
		selectCollection('users')
		cy.get('[data-cy="find-btn"]').click()
		cy.get('[data-cy="submit-btn"]').click()
		cy.wait('@findEmpty')
		cy.contains('(no documents)').should('be.visible')
	})

	it('limit and skip inputs have correct defaults', () => {
		mountCLI()
		cy.get('[data-cy="docs-limit"]').should('have.value', '50')
		cy.get('[data-cy="docs-skip"]').should('have.value', '0')
	})

	it('uses custom skip and limit in preview', () => {
		mountCLI()
		selectCollection('users')
		cy.get('[data-cy="docs-limit"]').clear().type('10')
		cy.get('[data-cy="docs-skip"]').clear().type('5')
		cy.get('[data-cy="find-btn"]').click()
		cy.get('[data-cy="cmd-preview"]').should('contain', 'limit(10)')
		cy.get('[data-cy="cmd-preview"]').should('contain', 'skip(5)')
	})
})

describe('insert document', () => {
	it('insert button is disabled when no collection selected', () => {
		mountCLI()
		cy.get('[data-cy="insert-btn"]').should('be.disabled')
	})

	it('insert button is disabled when jsonInput is empty', () => {
		mountCLI()
		selectCollection('users')
		cy.get('[data-cy="insert-btn"]').should('be.disabled')
	})

	it('insert button is enabled when collection + jsonInput present', () => {
		mountCLI()
		selectCollection('users')
		cy.get('[data-cy="json-input"]').type('{"name": "test"}', { parseSpecialCharSequences: false })
		cy.get('[data-cy="insert-btn"]').should('not.be.disabled')
	})

	it('stages insert with preview showing snippet', () => {
		mountCLI()
		selectCollection('users')
		cy.get('[data-cy="json-input"]').type('{"name": "test"}', { parseSpecialCharSequences: false })
		cy.get('[data-cy="insert-btn"]').click()
		cy.get('[data-cy="cmd-preview"]').should('contain', 'insertOne')
	})

	it('on valid JSON submit, clears jsonInput', () => {
		cy.intercept('POST', '**/api/collection/users/documents?*', { body: { insertedId: '123' } }).as('insertDoc')
		cy.intercept('GET', '**/api/collection/users/documents?*', { body: { documents: [] } }).as('refreshDocs')
		mountCLI()
		selectCollection('users')
		cy.get('[data-cy="json-input"]').type('{"name": "test"}', { parseSpecialCharSequences: false })
		cy.get('[data-cy="insert-btn"]').click()
		cy.get('[data-cy="submit-btn"]').click()
		cy.wait('@insertDoc')
		cy.get('[data-cy="json-input"]').should('have.value', '')
	})

	it('on invalid JSON, shows error and preserves staged command', () => {
		mountCLI()
		selectCollection('users')
		cy.get('[data-cy="json-input"]').type('not json')
		cy.get('[data-cy="insert-btn"]').click()
		cy.get('[data-cy="submit-btn"]').click()
		cy.get('[data-cy="history-output"]').last().should('contain', 'Invalid JSON')
		cy.get('[data-cy="cmd-preview"]').should('exist')
	})
})

describe('updateOne', () => {
	it('stages with filter and snippet preview', () => {
		mountCLI()
		selectCollection('users')
		cy.get('[data-cy="docs-filter"]').type('{"_id": "1"}', { parseSpecialCharSequences: false })
		cy.get('[data-cy="json-input"]').type('{"name": "updated"}', { parseSpecialCharSequences: false })
		cy.get('[data-cy="update-one-btn"]').click()
		cy.get('[data-cy="cmd-preview"]').should('contain', 'updateOne')
	})

	it('on success clears jsonInput and docsFilter', () => {
		cy.intercept('PATCH', '**/api/collection/users/documents/single?*', { body: {} }).as('updateDoc')
		cy.intercept('GET', '**/api/collection/users/documents?*', { body: { documents: [] } }).as('refreshDocs')
		mountCLI()
		selectCollection('users')
		cy.get('[data-cy="docs-filter"]').type('{"_id": "1"}', { parseSpecialCharSequences: false })
		cy.get('[data-cy="json-input"]').type('{"name": "updated"}', { parseSpecialCharSequences: false })
		cy.get('[data-cy="update-one-btn"]').click()
		cy.get('[data-cy="submit-btn"]').click()
		cy.wait('@updateDoc')
		cy.get('[data-cy="json-input"]').should('have.value', '')
		cy.get('[data-cy="docs-filter"]').should('have.value', '')
	})
})

describe('updateMany', () => {
	it('stages with correct preview', () => {
		mountCLI()
		selectCollection('users')
		cy.get('[data-cy="json-input"]').type('{"active": true}', { parseSpecialCharSequences: false })
		cy.get('[data-cy="update-many-btn"]').click()
		cy.get('[data-cy="cmd-preview"]').should('contain', 'updateMany')
	})

	it('on success clears jsonInput and docsFilter', () => {
		cy.intercept('PATCH', '**/api/collection/users/documents?*', { body: {} }).as('updateDocs')
		cy.intercept('GET', '**/api/collection/users/documents?*', { body: { documents: [] } }).as('refreshDocs')
		mountCLI()
		selectCollection('users')
		cy.get('[data-cy="docs-filter"]').type('{"role": "admin"}', { parseSpecialCharSequences: false })
		cy.get('[data-cy="json-input"]').type('{"active": true}', { parseSpecialCharSequences: false })
		cy.get('[data-cy="update-many-btn"]').click()
		cy.get('[data-cy="submit-btn"]').click()
		cy.wait('@updateDocs')
		cy.get('[data-cy="json-input"]').should('have.value', '')
		cy.get('[data-cy="docs-filter"]').should('have.value', '')
	})
})

describe('delete document', () => {
	beforeEach(() => {
		cy.intercept('GET', '**/api/collection/users/documents?*', { body: sampleDocs }).as('findDocs')
	})

	it('clicking del stages delete-document with _id', () => {
		mountCLI()
		selectCollection('users')
		cy.get('[data-cy="find-btn"]').click()
		cy.get('[data-cy="submit-btn"]').click()
		cy.wait('@findDocs')
		cy.get('[data-cy="doc-del"]').first().click()
		cy.get('[data-cy="cmd-preview"]').should('contain', 'deleteOne')
		cy.get('[data-cy="cmd-preview"]').should('contain', 'abc1')
	})

	it('shows danger-styled submit button', () => {
		mountCLI()
		selectCollection('users')
		cy.get('[data-cy="find-btn"]').click()
		cy.get('[data-cy="submit-btn"]').click()
		cy.wait('@findDocs')
		cy.get('[data-cy="doc-del"]').first().click()
		cy.get('[data-cy="submit-btn"]').should('have.class', 'btn-danger')
	})

	it('on success refreshes documents', () => {
		cy.intercept('DELETE', '**/api/collection/users/documents/abc1?db=*', { body: {} }).as('deleteDoc')
		mountCLI()
		selectCollection('users')
		cy.get('[data-cy="find-btn"]').click()
		cy.get('[data-cy="submit-btn"]').click()
		cy.wait('@findDocs')
		cy.get('[data-cy="doc-del"]').first().click()
		cy.get('[data-cy="submit-btn"]').click()
		cy.wait('@deleteDoc')
		cy.get('[data-cy="history-entry"]').should('have.length.at.least', 2)
	})
})

describe('edit document flow', () => {
	beforeEach(() => {
		cy.intercept('GET', '**/api/collection/users/documents?*', { body: sampleDocs }).as('findDocs')
	})

	it('clicking edit populates filter and jsonInput, stages update', () => {
		mountCLI()
		selectCollection('users')
		cy.get('[data-cy="find-btn"]').click()
		cy.get('[data-cy="submit-btn"]').click()
		cy.wait('@findDocs')
		cy.get('[data-cy="doc-edit"]').first().click()
		cy.get('[data-cy="docs-filter"]').should('contain.value', '"_id"')
		cy.get('[data-cy="docs-filter"]').should('contain.value', 'abc1')
		cy.get('[data-cy="json-input"]').should('contain.value', 'Alice')
		cy.get('[data-cy="cmd-preview"]').should('contain', 'updateOne')
	})

	it('jsonInput does not include _id field', () => {
		mountCLI()
		selectCollection('users')
		cy.get('[data-cy="find-btn"]').click()
		cy.get('[data-cy="submit-btn"]').click()
		cy.wait('@findDocs')
		cy.get('[data-cy="doc-edit"]').first().click()
		cy.get('[data-cy="json-input"]').should('not.contain.value', '_id')
	})
})

describe('submit button behavior', () => {
	it('is not visible when no command is staged', () => {
		mountCLI()
		cy.get('[data-cy="submit-btn"]').should('not.exist')
	})

	it('text is "submit" normally', () => {
		mountCLI()
		cy.get('[data-cy="show-dbs-btn"]').click()
		cy.get('[data-cy="submit-btn"]').should('contain', 'submit')
	})

	it('is disabled when canSubmit is false (needsCurrentDb but no DB)', () => {
		mountCLI()
		cy.get('[data-cy="current-db"]').select('')
		cy.get('[data-cy="show-colls-btn"]').should('be.disabled')
	})

	it('has btn-submit class for normal commands', () => {
		mountCLI()
		cy.get('[data-cy="show-dbs-btn"]').click()
		cy.get('[data-cy="submit-btn"]').should('have.class', 'btn-submit')
	})

	it('has btn-danger class for danger commands', () => {
		mountCLI()
		cy.get('[data-cy="drop-db-select"]').select('admin')
		cy.get('[data-cy="submit-btn"]').should('have.class', 'btn-danger')
	})
})

describe('command preview', () => {
	it('shows preview text with $ prefix', () => {
		mountCLI()
		cy.get('[data-cy="show-dbs-btn"]').click()
		cy.get('[data-cy="cmd-preview"]').should('contain', '$ show dbs')
	})

	it('preview disappears after Escape', () => {
		mountCLI()
		cy.get('[data-cy="show-dbs-btn"]').click()
		cy.get('[data-cy="cmd-preview"]').should('exist')
		cy.get('body').type('{esc}')
		cy.get('[data-cy="cmd-preview"]').should('not.exist')
	})
})

describe('history entries', () => {
	it('successful output is shown in surface/90 color', () => {
		mountCLI()
		cy.intercept('GET', '**/api/db', { body: dbList }).as('showDbs')
		cy.get('[data-cy="show-dbs-btn"]').click()
		cy.get('[data-cy="submit-btn"]').click()
		cy.wait('@showDbs')
		cy.get('[data-cy="history-output"]').first().should('not.have.class', 'text-accent')
	})

	it('error output is shown in accent color', () => {
		mountCLI()
		cy.intercept('GET', '**/api/db', { statusCode: 500, body: '' }).as('failDbs')
		cy.get('[data-cy="show-dbs-btn"]').click()
		cy.get('[data-cy="submit-btn"]').click()
		cy.wait('@failDbs')
		cy.get('[data-cy="history-output"]').last().should('have.class', 'text-accent')
	})

	it('multiple commands accumulate in history', () => {
		mountCLI()
		cy.intercept('GET', '**/api/db', { body: dbList }).as('showDbs2')
		cy.get('[data-cy="show-dbs-btn"]').click()
		cy.get('[data-cy="submit-btn"]').click()
		cy.wait('@showDbs2')
		cy.get('[data-cy="show-dbs-btn"]').click()
		cy.get('[data-cy="submit-btn"]').click()
		cy.wait('@showDbs2')
		cy.get('[data-cy="history-entry"]').should('have.length', 2)
	})

	it('empty state disappears once history has entries', () => {
		mountCLI()
		cy.intercept('GET', '**/api/db', { body: dbList }).as('showDbs3')
		cy.get('[data-cy="empty-state"]').should('exist')
		cy.get('[data-cy="show-dbs-btn"]').click()
		cy.get('[data-cy="submit-btn"]').click()
		cy.wait('@showDbs3')
		cy.get('[data-cy="empty-state"]').should('not.exist')
	})
})

describe('keyboard shortcuts', () => {
	it('Enter submits staged command when pressed outside form fields', () => {
		mountCLI()
		cy.intercept('GET', '**/api/db', { body: dbList }).as('enterSubmit')
		cy.get('[data-cy="show-dbs-btn"]').click()
		cy.get('body').type('{enter}')
		cy.wait('@enterSubmit')
		cy.get('[data-cy="history-entry"]').should('have.length', 1)
	})

	it('Ctrl+Enter submits from within a form field', () => {
		mountCLI()
		cy.intercept('GET', '**/api/db', { body: dbList }).as('ctrlEnterSubmit')
		cy.get('[data-cy="show-dbs-btn"]').click()
		cy.get('[data-cy="create-db-name"]').type('shortcuts')
		cy.get('[data-cy="create-db-coll"]').type('shortcutColl{ctrl+enter}')
		cy.wait('@ctrlEnterSubmit')
		cy.get('[data-cy="history-entry"]').should('have.length', 1)
	})

	it('Escape cancels the staged command', () => {
		mountCLI()
		cy.get('[data-cy="show-dbs-btn"]').click()
		cy.get('[data-cy="cmd-preview"]').should('exist')
		cy.get('body').type('{esc}')
		cy.get('[data-cy="cmd-preview"]').should('not.exist')
		cy.get('[data-cy="submit-btn"]').should('not.exist')
	})

	it('Escape clears dropdown targets', () => {
		mountCLI()
		cy.get('[data-cy="drop-db-select"]').select('admin')
		cy.get('[data-cy="cmd-preview"]').should('exist')
		cy.get('body').type('{esc}')
		cy.get('[data-cy="drop-db-select"]').should('have.value', '')
	})
})

describe('disabled states', () => {
	describe('when no DB is selected', () => {
		beforeEach(() => {
			mountCLI()
			cy.get('[data-cy="current-db"]').select('')
		})

		it('show collections button is disabled', () => {
			cy.get('[data-cy="show-colls-btn"]').should('be.disabled')
		})

		it('create collection stage button is disabled', () => {
			cy.get('[data-cy="create-coll-stage"]').should('be.disabled')
		})

		it('drop collection dropdown is disabled', () => {
			cy.get('[data-cy="drop-coll-select"]').should('be.disabled')
		})

		it('collection selector is disabled', () => {
			cy.get('[data-cy="current-coll"]').should('be.disabled')
		})

		it('find button is disabled', () => {
			cy.get('[data-cy="find-btn"]').should('be.disabled')
		})

		it('insert button is disabled', () => {
			cy.get('[data-cy="insert-btn"]').should('be.disabled')
		})

		it('updateOne button is disabled', () => {
			cy.get('[data-cy="update-one-btn"]').should('be.disabled')
		})

		it('updateMany button is disabled', () => {
			cy.get('[data-cy="update-many-btn"]').should('be.disabled')
		})
	})

	describe('when DB selected but no collection', () => {
		it('find button is disabled', () => {
			mountCLI()
			cy.get('[data-cy="find-btn"]').should('be.disabled')
		})

		it('document operation buttons are disabled', () => {
			mountCLI()
			cy.get('[data-cy="insert-btn"]').should('be.disabled')
			cy.get('[data-cy="update-one-btn"]').should('be.disabled')
			cy.get('[data-cy="update-many-btn"]').should('be.disabled')
		})
	})
})

describe('error handling', () => {
	it('shows API error in accent color', () => {
		mountCLI()
		cy.intercept('GET', '**/api/db', { statusCode: 500, body: '' }).as('failDbs')
		cy.get('[data-cy="show-dbs-btn"]').click()
		cy.get('[data-cy="submit-btn"]').click()
		cy.wait('@failDbs')
		cy.get('[data-cy="history-output"]').last().should('have.class', 'text-accent')
		cy.get('[data-cy="history-output"]').last().should('contain', '500')
	})

	it('insert with invalid JSON shows error but preserves command', () => {
		mountCLI()
		selectCollection('users')
		cy.get('[data-cy="json-input"]').type('not json')
		cy.get('[data-cy="insert-btn"]').click()
		cy.get('[data-cy="submit-btn"]').click()
		cy.get('[data-cy="history-output"]').last().should('contain', 'Invalid JSON')
		cy.get('[data-cy="cmd-preview"]').should('exist')
	})
})

describe('watcher behavior (currentDb)', () => {
	it('does NOT clear staged show-dbs command when currentDb changes', () => {
		mountCLI()
		cy.get('[data-cy="show-dbs-btn"]').click()
		cy.get('[data-cy="cmd-preview"]').should('contain', 'show dbs')
		cy.intercept('GET', '**/api/collection?db=admin', { body: collList }).as('adminColls')
		cy.get('[data-cy="current-db"]').select('admin')
		cy.get('[data-cy="cmd-preview"]').should('contain', 'show dbs')
	})

	it('clears staged show-collections command when currentDb changes', () => {
		mountCLI()
		cy.get('[data-cy="show-colls-btn"]').click()
		cy.get('[data-cy="cmd-preview"]').should('contain', 'show collections')
		cy.intercept('GET', '**/api/collection?db=admin', { body: collList }).as('adminColls')
		cy.get('[data-cy="current-db"]').select('admin')
		cy.get('[data-cy="cmd-preview"]').should('not.exist')
	})
})

describe('full CRUD workflow', () => {
	it('create DB -> create collection -> insert -> find -> edit -> delete', () => {
		const newDbDocs = { documents: [{ _id: 'new1', title: 'Hello', body: 'World' }] }

		cy.intercept('POST', '**/api/collection/articles?db=blog', { body: {} }).as('createBlogDb')
		mountCLI()

		// Create DB
		cy.get('[data-cy="create-db-name"]').should('not.be.disabled').type('blog')
		cy.get('[data-cy="create-db-coll"]').type('articles')
		cy.get('[data-cy="create-db-stage"]').click()
		cy.intercept('GET', '**/api/db', { body: [...dbList, { name: 'blog' }] }).as('refreshAfterCreate')
		cy.intercept('GET', '**/api/collection?db=blog', { body: [{ name: 'articles' }] }).as('blogColls')
		cy.get('[data-cy="submit-btn"]').click()
		cy.wait('@createBlogDb')
		cy.wait('@refreshAfterCreate')

		// Select collection
		cy.get('[data-cy="current-coll"]').select('articles')

		// Insert document
		cy.get('[data-cy="json-input"]').type('{"title": "Hello", "body": "World"}', {
			parseSpecialCharSequences: false,
		})
		cy.intercept('POST', '**/api/collection/articles/documents?db=blog', { body: { insertedId: 'new1' } }).as(
			'insertArticle',
		)
		cy.intercept('GET', '**/api/collection/articles/documents?*', { body: newDbDocs }).as('refreshAfterInsert')
		cy.get('[data-cy="insert-btn"]').click()
		cy.get('[data-cy="submit-btn"]').click()
		cy.wait('@insertArticle')
		cy.get('[data-cy="doc-card"]').should('have.length', 1)

		// Edit document
		cy.get('[data-cy="doc-edit"]').first().click()
		cy.get('[data-cy="docs-filter"]').should('contain.value', 'new1')
		cy.get('[data-cy="json-input"]').should('contain.value', 'Hello')
		cy.get('[data-cy="cmd-preview"]').should('contain', 'updateOne')

		// Delete document
		cy.get('body').type('{esc}')
		cy.get('[data-cy="find-btn"]').click()
		cy.intercept('GET', '**/api/collection/articles/documents?*', { body: newDbDocs }).as('findAgain')
		cy.get('[data-cy="submit-btn"]').click()
		cy.wait('@findAgain')
		cy.intercept('DELETE', '**/api/collection/articles/documents/new1?db=blog', { body: {} }).as('deleteArticle')
		cy.intercept('GET', '**/api/collection/articles/documents?*', {
			body: { documents: [] },
		}).as('afterDelete')
		cy.get('[data-cy="doc-del"]').first().click()
		cy.get('[data-cy="submit-btn"]').click()
		cy.wait('@deleteArticle')
	})
})

