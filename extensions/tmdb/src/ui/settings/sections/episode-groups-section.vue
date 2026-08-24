<!--
Episode Groups Section documents the opt-in path to an alternate ordering,
which is reachable only by pasting a reference into the anime searcher.
-->
<script setup lang="ts">
import { SettingsSection } from '@kisaki3/extension-ui-vue'
import { m } from '../i18n'

/** Grammar samples, not copy: the same shapes in every locale. */
const SEARCH_INPUTS = [
  'tv:65844',
  'eg:627b8fc6f5c8240052599339',
  'https://www.themoviedb.org/tv/65844/episode_group/627b8fc6f5c8240052599339'
]
const ID_INPUTS = [
  'tv:65844:eg:627b8fc6f5c8240052599339:627b8fe99f37b00051118920',
  'https://www.themoviedb.org/tv/65844/episode_group/627b8fc6f5c8240052599339/group/627b8fe99f37b00051118920'
]
</script>

<template>
  <SettingsSection
    :title="m.ui.episodeGroups.title"
    :description="m.ui.episodeGroups.description"
  >
    <div class="space-y-3 rounded-md border border-border px-3 py-2.5">
      <ol class="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
        <li>{{ m.ui.episodeGroups.stepPaste }}</li>
        <li>{{ m.ui.episodeGroups.stepPick }}</li>
        <li>{{ m.ui.episodeGroups.stepSwitch }}</li>
      </ol>

      <div class="space-y-1">
        <p class="text-xs font-medium">{{ m.ui.episodeGroups.inputsLabel }}</p>
        <ul class="space-y-0.5 font-mono text-xs break-all text-muted-foreground">
          <li
            v-for="input in SEARCH_INPUTS"
            :key="input"
          >
            {{ input }}
          </li>
        </ul>
      </div>

      <div class="space-y-1">
        <p class="text-xs font-medium">{{ m.ui.episodeGroups.idsLabel }}</p>
        <ul class="space-y-0.5 font-mono text-xs break-all text-muted-foreground">
          <li
            v-for="input in ID_INPUTS"
            :key="input"
          >
            {{ input }}
          </li>
        </ul>
      </div>
    </div>
  </SettingsSection>
</template>
