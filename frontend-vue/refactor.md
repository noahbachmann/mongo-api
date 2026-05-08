# Refactor Summary

## Architecture

All shared state and logic now lives in `App.vue`, which provides it to children via `provide`/`inject` (`shellKey`). Children are pure UI panels — they only call `stage()`.

```
App.vue
  owns: dbs, collections, history, running, command, api
  owns: commands record, stage, submit, commandPreview, canSubmit, isDangerCommand
  owns: execute, fetchDocs, validateDocsFetch, keyboard handler (Enter/Escape)
  provides: ShellContext via useShell()
  renders: header, TerminalOutput, GeneralPage (v-show), CrudPage (v-show)

GeneralPage.vue  — injects shell, calls stage(), exposes onEditDoc
CrudPage.vue     — injects shell, calls stage(), exposes onEditDoc
TerminalOutput.vue — unchanged
```

## Global Types (`src/types.d.ts`)

```ts
type CommandKind =
  | 'show-dbs' | 'show-collections'
  | 'create-db' | 'drop-db'
  | 'create-collection' | 'drop-collection'
  | 'show-documents'
  | 'insert-document' | 'update-document' | 'update-documents'
  | 'delete-document' | 'delete-documents'   // delete-documents is new

type Command = {
  kind: CommandKind
  db?: string
  collection?: string
  id?: string
  filter?: string      // JSON string, captures form state at stage time
  body?: string        // JSON string, captures form state at stage time
  limit?: number
  skip?: number
  afterSuccess?: () => void  // page-specific cleanup, called after successful submit
}
```

## ShellContext (`src/composables/useShell.ts`)

```ts
type ShellContext = {
  dbs: Ref<string[]>
  collections: Ref<string[]>
  history: Ref<HistoryEntry[]>
  running: Ref<boolean>
  command: Ref<Command | null>
  commandPreview: ComputedRef<string>
  hasCommand: ComputedRef<boolean>
  isDangerCommand: ComputedRef<boolean>
  canSubmit: ComputedRef<boolean>
  refreshDbs: () => Promise<void>
  refreshCollections: () => Promise<void>
  execute: (cmd: string, fn: (entry: HistoryEntry) => Promise<void>, onError?: (err: unknown) => void) => Promise<void>
  stage: (kind: CommandKind, extras?: Omit<Command, 'kind'>) => Promise<void>
  submit: () => Promise<void>
  scrollToBottom: () => void
}
```

## Command flow

1. Child calls `stage(kind, { collection, filter, body, limit, skip, afterSuccess })`
2. App sets `command.value`, terminal shows preview + submit button
3. User clicks submit (or presses Enter) → App calls `submit()`
4. `submit()` calls `spec.run(cmd, entry)`, then `spec.onSuccess(cmd)`, then `cmd.afterSuccess()`
5. If `spec.refresh === 'docs'`, `validateDocsFetch` appends a new history entry with current docs

Commands are **self-contained**: filter/body/limit/skip are captured at stage time, not read from live refs at submit time.

`keepJsonOnSubmit: true` on insert/update specs means on error the command is re-staged (preserving the body for retry).

## App.vue — TerminalOutput wiring

Props come directly from App's own computed values (no longer relayed through `generalRef`):

```html
<TerminalOutput
  :history="history"
  :command-preview="commandPreview"
  :has-command="hasCommand"
  :is-danger="isDangerCommand"
  :can-submit="canSubmit"
  :running="running"
  @submit="submit()"
  @edit-doc="onEditDoc"
  @delete-doc="onDeleteDoc" />
```

`onDeleteDoc` is handled directly in App: `stage('delete-document', { collection, id })`.  
`onEditDoc` delegates to the active child (`generalRef` or `crudRef`) based on `activePage`.

## GeneralPage changes

- No longer owns: command system, stage/submit, fetchDocs, keyboard handler, CommandKind/Command/CommandSpec types
- Injects from shell: `dbs`, `collections`, `running`, `command`, `stage`
- Button clicks call `stage()` with `afterSuccess` for cleanup:
  - create-db afterSuccess: clears `newDbName`, `newCollectionInput`
  - create-collection afterSuccess: clears `newCollectionInput`
  - insert afterSuccess: clears `jsonInput`
  - updateOne/updateMany afterSuccess: clears `jsonInput` and `docsFilter`
- `onEditDoc(collection, doc)`: sets `docsFilter`, `jsonInput`, `docsCollection`, then calls `stage('update-document', { collection, filter, body, afterSuccess })`
- Watches `command` to clear `dropDbTarget`/`dropCollectionTarget` when they're no longer the active command
- Watches `collections` to clear stale `docsCollection`, `dropCollectionTarget`
- New **deleteMany** button in the document section (stages `delete-documents`)
- `active` prop removed (keyboard handler moved to App)
- `defineExpose`: only `onEditDoc`

## CrudPage changes

- No longer owns: `runFind`, `runInsert`, `runUpdateOne`, `runUpdateMany`, `runDeleteOne`, `runDeleteMany`, `onDeleteDoc`
- Injects from shell: `dbs`, `collections`, `running`, `stage`
- All buttons now call `stage()` — operations are staged first, then submitted via the terminal
- Button → command mapping:
  - find → `show-documents` (with filter from pairs, no limit/skip control)
  - insert → `insert-document` (body from pairs)
  - updateOne → `update-document` (filter + body from pairs)
  - updateMany → `update-documents` (filter + body from pairs)
  - deleteOne → `delete-document` (id extracted from `_id` filter pair)
  - deleteMany → `delete-documents` (filter from pairs) ← new
- `onEditDoc(collection, doc)`: sets `filterPairs`, `bodyPairs`, `selectedCollection`, then calls `stage('update-document', { collection, filter, body })`
- `defineExpose`: only `onEditDoc`

## Key behavioral changes for tests

- **CrudPage operations are now staged**, not immediately executed. Clicking a button shows the command preview; the user must click submit (or press Enter) to execute. Tests that previously clicked a CrudPage button and immediately `cy.wait()` for an API call must now also click submit first.
- **Shared terminal**: both pages append to the same `history`. If a test mounts the full `App.vue`, history accumulates across page switches.
- **`delete-documents`** is a new command kind available on both pages.
- **Keyboard handler is on `window`** (registered in App.vue `onMounted`), not in GeneralPage.
- **GeneralPage no longer accepts an `active` prop.**
- **Mounting GeneralPage or CrudPage standalone** requires a shell provider. Use `cy.mount` with a wrapper that calls `provide(shellKey, mockShell)`, or mount `App.vue` instead.
