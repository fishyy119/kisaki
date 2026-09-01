<!--
Signer Panel Actions render the signers route's header operation: a manual
refresh of the trusted signer list. Mounted only while the signers route is
active; the panel owns the list and its row operations.
-->
<script setup lang="ts">
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { useI18n } from '@renderer/composables/use-i18n'
import { extensionSignersData } from '../../composables'

const { m } = useI18n()

const { refetch } = extensionSignersData()
</script>

<template>
  <Button
    variant="outline"
    size="sm"
    @click="refetch"
  >
    <Icon
      icon="icon-[mdi--refresh]"
      class="size-4"
    />
    {{ m.common.refresh }}
  </Button>
</template>
