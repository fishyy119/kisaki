<!--
  CollectionInfoFormDialog

  Dialog for creating or editing a collection's basic metadata.
  Only handles: name, description, NSFW, type (static/dynamic).
  Filter configuration and content editing are handled from detail page.
-->
<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { eq, and } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { notify } from '@renderer/core/notify'
import { db, attachment } from '@renderer/core/db'
import {
  collections,
  collectionGameLinks,
  collectionAnimeLinks,
  collectionCharacterLinks,
  collectionPersonLinks,
  collectionCompanyLinks
} from '@shared/db'
import { useAsyncData, useStagedImagePick } from '@renderer/composables'
import { getEntityImageUrl } from '@renderer/utils/entity-image'
import type { ContentEntityType } from '@shared/common'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { StateView } from '@renderer/components/ui/state-view'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { MarkdownEditor } from '@renderer/components/ui/markdown'
import { Switch } from '@renderer/components/ui/switch'
import { RadioGroup, RadioGroupItem } from '@renderer/components/ui/radio-group'
import { Label } from '@renderer/components/ui/label'
import { ImagePicker } from '@renderer/components/ui/image-picker'
import {
  Field,
  FieldLabel,
  FieldContent,
  FieldDescription,
  FieldGroup
} from '@renderer/components/ui/field'
import { Form } from '@renderer/components/ui/form'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

export interface Props {
  /** Collection ID for edit mode */
  collectionId?: string
  /**
   * Entity to add to collection after creation.
   * When present, create mode is locked to static collections because
   * entity menu quick-create flows must allow manual membership edits.
   */
  entityToAdd?: { type: ContentEntityType; id: string }
}

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { required: true })

const isEditMode = !!props.collectionId
const isStaticCreateLocked = computed(() => !isEditMode && !!props.entityToAdd)

// Form state
interface FormData {
  name: string
  description: string
  isNsfw: boolean
  isDynamic: boolean
}

const formData = ref<FormData>({
  name: '',
  description: '',
  isNsfw: false,
  isDynamic: false
})
const isSubmitting = ref(false)

const cover = useStagedImagePick()

// For edit mode, fetch collection data
const {
  data: existingCollection,
  isLoading,
  refetch
} = useAsyncData(
  () => db.query.collections.findFirst({ where: eq(collections.id, props.collectionId!) }),
  {
    watch: [() => props.collectionId],
    enabled: () => open.value && isEditMode
  }
)

// Initialize form state when data loads
watch(existingCollection, (data) => {
  if (data) {
    formData.value = {
      name: data.name,
      description: data.description ?? '',
      isNsfw: data.isNsfw,
      isDynamic: data.isDynamic
    }
  }
})

watch(
  isStaticCreateLocked,
  (locked) => {
    if (locked) {
      formData.value.isDynamic = false
    }
  },
  { immediate: true }
)

const currentCoverUrl = computed(() => {
  if (!isEditMode) return null
  if (cover.mode.value !== 'keep') return null
  if (!existingCollection.value) return null
  return getEntityImageUrl('collection', existingCollection.value, 'cover')
})

const coverClearDisabled = computed(
  () =>
    cover.mode.value === 'clear' ||
    (cover.mode.value === 'keep' && !existingCollection.value?.coverFile)
)

// Reset form when dialog opens
watch(
  () => open.value,
  (isOpen) => {
    if (isOpen) {
      cover.reset()
      if (isEditMode) {
        refetch()
      } else {
        // Create mode - reset to defaults
        formData.value = {
          name: '',
          description: '',
          isNsfw: false,
          isDynamic: false
        }
      }
    }
  },
  { immediate: true }
)

async function handleSubmit() {
  if (!formData.value.name.trim()) return

  isSubmitting.value = true
  try {
    if (isEditMode && existingCollection.value) {
      // Only update name, description, isNsfw - type cannot be changed
      await db
        .update(collections)
        .set({
          name: formData.value.name,
          description: formData.value.description.trim() || null,
          isNsfw: formData.value.isNsfw
        })
        .where(eq(collections.id, existingCollection.value.id))

      if (cover.mode.value === 'clear') {
        await attachment.clearFile(collections, existingCollection.value.id, 'coverFile')
      }
      if (cover.mode.value === 'set' && cover.pickedPath.value) {
        await attachment.setFile(collections, existingCollection.value.id, 'coverFile', {
          kind: 'path',
          path: cover.pickedPath.value
        })
      }
      notify.success(m.value.library.forms.collectionUpdated)
    } else {
      const newCollectionId = nanoid()
      const isDynamic = isStaticCreateLocked.value ? false : formData.value.isDynamic
      await db.insert(collections).values({
        id: newCollectionId,
        name: formData.value.name,
        description: formData.value.description.trim() || null,
        isNsfw: formData.value.isNsfw,
        isDynamic,
        dynamicConfig: null
      })

      if (cover.mode.value === 'set' && cover.pickedPath.value) {
        await attachment.setFile(collections, newCollectionId, 'coverFile', {
          kind: 'path',
          path: cover.pickedPath.value
        })
      }

      // Add entity to collection if provided (static mode only)
      if (props.entityToAdd) {
        const entityType = props.entityToAdd.type
        const entityId = props.entityToAdd.id

        switch (entityType) {
          case 'game': {
            const existing = await db.query.collectionGameLinks.findFirst({
              where: and(
                eq(collectionGameLinks.collectionId, newCollectionId),
                eq(collectionGameLinks.gameId, entityId)
              )
            })
            if (!existing?.id) {
              await db.insert(collectionGameLinks).values({
                id: nanoid(),
                collectionId: newCollectionId,
                gameId: entityId
              })
            }
            notify.success(
              m.value.library.forms.collectionCreatedWithEntities({
                label: m.value.library.entities.game
              })
            )
            break
          }
          case 'anime': {
            const existing = await db.query.collectionAnimeLinks.findFirst({
              where: and(
                eq(collectionAnimeLinks.collectionId, newCollectionId),
                eq(collectionAnimeLinks.animeId, entityId)
              )
            })
            if (!existing?.id) {
              await db.insert(collectionAnimeLinks).values({
                id: nanoid(),
                collectionId: newCollectionId,
                animeId: entityId
              })
            }
            notify.success(
              m.value.library.forms.collectionCreatedWithEntities({
                label: m.value.library.entities.anime
              })
            )
            break
          }
          case 'character': {
            const existing = await db.query.collectionCharacterLinks.findFirst({
              where: and(
                eq(collectionCharacterLinks.collectionId, newCollectionId),
                eq(collectionCharacterLinks.characterId, entityId)
              )
            })
            if (!existing?.id) {
              await db.insert(collectionCharacterLinks).values({
                id: nanoid(),
                collectionId: newCollectionId,
                characterId: entityId
              })
            }
            notify.success(
              m.value.library.forms.collectionCreatedWithEntities({
                label: m.value.library.entities.character
              })
            )
            break
          }
          case 'person': {
            const existing = await db.query.collectionPersonLinks.findFirst({
              where: and(
                eq(collectionPersonLinks.collectionId, newCollectionId),
                eq(collectionPersonLinks.personId, entityId)
              )
            })
            if (!existing?.id) {
              await db.insert(collectionPersonLinks).values({
                id: nanoid(),
                collectionId: newCollectionId,
                personId: entityId
              })
            }
            notify.success(
              m.value.library.forms.collectionCreatedWithEntities({
                label: m.value.library.entities.person
              })
            )
            break
          }
          case 'company': {
            const existing = await db.query.collectionCompanyLinks.findFirst({
              where: and(
                eq(collectionCompanyLinks.collectionId, newCollectionId),
                eq(collectionCompanyLinks.companyId, entityId)
              )
            })
            if (!existing?.id) {
              await db.insert(collectionCompanyLinks).values({
                id: nanoid(),
                collectionId: newCollectionId,
                companyId: entityId
              })
            }
            notify.success(
              m.value.library.forms.collectionCreatedWithEntities({
                label: m.value.library.entities.company
              })
            )
            break
          }
        }
      } else {
        notify.success(m.value.library.forms.collectionCreated)
      }
    }
    open.value = false
  } catch (_error) {
    notify.error(
      isEditMode ? m.value.library.feedback.updateFailed : m.value.library.feedback.createFailed
    )
  } finally {
    isSubmitting.value = false
  }
}

// Computed model for isDynamic to use with RadioGroup
const modeModel = computed({
  get: () => (formData.value.isDynamic ? 'dynamic' : 'static'),
  set: (value: string) => {
    formData.value.isDynamic = value === 'dynamic'
  }
})

const canSubmit = computed(() => formData.value.name.trim())
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="w-[50vw] max-w-none">
      <!-- Loading state for edit mode -->
      <template v-if="isEditMode && isLoading">
        <DialogBody>
          <StateView
            state="loading"
            class="py-8"
          />
        </DialogBody>
      </template>

      <template v-else>
        <DialogHeader>
          <DialogTitle>{{
            isEditMode ? m.library.forms.editCollection : m.library.forms.newCollection
          }}</DialogTitle>
        </DialogHeader>
        <Form @submit="handleSubmit">
          <DialogBody>
            <FieldGroup>
              <Field>
                <FieldLabel>{{ m.library.fields.name }}</FieldLabel>
                <FieldContent>
                  <Input
                    v-model="formData.name"
                    :placeholder="m.library.forms.collectionNamePlaceholder"
                    autofocus
                  />
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel>{{ m.library.forms.coverLabel }}</FieldLabel>
                <FieldContent>
                  <ImagePicker
                    :image-url="currentCoverUrl"
                    :picked-path="cover.pickedPath.value"
                    :picked-preview-url="cover.previewUrl.value"
                    :pick-label="m.library.forms.pickCover"
                    :clear-disabled="coverClearDisabled"
                    @pick="cover.pick({ title: m.library.forms.pickCover })"
                    @clear="cover.clear()"
                  />
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel>{{ m.library.fields.description }}</FieldLabel>
                <FieldContent>
                  <MarkdownEditor
                    v-model="formData.description"
                    :placeholder="m.library.forms.collectionDescriptionPlaceholder"
                    min-height="140px"
                    max-height="200px"
                  />
                </FieldContent>
              </Field>

              <!-- Type selection is hidden for entity menu quick-create flows. -->
              <Field v-if="!isEditMode && !isStaticCreateLocked">
                <FieldLabel>{{ m.library.fields.type }}</FieldLabel>
                <FieldDescription>
                  {{ m.library.forms.collectionTypeHint }}
                </FieldDescription>
                <FieldContent>
                  <RadioGroup
                    v-model="modeModel"
                    class="flex gap-4"
                  >
                    <div class="flex items-center space-x-2">
                      <RadioGroupItem
                        id="static"
                        value="static"
                      />
                      <Label
                        for="static"
                        class="cursor-pointer"
                      >
                        {{ m.library.forms.staticCollection }}
                      </Label>
                    </div>
                    <div class="flex items-center space-x-2">
                      <RadioGroupItem
                        id="dynamic"
                        value="dynamic"
                      />
                      <Label
                        for="dynamic"
                        class="cursor-pointer"
                      >
                        {{ m.library.forms.dynamicCollection }}
                      </Label>
                    </div>
                  </RadioGroup>
                </FieldContent>
              </Field>

              <Field orientation="horizontal">
                <FieldLabel>{{ m.library.forms.nsfwLabel }}</FieldLabel>
                <FieldDescription>{{ m.library.forms.collectionNsfwHint }}</FieldDescription>
                <FieldContent>
                  <Switch v-model="formData.isNsfw" />
                </FieldContent>
              </Field>
            </FieldGroup>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              :disabled="isSubmitting"
              @click="open = false"
            >
              {{ m.common.cancel }}
            </Button>
            <Button
              type="submit"
              :disabled="isSubmitting || !canSubmit"
            >
              {{ isEditMode ? m.common.save : m.common.create }}
            </Button>
          </DialogFooter>
        </Form>
      </template>
    </DialogContent>
  </Dialog>
</template>
