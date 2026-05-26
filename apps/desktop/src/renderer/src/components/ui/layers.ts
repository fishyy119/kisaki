// Non-blocking portaled surfaces share the dialog content layer so the most
// recently opened portal wins by DOM order, matching the original overlay
// behavior. Blocking alert dialogs live above that shared layer.
export const UI_LAYER = {
  dialogOverlay: 50,
  dialogContent: 51,
  floating: 51,
  alertDialogOverlay: 70,
  alertDialogContent: 71
} as const
