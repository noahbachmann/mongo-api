import type { InjectionKey, Ref, ComputedRef } from 'vue'
import { inject } from 'vue'

export type ShellContext = {
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

export const shellKey: InjectionKey<ShellContext> = Symbol('shell')

export function useShell(): ShellContext {
	const ctx = inject(shellKey)
	if (!ctx) throw new Error('useShell() must be used inside the shell provider')
	return ctx
}
