import type { ComputedRef, InjectionKey } from 'vue'

/** Whether the enclosing TabsList collapses labels; triggers then carry a title. */
export const TabsListCollapsibleKey: InjectionKey<ComputedRef<boolean>> =
  Symbol('TabsListCollapsible')
