import { dbList, collList, setupDefaultIntercepts, mountApp, goToCrud, goToGeneral } from './helpers'

beforeEach(() => {
	setupDefaultIntercepts()
})

describe('tab navigation', () => {
	it('General tab is active by default', () => {
		mountApp()
		cy.get('[data-cy="tab-general"]').should('have.class', 'border-bright-primary!')
		cy.get('[data-cy="tab-crud"]').should('not.have.class', 'border-bright-primary!')
	})

	it('clicking CRUD tab shows CrudPage controls', () => {
		mountApp()
		goToCrud()
		cy.get('[data-cy="crud-find-btn"]').should('be.visible')
	})

	it('clicking CRUD tab hides GeneralPage controls', () => {
		mountApp()
		goToCrud()
		cy.get('[data-cy="show-dbs-btn"]').should('not.be.visible')
	})

	it('clicking General tab shows GeneralPage controls', () => {
		mountApp()
		goToCrud()
		goToGeneral()
		cy.get('[data-cy="show-dbs-btn"]').should('be.visible')
	})

	it('clicking General tab hides CrudPage controls', () => {
		mountApp()
		goToCrud()
		goToGeneral()
		cy.get('[data-cy="crud-find-btn"]').should('not.be.visible')
	})

	it('CRUD tab gets active styling when selected', () => {
		mountApp()
		goToCrud()
		cy.get('[data-cy="tab-crud"]').should('have.class', 'border-bright-primary!')
		cy.get('[data-cy="tab-general"]').should('not.have.class', 'border-bright-primary!')
	})
})

describe('keyboard shortcuts', () => {
	it('Enter submits staged command when pressed outside form fields', () => {
		mountApp()
		cy.intercept('GET', '**/api/db', { body: dbList }).as('enterSubmit')
		cy.get('[data-cy="show-dbs-btn"]').click()
		cy.get('body').type('{enter}')
		cy.wait('@enterSubmit')
		cy.get('[data-cy="history-entry"]').should('have.length', 1)
	})

	it('Ctrl+Enter submits from within a form field', () => {
		mountApp()
		cy.intercept('GET', '**/api/db', { body: dbList }).as('ctrlEnterSubmit')
		cy.get('[data-cy="show-dbs-btn"]').click()
		cy.get('[data-cy="create-db-name"]').type('shortcuts')
		cy.get('[data-cy="create-db-coll"]').type('shortcutColl{ctrl+enter}')
		cy.wait('@ctrlEnterSubmit')
		cy.get('[data-cy="history-entry"]').should('have.length', 1)
	})

	it('Escape cancels the staged command', () => {
		mountApp()
		cy.get('[data-cy="show-dbs-btn"]').click()
		cy.get('[data-cy="cmd-preview"]').should('exist')
		cy.get('body').type('{esc}')
		cy.get('[data-cy="cmd-preview"]').should('not.exist')
		cy.get('[data-cy="submit-btn"]').should('not.exist')
	})

	it('Escape clears dropdown targets', () => {
		mountApp()
		cy.get('[data-cy="drop-db-select"]').select('admin')
		cy.get('[data-cy="cmd-preview"]').should('exist')
		cy.get('body').type('{esc}')
		cy.get('[data-cy="drop-db-select"]').should('have.value', '')
	})
})

describe('shared terminal', () => {
	it('history persists when switching tabs', () => {
		mountApp()
		cy.intercept('GET', '**/api/db', { body: dbList }).as('showDbs')
		cy.get('[data-cy="show-dbs-btn"]').click()
		cy.get('[data-cy="submit-btn"]').click()
		cy.wait('@showDbs')
		cy.get('[data-cy="history-entry"]').should('have.length', 1)
		goToCrud()
		cy.get('[data-cy="history-entry"]').should('have.length', 1)
	})

	it('empty state is shown initially', () => {
		mountApp()
		cy.get('[data-cy="empty-state"]').should('contain', 'Pick a command below')
	})

	it('empty state disappears once history has entries', () => {
		mountApp()
		cy.intercept('GET', '**/api/db', { body: dbList }).as('showDbs')
		cy.get('[data-cy="empty-state"]').should('exist')
		cy.get('[data-cy="show-dbs-btn"]').click()
		cy.get('[data-cy="submit-btn"]').click()
		cy.wait('@showDbs')
		cy.get('[data-cy="empty-state"]').should('not.exist')
	})
})

describe('initial rendering', () => {
	it('renders the terminal header with mongo-cli label', () => {
		mountApp()
		cy.contains('mongo-cli').should('be.visible')
	})

	it('calls listDbs and listCollections on mount', () => {
		mountApp()
		cy.get('@listDbs.all').should('have.length', 1)
		cy.get('@listCollections.all').should('have.length', 1)
	})

	it('populates DB dropdown with fetched databases', () => {
		mountApp()
		cy.get('[data-cy="current-db"]').find('option').should('have.length', 3)
		cy.get('[data-cy="current-db"]').find('option').eq(1).should('have.text', 'project')
	})

	it('populates collection dropdown after collections load', () => {
		mountApp()
		cy.get('[data-cy="current-coll"]').find('option').should('have.length', 3)
	})

	it('has "project" pre-selected in DB dropdown', () => {
		mountApp()
		cy.get('[data-cy="current-db"]').should('have.value', 'project')
	})
})
