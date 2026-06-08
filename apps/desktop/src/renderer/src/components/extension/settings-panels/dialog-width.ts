import type { SettingsPanelDialogSize } from '@kisaki3/extension-api'

export function getSettingsPanelDialogWidthClass(size?: SettingsPanelDialogSize): string {
  switch (size) {
    case 'sm':
      return 'max-w-xl'
    case 'lg':
      return 'max-w-4xl'
    case 'xl':
      return 'max-w-5xl'
    case 'md':
    default:
      return 'max-w-2xl'
  }
}
