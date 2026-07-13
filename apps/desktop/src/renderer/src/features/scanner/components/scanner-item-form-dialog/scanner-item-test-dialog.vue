<script setup lang="ts">
/**
 * Scanner Test Dialog
 *
 * Test dialog for scanner configuration with extraction preview table.
 */

import { ref, computed, watch, toRaw } from 'vue'
import type { NameExtractionRule } from '@shared/db'
import type { ExtractionTestResult } from '@shared/scanner'
import { Icon } from '@renderer/components/ui/icon'
import { ipcManager } from '@renderer/core/ipc'
import { useAsyncData, useRenderState } from '@renderer/composables'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { StateView } from '@renderer/components/ui/state-view'
import { Tooltip, TooltipTrigger, TooltipContent } from '@renderer/components/ui/tooltip'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from '@renderer/components/ui/table'

// =============================================================================
// Props & Model
// =============================================================================

interface Props {
  scannerPath: string
  entityDepth: number
  rules: NameExtractionRule[]
  onAddToIgnoreList?: (name: string) => void
}

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { required: true })

// =============================================================================
// State
// =============================================================================

const excludedNames = ref<Set<string>>(new Set())

// =============================================================================
// Data Fetching
// =============================================================================

// Serialize rules for dependency tracking
const rulesKey = computed(() =>
  JSON.stringify(props.rules.map((r) => ({ id: r.id, p: r.pattern, e: r.enabled })))
)

async function fetcher(): Promise<ExtractionTestResult[]> {
  if (!open.value || !props.scannerPath) {
    return []
  }

  const result = await ipcManager.invoke(
    'scanner:test-extraction-rules',
    props.scannerPath,
    props.entityDepth,
    toRaw(props.rules)
  )
  if (result.success && result.data) {
    return result.data
  } else if (!result.success) {
    throw new Error('Scanner test failed.')
  }
  return []
}

const {
  data: results,
  isLoading,
  error
} = useAsyncData(fetcher, {
  watch: [open, () => props.scannerPath, () => props.entityDepth, rulesKey],
  immediate: true
})
const state = useRenderState(isLoading, error, results)

// Reset excluded names when deps change
watch([open, () => props.scannerPath, () => props.entityDepth, rulesKey], () => {
  excludedNames.value = new Set()
})

// =============================================================================
// Computed
// =============================================================================

const resultsList = computed(() => results.value ?? [])
const visibleResults = computed(() =>
  resultsList.value.filter((r) => !excludedNames.value.has(r.extractedName))
)
const matchedCount = computed(
  () => visibleResults.value.filter((r) => r.matchedRuleId !== null).length
)
const totalCount = computed(() => visibleResults.value.length)
const hasRules = computed(() => props.rules.length > 0)
const ruleInfoById = computed(() => {
  const map = new Map<string, { index: number; description: string }>()
  props.rules.forEach((rule, index) => {
    map.set(rule.id, { index: index + 1, description: rule.description })
  })
  return map
})

// =============================================================================
// Handlers
// =============================================================================

function handleExclude(name: string) {
  props.onAddToIgnoreList?.(name)
  excludedNames.value = new Set([...excludedNames.value, name])
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-2xl">
      <DialogHeader>
        <DialogTitle>扫描器配置测试</DialogTitle>
      </DialogHeader>
      <DialogBody class="max-h-[60vh] overflow-auto">
        <!-- Config Summary -->
        <div class="flex text-xs items-center justify-between gap-4 text-muted-foreground pb-2">
          <div class="flex items-center gap-3 min-w-0">
            <span class="flex items-center gap-1">
              <Icon
                icon="icon-[mdi--folder-open-outline]"
                class="size-4"
              />
              层级: {{ props.entityDepth }}
            </span>
            <span class="flex items-center gap-1">
              <Icon
                icon="icon-[mdi--regex]"
                class="size-4"
              />
              规则: {{ props.rules.length }}
            </span>
          </div>

          <div
            v-if="state !== 'loading' && state !== 'error'"
            class="flex items-center gap-4 whitespace-nowrap"
          >
            <span>
              实体:
              <span class="text-foreground font-medium tabular-nums">{{ totalCount }}</span>
            </span>
            <span v-if="hasRules">
              匹配:
              <span class="text-foreground font-medium tabular-nums">{{ matchedCount }}</span>
            </span>
          </div>
        </div>

        <!-- Loading / Error -->
        <StateView
          v-if="state === 'loading' || state === 'error'"
          :state="state"
          :error="error"
          class="py-8"
        />

        <!-- Empty -->
        <StateView
          v-else-if="visibleResults.length === 0"
          state="empty"
          :description="resultsList.length === 0 ? '在指定层级未找到实体' : '所有实体已被排除'"
          class="py-8"
        />

        <!-- Results Table -->
        <template v-else>
          <div class="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader class="bg-muted/50">
                <TableRow class="hover:bg-transparent border-border">
                  <TableHead>实体名称</TableHead>
                  <TableHead v-if="hasRules">提取后名称</TableHead>
                  <TableHead
                    v-if="hasRules"
                    class="text-center w-16"
                  >
                    规则
                  </TableHead>
                  <TableHead
                    v-if="props.onAddToIgnoreList"
                    class="text-center w-12"
                  ></TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                <TableRow
                  v-for="(result, index) in visibleResults"
                  :key="index"
                  class="group border-border"
                >
                  <TableCell
                    :title="result.originalName"
                    class="font-mono text-xs truncate max-w-[220px]"
                  >
                    {{ result.originalName }}
                  </TableCell>
                  <TableCell
                    v-if="hasRules"
                    :title="result.extractedName"
                    class="font-mono text-xs truncate max-w-[220px]"
                    :class="
                      result.originalName !== result.extractedName && 'text-primary font-medium'
                    "
                  >
                    {{ result.extractedName }}
                  </TableCell>
                  <TableCell
                    v-if="hasRules"
                    class="text-center"
                  >
                    <Tooltip v-if="result.matchedRuleId !== null">
                      <TooltipTrigger as-child>
                        <span class="font-mono text-xs text-success tabular-nums cursor-help">
                          #{{
                            ruleInfoById.get(result.matchedRuleId)?.index ?? result.matchedRuleId
                          }}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {{
                          ruleInfoById.get(result.matchedRuleId)?.description ??
                          result.matchedRuleId
                        }}
                      </TooltipContent>
                    </Tooltip>
                    <span
                      v-else
                      class="text-muted-foreground"
                      >-</span
                    >
                  </TableCell>
                  <TableCell
                    v-if="props.onAddToIgnoreList"
                    class="text-center"
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      class="size-5 opacity-0 group-hover:opacity-100 transition-opacity"
                      tooltip="添加到排除列表"
                      @click="handleExclude(result.extractedName)"
                    >
                      <Icon
                        icon="icon-[mdi--eye-off-outline]"
                        class="size-3"
                      />
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </template>
      </DialogBody>
      <DialogFooter>
        <Button @click="open = false">关闭</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
