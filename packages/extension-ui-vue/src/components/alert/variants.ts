import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

/**
 * Inline callout for statuses and hints. Tones use the semantic state colors
 * at low intensity so alerts read as part of the page, not as toasts.
 */
export const alertVariants = cva(
  'relative flex w-full items-start gap-2 rounded-md border px-3 py-2 text-sm [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'border-border bg-muted/40 text-foreground [&>svg]:text-muted-foreground',
        info: 'border-info/30 bg-info/10 text-foreground [&>svg]:text-info',
        success: 'border-success/30 bg-success/10 text-foreground [&>svg]:text-success',
        warning: 'border-warning/30 bg-warning/10 text-foreground [&>svg]:text-warning',
        destructive:
          'border-destructive/30 bg-destructive/10 text-foreground [&>svg]:text-destructive'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

export type AlertVariants = VariantProps<typeof alertVariants>
