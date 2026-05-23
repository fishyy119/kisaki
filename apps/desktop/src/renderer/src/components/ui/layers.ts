// Portaled floating surfaces must sit above ordinary dialog content and below
// blocking alert dialogs, otherwise comboboxes and menus opened inside dialogs
// render behind their parent dialog.
export const UI_LAYER = {
  dialogOverlay: 50,
  dialogContent: 51,
  floating: 60,
  alertDialogOverlay: 70,
  alertDialogContent: 71
} as const
