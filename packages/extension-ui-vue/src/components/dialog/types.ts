/**
 * Dialog width step, the app's own dialog scale. A step names the content
 * class of the dialog, never a pixel width; the document viewport clamps every
 * step at small sizes.
 *
 * - `sm`  single-control prompts
 * - `md`  single-column forms (the default)
 * - `lg`  list editing with row actions, two-column forms
 * - `xl`  detail views, data tables, side-by-side comparison
 * - `2xl` editors and multi-column searchers
 */
export type DialogSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl'
