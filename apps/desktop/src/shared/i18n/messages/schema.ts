import type { en } from './en'

/**
 * Message catalog schema derived from the English catalog.
 *
 * Every locale must provide the exact same keys; parameters are typed through
 * the message functions themselves. Non-English domain modules assert
 * `satisfies Messages['<domain>']` so missing or extra keys fail typecheck.
 */
export type Messages = typeof en
