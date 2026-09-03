/**
 * Dialog width step. A step names the content class of the dialog, never a
 * pixel width; the region clamps every step at small windows.
 *
 * - `sm`  single-control prompts (rename, score, one session)
 * - `md`  single-column forms (the default)
 * - `lg`  list editing with row actions, two-column forms
 * - `xl`  detail views, data tables, side-by-side comparison
 * - `2xl` editors and multi-column searchers
 */
export type DialogSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl'
