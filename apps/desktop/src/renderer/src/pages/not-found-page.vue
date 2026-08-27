<!--
  NotFoundPage
  404 page for unmatched routes, owned by the router.
  Root `pages/` charter: this directory holds system-owned route surfaces
  only — pages owned by core-level subsystems, importing no `features/*` code
  and referenced by none.
-->
<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { Button } from '@renderer/components/ui/button'
import { StateView } from '@renderer/components/ui/state-view'
import { useI18n } from '@renderer/composables/use-i18n'
import { LIBRARY_HOME_PATH } from '@renderer/utils/library-context'

const { m } = useI18n()
</script>

<template>
  <StateView
    state="not-found"
    icon="icon-[mdi--compass-off-outline]"
    :title="m.app.notFound.title"
    :description="m.app.notFound.description"
    class="h-full bg-background"
  >
    <template #actions>
      <Button
        as-child
        variant="secondary"
      >
        <RouterLink :to="LIBRARY_HOME_PATH">{{ m.app.notFound.backToLibrary }}</RouterLink>
      </Button>
    </template>
  </StateView>
</template>
