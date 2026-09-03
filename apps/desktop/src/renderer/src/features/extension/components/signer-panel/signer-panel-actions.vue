<!--
Signer Panel Actions render the signers route's header operation: a manual
refresh of the trusted signer list. Mounted only while the signers route is
active; the panel owns the list and its row operations.
-->
<script setup lang="ts">
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { useI18n } from '@renderer/composables/use-i18n'
import { extensionSignersQuery } from '../../composables'

const { m } = useI18n()

const { reload } = extensionSignersQuery()
</script>

<template>
  <Button
    variant="outline"
    size="sm"
    @click="reload"
  >
    <Icon
      icon="icon-[mdi--refresh]"
      class="size-4"
    />
    {{ m.actions.refresh }}
  </Button>
</template>
