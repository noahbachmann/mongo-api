import {
	dbList,
	collList,
	sampleDocs,
	setupDefaultIntercepts,
	mountApp,
	selectCrudCollection,
	goToCrud,
	typePair,
} from './helpers'

beforeEach(() => {
	setupDefaultIntercepts()
})

describe('CrudPage initial state', () => {
	it('db dropdown is populated with fetched databases', () => {
		mountApp()
		goToCrud()
		cy.get('[data-cy="crud-db-select"]').find('option').should('have.length', 3)
		cy.get('[data-cy="crud-db-select"]').should('have.value', 'project')
	})

	it('collection dropdown is disabled when no collections loaded', () => {
		cy.intercept('GET', '**/api/collection?db=*', { body: [] }).as('listCollections')
		mountApp()
		goToCrud()
		cy.get('[data-cy="crud-coll-select"]').should('be.disabled')
	})

	it('operation buttons are disabled when no collection selected', () => {
		mountApp()
		goToCrud()
		cy.get('[data-cy="crud-find-btn"]').should('be.disabled')
		cy.get('[data-cy="crud-insert-btn"]').should('be.disabled')
		cy.get('[data-cy="crud-update-one-btn"]').should('be.disabled')
		cy.get('[data-cy="crud-update-many-btn"]').should('be.disabled')
		cy.get('[data-cy="crud-delete-one-btn"]').should('be.disabled')
		cy.get('[data-cy="crud-delete-many-btn"]').should('be.disabled')
	})
})

describe('CrudPage collection selection', () => {
	it('selecting a collection enables find and deleteMany', () => {
		mountApp()
		goToCrud()
		selectCrudCollection('users')
		cy.get('[data-cy="crud-find-btn"]').should('not.be.disabled')
		cy.get('[data-cy="crud-delete-many-btn"]').should('not.be.disabled')
	})

	it('clearing db disables collection selector', () => {
		mountApp()
		goToCrud()
		cy.get('[data-cy="crud-db-select"]').select('')
		cy.get('[data-cy="crud-coll-select"]').should('be.disabled')
	})
})

describe('KeyValueBuilder interaction', () => {
	beforeEach(() => {
		mountApp()
		goToCrud()
		selectCrudCollection('users')
	})

	it('filter starts with one empty pair', () => {
		cy.get('[data-cy="crud-filter"]').find('[data-cy="kv-row"]').should('have.length', 1)
		cy.get('[data-cy="crud-filter"]').find('[data-cy="kv-key"]').first().should('have.value', '')
	})

	it('body starts with one empty pair', () => {
		cy.get('[data-cy="crud-body"]').find('[data-cy="kv-row"]').should('have.length', 1)
		cy.get('[data-cy="crud-body"]').find('[data-cy="kv-key"]').first().should('have.value', '')
	})

	it('add pair creates a new row', () => {
		cy.get('[data-cy="crud-body"]').find('[data-cy="kv-add"]').click()
		cy.get('[data-cy="crud-body"]').find('[data-cy="kv-row"]').should('have.length', 2)
	})

	it('remove pair reduces row count', () => {
		cy.get('[data-cy="crud-body"]').find('[data-cy="kv-add"]').click()
		cy.get('[data-cy="crud-body"]').find('[data-cy="kv-row"]').should('have.length', 2)
		cy.get('[data-cy="crud-body"]').find('[data-cy="kv-remove"]').first().click()
		cy.get('[data-cy="crud-body"]').find('[data-cy="kv-row"]').should('have.length', 1)
	})

	it('removing the last pair resets to one empty pair', () => {
		cy.get('[data-cy="crud-body"]').find('[data-cy="kv-remove"]').first().click()
		cy.get('[data-cy="crud-body"]').find('[data-cy="kv-row"]').should('have.length', 1)
		cy.get('[data-cy="crud-body"]').find('[data-cy="kv-key"]').first().should('have.value', '')
	})

	it('can type into key and value inputs', () => {
		typePair('crud-body', 0, 'name', 'Alice')
		cy.get('[data-cy="crud-body"]').find('[data-cy="kv-key"]').first().should('have.value', 'name')
		cy.get('[data-cy="crud-body"]').find('[data-cy="kv-value"]').first().should('have.value', 'Alice')
	})
})

describe('CrudPage find', () => {
	it('find is enabled when db and collection are selected', () => {
		mountApp()
		goToCrud()
		selectCrudCollection('users')
		cy.get('[data-cy="crud-find-btn"]').should('not.be.disabled')
	})

	it('stages show-documents with default empty filter', () => {
		mountApp()
		goToCrud()
		selectCrudCollection('users')
		cy.get('[data-cy="crud-find-btn"]').click()
		cy.get('[data-cy="cmd-preview"]').should('contain', 'db.users.find')
		cy.get('[data-cy="cmd-preview"]').should('contain', 'limit(50)')
	})

	it('stages show-documents with filter from pairs', () => {
		mountApp()
		goToCrud()
		selectCrudCollection('users')
		typePair('crud-filter', 0, 'age', '30')
		cy.get('[data-cy="crud-find-btn"]').click()
		cy.get('[data-cy="cmd-preview"]').should('contain', 'age')
	})

	it('submit returns and renders documents', () => {
		cy.intercept('GET', '**/api/collection/users/documents?*', { body: sampleDocs }).as('findDocs')
		mountApp()
		goToCrud()
		selectCrudCollection('users')
		cy.get('[data-cy="crud-find-btn"]').click()
		cy.get('[data-cy="submit-btn"]').click()
		cy.wait('@findDocs')
		cy.get('[data-cy="doc-card"]').should('have.length', 2)
	})
})

describe('CrudPage insert', () => {
	it('insert is disabled when body pairs are all empty', () => {
		mountApp()
		goToCrud()
		selectCrudCollection('users')
		cy.get('[data-cy="crud-insert-btn"]').should('be.disabled')
	})

	it('insert is enabled when body has a key-value pair', () => {
		mountApp()
		goToCrud()
		selectCrudCollection('users')
		typePair('crud-body', 0, 'name', 'Alice')
		cy.get('[data-cy="crud-insert-btn"]').should('not.be.disabled')
	})

	it('stages insert-document with correct preview', () => {
		mountApp()
		goToCrud()
		selectCrudCollection('users')
		typePair('crud-body', 0, 'name', 'Alice')
		cy.get('[data-cy="crud-insert-btn"]').click()
		cy.get('[data-cy="cmd-preview"]').should('contain', 'insertOne')
		cy.get('[data-cy="cmd-preview"]').should('contain', 'users')
	})
})

describe('CrudPage updateOne', () => {
	it('updateOne is disabled when body is empty', () => {
		mountApp()
		goToCrud()
		selectCrudCollection('users')
		cy.get('[data-cy="crud-update-one-btn"]').should('be.disabled')
	})

	it('stages update-document with filter and body', () => {
		mountApp()
		goToCrud()
		selectCrudCollection('users')
		typePair('crud-filter', 0, 'role', 'admin')
		typePair('crud-body', 0, 'active', 'true')
		cy.get('[data-cy="crud-update-one-btn"]').click()
		cy.get('[data-cy="cmd-preview"]').should('contain', 'updateOne')
	})
})

describe('CrudPage updateMany', () => {
	it('updateMany is disabled when body is empty', () => {
		mountApp()
		goToCrud()
		selectCrudCollection('users')
		cy.get('[data-cy="crud-update-many-btn"]').should('be.disabled')
	})

	it('stages update-documents with correct preview', () => {
		mountApp()
		goToCrud()
		selectCrudCollection('users')
		typePair('crud-body', 0, 'active', 'false')
		cy.get('[data-cy="crud-update-many-btn"]').click()
		cy.get('[data-cy="cmd-preview"]').should('contain', 'updateMany')
	})
})

describe('CrudPage deleteOne', () => {
	it('disabled when filter has no id key', () => {
		mountApp()
		goToCrud()
		selectCrudCollection('users')
		cy.get('[data-cy="crud-delete-one-btn"]').should('be.disabled')
	})

	it('enabled when filter has id key with value', () => {
		mountApp()
		goToCrud()
		selectCrudCollection('users')
		typePair('crud-filter', 0, 'id', 'abc1')
		cy.get('[data-cy="crud-delete-one-btn"]').should('not.be.disabled')
	})

	it('stages delete-document with id from filter', () => {
		mountApp()
		goToCrud()
		selectCrudCollection('users')
		typePair('crud-filter', 0, 'id', 'abc1')
		cy.get('[data-cy="crud-delete-one-btn"]').click()
		cy.get('[data-cy="cmd-preview"]').should('contain', 'deleteOne')
		cy.get('[data-cy="cmd-preview"]').should('contain', 'abc1')
	})

	it('has danger-styled submit button', () => {
		mountApp()
		goToCrud()
		selectCrudCollection('users')
		typePair('crud-filter', 0, 'id', 'abc1')
		cy.get('[data-cy="crud-delete-one-btn"]').click()
		cy.get('[data-cy="submit-btn"]').should('have.class', 'btn-danger')
	})
})

describe('CrudPage deleteMany', () => {
	it('enabled when filter has no id key', () => {
		mountApp()
		goToCrud()
		selectCrudCollection('users')
		cy.get('[data-cy="crud-delete-many-btn"]').should('not.be.disabled')
	})

	it('disabled when filter has an id key (mutually exclusive with deleteOne)', () => {
		mountApp()
		goToCrud()
		selectCrudCollection('users')
		typePair('crud-filter', 0, 'id', 'abc1')
		cy.get('[data-cy="crud-delete-many-btn"]').should('be.disabled')
	})

	it('stages delete-documents with filter', () => {
		mountApp()
		goToCrud()
		selectCrudCollection('users')
		typePair('crud-filter', 0, 'role', 'guest')
		cy.get('[data-cy="crud-delete-many-btn"]').click()
		cy.get('[data-cy="cmd-preview"]').should('contain', 'deleteMany')
	})

	it('has danger-styled submit button', () => {
		mountApp()
		goToCrud()
		selectCrudCollection('users')
		cy.get('[data-cy="crud-delete-many-btn"]').click()
		cy.get('[data-cy="submit-btn"]').should('have.class', 'btn-danger')
	})
})

describe('CrudPage edit document flow', () => {
	beforeEach(() => {
		cy.intercept('GET', '**/api/collection/users/documents?*', { body: sampleDocs }).as('findDocs')
	})

	it('clicking edit populates filter pairs with id', () => {
		mountApp()
		goToCrud()
		selectCrudCollection('users')
		cy.get('[data-cy="crud-find-btn"]').click()
		cy.get('[data-cy="submit-btn"]').click()
		cy.wait('@findDocs')
		cy.get('[data-cy="doc-edit"]').first().click()
		cy.get('[data-cy="crud-filter"]').find('[data-cy="kv-key"]').first().should('have.value', 'id')
		cy.get('[data-cy="crud-filter"]').find('[data-cy="kv-value"]').first().should('have.value', 'abc1')
	})

	it('clicking edit populates body pairs with document fields', () => {
		mountApp()
		goToCrud()
		selectCrudCollection('users')
		cy.get('[data-cy="crud-find-btn"]').click()
		cy.get('[data-cy="submit-btn"]').click()
		cy.wait('@findDocs')
		cy.get('[data-cy="doc-edit"]').first().click()
		cy.get('[data-cy="crud-body"]').find('[data-cy="kv-key"]').first().should('have.value', 'name')
		cy.get('[data-cy="crud-body"]').find('[data-cy="kv-value"]').first().should('have.value', 'Alice')
	})

	it('clicking edit does not include _id in body pairs', () => {
		mountApp()
		goToCrud()
		selectCrudCollection('users')
		cy.get('[data-cy="crud-find-btn"]').click()
		cy.get('[data-cy="submit-btn"]').click()
		cy.wait('@findDocs')
		cy.get('[data-cy="doc-edit"]').first().click()
		cy.get('[data-cy="crud-body"]')
			.find('[data-cy="kv-key"]')
			.each(($el) => {
				cy.wrap($el).should('not.have.value', '_id')
			})
	})

	it('after edit, clicking updateOne stages the command', () => {
		mountApp()
		goToCrud()
		selectCrudCollection('users')
		cy.get('[data-cy="crud-find-btn"]').click()
		cy.get('[data-cy="submit-btn"]').click()
		cy.wait('@findDocs')
		cy.get('[data-cy="doc-edit"]').first().click()
		cy.get('[data-cy="crud-update-one-btn"]').click()
		cy.get('[data-cy="cmd-preview"]').should('contain', 'updateOne')
	})
})

describe('CrudPage disabled states', () => {
	it('all buttons disabled when no db selected', () => {
		mountApp()
		goToCrud()
		cy.get('[data-cy="crud-db-select"]').select('')
		cy.get('[data-cy="crud-find-btn"]').should('be.disabled')
		cy.get('[data-cy="crud-insert-btn"]').should('be.disabled')
		cy.get('[data-cy="crud-update-one-btn"]').should('be.disabled')
		cy.get('[data-cy="crud-update-many-btn"]').should('be.disabled')
		cy.get('[data-cy="crud-delete-one-btn"]').should('be.disabled')
		cy.get('[data-cy="crud-delete-many-btn"]').should('be.disabled')
	})

	it('all buttons disabled when no collection selected', () => {
		mountApp()
		goToCrud()
		cy.get('[data-cy="crud-find-btn"]').should('be.disabled')
		cy.get('[data-cy="crud-insert-btn"]').should('be.disabled')
		cy.get('[data-cy="crud-delete-many-btn"]').should('be.disabled')
	})

	it('insert/update buttons disabled when body is empty', () => {
		mountApp()
		goToCrud()
		selectCrudCollection('users')
		cy.get('[data-cy="crud-insert-btn"]').should('be.disabled')
		cy.get('[data-cy="crud-update-one-btn"]').should('be.disabled')
		cy.get('[data-cy="crud-update-many-btn"]').should('be.disabled')
	})
})

