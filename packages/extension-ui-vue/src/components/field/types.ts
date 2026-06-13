/**
 * Help affordance shown as a tooltip next to a field label.
 * @remarks The kit renders a built-in info glyph; unlike the app it has no
 * iconify `icon` override (the kit deliberately ships no icon-class system).
 */
export interface FieldHelp {
  text: string
}

/**
 * External link affordance shown as a tooltip-labeled button next to a field
 * label. The kit renders a built-in external-link glyph.
 */
export interface FieldLink {
  href: string
  label: string
}
