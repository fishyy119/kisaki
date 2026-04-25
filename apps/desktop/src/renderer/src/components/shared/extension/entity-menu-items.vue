<!--
ExtensionEntityMenuItems renders controlled entity menu contributions.
Boundary: it resolves DTOs through main-process IPC and never executes extension code.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Spinner } from '@renderer/components/ui/spinner'
import { notify } from '@renderer/core/notify'
import {
  getEntityMenuInputKey,
  invokeExtensionEntityMenu,
  resolveExtensionEntityMenu
} from '@renderer/core/extensions'
import type { EntityMenuItem, EntityMenuResolveInput } from '@kisaki/extension-api'
import type {
  ExtensionResolvedEntityMenu,
  ExtensionResolvedEntityMenuGroup
} from '@shared/extension'
import type { MenuComponents } from '@renderer/types'

interface Props {
  input: EntityMenuResolveInput
  components: MenuComponents
  enabled?: boolean
  leadingSeparator?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  enabled: true,
  leadingSeparator: true
})

const resolvedMenu = ref<ExtensionResolvedEntityMenu | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const invokingKey = ref<string | null>(null)
let resolveRequestId = 0

const inputKey = computed(() => getEntityMenuInputKey(props.input))
const visibleGroups = computed(() =>
  (resolvedMenu.value?.groups ?? [])
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.kind === 'separator' || !item.hidden)
    }))
    .filter((group) => group.items.length > 0)
)
const hasContent = computed(
  () =>
    visibleGroups.value.length > 0 ||
    loading.value ||
    !!error.value ||
    (resolvedMenu.value?.errors.length ?? 0) > 0
)

watch(
  [() => props.enabled, inputKey],
  ([enabled]) => {
    if (!enabled) {
      resolveRequestId += 1
      resetMenuState()
      return
    }

    void resolveMenu()
  },
  { immediate: true }
)

async function resolveMenu(): Promise<void> {
  const requestId = ++resolveRequestId
  loading.value = true
  error.value = null
  resolvedMenu.value = null

  try {
    const menu = await resolveExtensionEntityMenu(props.input)
    if (requestId === resolveRequestId && props.enabled) {
      resolvedMenu.value = menu
    }
  } catch (e) {
    if (requestId === resolveRequestId && props.enabled) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  } finally {
    if (requestId === resolveRequestId) {
      loading.value = false
    }
  }
}

async function invokeMenuItem(
  group: ExtensionResolvedEntityMenuGroup,
  item: EntityMenuItem,
  value?: boolean | string
): Promise<void> {
  if (!props.enabled) {
    return
  }

  if (item.kind === 'separator' || !('callbackId' in item) || !item.callbackId) {
    return
  }

  const callbackKey = `${group.extensionId}:${group.contributionId}:${item.callbackId}`
  invokingKey.value = callbackKey

  try {
    const response = await invokeExtensionEntityMenu({
      sessionId: resolvedMenu.value?.sessionId ?? '',
      extensionId: group.extensionId,
      contributionId: group.contributionId,
      callbackId: item.callbackId,
      input: props.input,
      value
    })

    if (response.refreshed) {
      resolvedMenu.value = response.refreshed
    }

    if (!response.result.success) {
      notify.error('扩展菜单操作失败', response.result.error.message)
    }
  } catch (e) {
    notify.error('扩展菜单操作失败', e instanceof Error ? e.message : String(e))
  } finally {
    invokingKey.value = null
  }
}

function isInvoking(group: ExtensionResolvedEntityMenuGroup, item: EntityMenuItem): boolean {
  if (item.kind === 'separator' || !('callbackId' in item) || !item.callbackId) {
    return false
  }

  return invokingKey.value === `${group.extensionId}:${group.contributionId}:${item.callbackId}`
}

function isDisabled(group: ExtensionResolvedEntityMenuGroup, item: EntityMenuItem): boolean {
  if (item.kind === 'separator') {
    return false
  }

  return (
    item.disabled === true || !('callbackId' in item) || !item.callbackId || isInvoking(group, item)
  )
}

function resetMenuState(): void {
  resolvedMenu.value = null
  loading.value = false
  error.value = null
  invokingKey.value = null
}
</script>

<template>
  <template v-if="props.enabled && hasContent">
    <component
      :is="props.components.Separator"
      v-if="props.leadingSeparator"
    />

    <component
      :is="props.components.Item"
      v-if="loading && visibleGroups.length === 0"
      disabled
    >
      <Spinner class="size-3.5" />
      加载扩展菜单...
    </component>

    <component
      :is="props.components.Item"
      v-if="error"
      disabled
    >
      <Icon
        icon="icon-[mdi--alert-circle-outline]"
        class="size-4 text-destructive"
      />
      扩展菜单加载失败
    </component>

    <template
      v-for="(group, groupIndex) in visibleGroups"
      :key="`${group.extensionId}:${group.contributionId}`"
    >
      <component
        :is="props.components.Separator"
        v-if="groupIndex > 0"
      />

      <template
        v-for="item in group.items"
        :key="`${group.extensionId}:${group.contributionId}:${item.id}`"
      >
        <component
          :is="props.components.Separator"
          v-if="item.kind === 'separator'"
        />

        <component
          :is="props.components.Item"
          v-else-if="item.kind === 'action'"
          :disabled="isDisabled(group, item)"
          @select="invokeMenuItem(group, item)"
        >
          <Spinner
            v-if="isInvoking(group, item)"
            class="size-3.5"
          />
          <Icon
            v-else-if="item.icon"
            :icon="item.icon"
            class="size-4"
          />
          {{ item.label }}
        </component>

        <component
          :is="props.components.CheckboxItem"
          v-else-if="item.kind === 'checkbox'"
          :model-value="item.checked"
          :disabled="isDisabled(group, item)"
          @select="invokeMenuItem(group, item, !item.checked)"
        >
          <Spinner
            v-if="isInvoking(group, item)"
            class="size-3.5"
          />
          <Icon
            v-else-if="item.icon"
            :icon="item.icon"
            class="size-4"
          />
          {{ item.label }}
        </component>

        <component
          :is="props.components.Sub"
          v-else-if="item.kind === 'select'"
        >
          <component
            :is="props.components.SubTrigger"
            :disabled="isDisabled(group, item)"
          >
            <Spinner
              v-if="isInvoking(group, item)"
              class="size-3.5"
            />
            <Icon
              v-else-if="item.icon"
              :icon="item.icon"
              class="size-4"
            />
            {{ item.label }}
          </component>
          <component
            :is="props.components.SubContent"
            class="min-w-[160px]"
          >
            <component
              :is="props.components.RadioGroup"
              :model-value="item.value"
            >
              <component
                :is="props.components.RadioItem"
                v-for="option in item.options"
                :key="option.value"
                :value="option.value"
                :disabled="option.disabled || item.disabled"
                @select="invokeMenuItem(group, item, option.value)"
              >
                {{ option.label }}
              </component>
            </component>
          </component>
        </component>
      </template>
    </template>

    <component
      :is="props.components.Item"
      v-if="(resolvedMenu?.errors.length ?? 0) > 0"
      disabled
    >
      <Icon
        icon="icon-[mdi--alert-circle-outline]"
        class="size-4 text-muted-foreground"
      />
      部分扩展菜单不可用
    </component>
  </template>
</template>
