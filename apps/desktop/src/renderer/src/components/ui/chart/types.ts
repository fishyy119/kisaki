import type { Component, Ref } from 'vue'

export type ChartConfig = {
  [k in string]: {
    label?: string | Component
    icon?: string | Component
    color?: string
  }
}

export interface ChartContextProps {
  id: string
  config: Ref<ChartConfig>
}
