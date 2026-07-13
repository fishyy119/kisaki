import type { PrimitiveProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import type { ButtonVariants } from './variants'

export interface ButtonProps extends PrimitiveProps {
  variant?: ButtonVariants['variant']
  size?: ButtonVariants['size']
  /** Plain-text tooltip; rich tooltip content should compose the Tooltip family explicitly */
  tooltip?: string
  class?: HTMLAttributes['class']
}
