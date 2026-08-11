<!-- Import Tab offers source selection; source-specific options live in flow dialogs. -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  Alert,
  Button,
  Field,
  FieldContent,
  FieldGroup,
  Icon,
  Input
} from '@kisaki3/extension-ui-vue'
import type { BangumiSettingsOverview } from '../../../shared/settings'
import { m } from '../i18n'
import { useScopeSelection } from '../scope'
import MediaScopeSelect from '../components/media-scope-select.vue'
import SettingsSection from '../components/settings-section.vue'
import ImportCollectionsDialog from '../flows/import-collections-dialog.vue'
import ImportIndexDialog from '../flows/import-index-dialog.vue'

interface Props {
  overview: BangumiSettingsOverview
}

const props = defineProps<Props>()

const emit = defineEmits<{
  refresh: []
  error: [message: string]
}>()

const indexInput = ref('')
const collectionsOpen = ref(false)
const indexOpen = ref(false)
const {
  scope,
  options: scopeOptions,
  profiles
} = useScopeSelection(() => props.overview.scopes)
const hasProfiles = computed(() => profiles.value.length > 0)
</script>

<template>
  <div class="space-y-4">
    <Alert
      v-if="!hasProfiles"
      variant="warning"
    >
      {{ m.ui.import.noProfilesWarning }}
    </Alert>

    <SettingsSection
      :title="m.ui.import.sourceTitle"
      :description="m.ui.import.sourceDescription"
      surface="rows"
    >
      <FieldGroup>
        <Field
          orientation="horizontal"
          :label="m.ui.mediaScope"
        >
          <MediaScopeSelect
            v-model="scope"
            :scopes="scopeOptions"
          />
        </Field>

        <Field
          orientation="horizontal"
          :label="m.ui.import.myCollections"
          :description="m.ui.import.myCollectionsDescription"
        >
          <FieldContent class="flex-row items-center">
            <Button
              size="sm"
              type="button"
              :disabled="!scope || props.overview.activeJobs.importCollections"
              @click="collectionsOpen = true"
            >
              <Icon
                icon="icon-[mdi--account-heart-outline]"
                class="size-3.5"
              />
              {{ m.ui.import.configureImport }}
            </Button>
          </FieldContent>
        </Field>

        <Field
          orientation="horizontal"
          :label="m.ui.import.bangumiIndex"
          :description="m.ui.import.bangumiIndexDescription"
        >
          <FieldContent class="flex-row items-center gap-2">
            <Input
              v-model="indexInput"
              type="text"
              :placeholder="m.ui.import.indexPlaceholder"
              class="w-72"
            />
            <Button
              size="sm"
              type="button"
              :disabled="!scope || !indexInput.trim() || props.overview.activeJobs.importIndex"
              @click="indexOpen = true"
            >
              <Icon
                icon="icon-[mdi--playlist-plus]"
                class="size-3.5"
              />
              {{ m.ui.import.configureImport }}
            </Button>
          </FieldContent>
        </Field>
      </FieldGroup>
    </SettingsSection>

    <ImportCollectionsDialog
      v-if="collectionsOpen && scope"
      v-model:open="collectionsOpen"
      :overview="props.overview"
      :scope="scope"
      :profiles="profiles"
      @refresh="emit('refresh')"
      @error="(message) => emit('error', message)"
    />

    <ImportIndexDialog
      v-if="indexOpen && scope"
      v-model:open="indexOpen"
      :overview="props.overview"
      :scope="scope"
      :profiles="profiles"
      :index-input="indexInput"
      @refresh="emit('refresh')"
      @error="(message) => emit('error', message)"
    />
  </div>
</template>
