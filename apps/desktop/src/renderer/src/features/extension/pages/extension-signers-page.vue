<!--
Extension Signers Page hosts signer trust management.
Boundary: page shell only; signer data flow lives in child components.
-->
<script setup lang="ts">
import { ExtensionSignerPanel } from '../components'
</script>

<template>
  <div class="h-full">
    <ExtensionSignerPanel />
  </div>
</template>
