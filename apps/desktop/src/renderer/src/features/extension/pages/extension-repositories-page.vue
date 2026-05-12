<!--
Extension Repositories Page hosts repository management.
Boundary: page shell only; data flow lives in child components.
-->
<script setup lang="ts">
import { ExtensionRepositoryPanel } from '../components'
</script>

<template>
  <div class="h-full">
    <ExtensionRepositoryPanel />
  </div>
</template>
