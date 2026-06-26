import type { ScaffoldPromptUi } from './tui/prompts'

/** Immutable runtime dependencies supplied by the scaffold entry point. */
export interface ScaffoldCliContext {
  templateDir: string
  toolingVersion: string
  prompts: ScaffoldPromptUi
}
