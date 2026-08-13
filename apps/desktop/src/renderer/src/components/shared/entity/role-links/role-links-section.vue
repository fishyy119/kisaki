<!--
  EntityRoleLinksSection
  Sidebar section rendering role-grouped entity links as compact text links.
  Each role group is clamped; the trailing "+N" button jumps to the full
  list via the `viewAll` event.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@renderer/components/ui/button'
import { Section } from '@renderer/components/ui/section'
import EntityCard from '../card'
import { useI18n } from '@renderer/composables/use-i18n'
import { groupRoleLinks, type RoleLinkEntityType, type RoleLinkItem } from './grouping'

interface Props {
  title: string
  emptyText: string
  entityType: RoleLinkEntityType
  items: RoleLinkItem[]
  roleOrder: readonly string[]
  roleLabels: Record<string, string>
  maxPerRole?: number
}

const props = withDefaults(defineProps<Props>(), {
  maxPerRole: 5
})

const emit = defineEmits<{
  edit: []
  open: [entityId: string]
  viewAll: []
}>()

const { m } = useI18n()

const grouped = computed(() => groupRoleLinks(props.items))
</script>

<template>
  <Section
    :title="props.title"
    editable
    :empty="props.items.length === 0"
    :empty-text="props.emptyText"
    @edit="emit('edit')"
  >
    <div class="space-y-2 text-sm">
      <template
        v-for="role in props.roleOrder"
        :key="role"
      >
        <div v-if="grouped[role]?.length">
          <div class="text-muted-foreground text-xs mb-1">
            {{ props.roleLabels[role] || role }}
          </div>
          <div class="flex flex-wrap items-center gap-x-1 gap-y-0.5">
            <template
              v-for="(item, index) in grouped[role].slice(0, props.maxPerRole)"
              :key="item.id"
            >
              <span class="inline-flex items-center max-w-full min-w-0">
                <EntityCard
                  :entity-type="props.entityType"
                  :entity="item.entity!"
                  variant="button"
                  button-variant="link"
                  button-size="xs"
                  @click="emit('open', item.entity!.id)"
                />
                <span
                  v-if="index < Math.min(grouped[role].length, props.maxPerRole) - 1"
                  class="text-muted-foreground/50"
                  >,</span
                >
              </span>
            </template>
            <Button
              v-if="grouped[role].length > props.maxPerRole"
              variant="text"
              size="xs"
              class="h-auto px-1 py-0 text-muted-foreground/70"
              :tooltip="m.library.detail.viewAll({ count: grouped[role].length })"
              @click="emit('viewAll')"
            >
              +{{ grouped[role].length - props.maxPerRole }}
            </Button>
          </div>
        </div>
      </template>
    </div>
  </Section>
</template>
