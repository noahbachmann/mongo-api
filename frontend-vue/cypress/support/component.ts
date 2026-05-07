import { mount } from 'cypress/vue'
import '../../src/style.css'

declare global {
	namespace Cypress {
		interface Chainable {
			mount: typeof mount
		}
	}
}

Cypress.Commands.add('mount', mount)
