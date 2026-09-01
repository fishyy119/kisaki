# Renderer Patterns

## Key Files

- `apps/desktop/src/renderer/src/main.ts` - Renderer entry point and router composition root
- `apps/desktop/src/renderer/src/main.vue` - Root component with ErrorBoundary
- `apps/desktop/src/renderer/src/core/route-data.ts` - Route data loader kernel (navigation-blocking)
- `apps/desktop/src/renderer/src/features/<feature>/routes.ts` - Feature route manifests
- `apps/desktop/src/renderer/src/utils/entity-routes.ts` - Entity route grammar (paths, params)
- `apps/desktop/src/renderer/src/components/layout/navigation-progress.vue` - Route loading bar
- `apps/desktop/src/renderer/src/composables/use-async-data.ts` - Async data fetching (non-route surfaces)
- `apps/desktop/src/renderer/src/composables/use-render-state.ts` - Render state management
- `apps/desktop/src/renderer/src/composables/use-delayed-loading.ts` - Loading delay
- `apps/desktop/src/renderer/src/composables/use-ipc.ts` - IPC push subscription
- `apps/desktop/src/renderer/src/composables/use-db-changes.ts` - Db change feed subscription
- `apps/desktop/src/renderer/src/stores/` - Pinia stores
- `apps/desktop/src/renderer/src/stores/task-run.ts` - TaskRun active/history store
- `apps/desktop/src/renderer/src/features/task-center/` - Task center dialog and display utilities
- `apps/desktop/eslint.config.ts` - ESLint rules (props reactivity)

## Data Loading Surfaces (Must Follow)

The renderer has two data-loading surfaces with different rules:

1. **Route pages** use route data loaders (`defineRouteData` + `meta.dataLoaders`). Data loads
   during navigation in `beforeResolve`; the previous page stays visible until the next page's
   data settles. Route page templates never render `pending`/`loading` branches - the first
   frame is `success` / `not-found` / `error` only. The top `NavigationProgress` bar is the
   single route-level loading indicator (appears after a 150ms delay).
2. **Dialogs and embedded blocks** (mounted on demand) use `useAsyncData` + `useRenderState`
   with delayed loading. This is unchanged.

### Route Data Loaders

```ts
// Module scope, beside the fetcher (e.g. in a feature composable)
export const gameDetailData = defineRouteData((route) => {
  const { showNsfw } = storeToRefs(usePreferencesStore())
  return fetchGameData(route.params.gameId as string, routeSpoilersRevealed.value, showNsfw.value)
})

// features/<feature>/routes.ts (the feature's route manifest)
{ path: 'game/:gameId', component: () => import('./pages/game-detail-page.vue'),
  meta: { dataLoaders: [gameDetailData] } }

// Page/provider: data is already settled at mount
const { data, error, isFetching, refetch } = gameDetailData()
```

Rules:

- Loaders own a module-level store (singleton per loader; the app renders one RouterView).
- `refetch()` re-runs the fetcher against the last loaded route without clearing data (SWR).
  Use it for db-event invalidation and in-page parameter changes (tabs, period, spoilers);
  the old data stays visible until the new data lands - no empty-state flash.
- In-page fetch parameters live in module refs beside the loader so the navigation-time fetch
  reads a consistent value; reset them when the route identity changes inside the fetcher.
- Fetch failures are captured into the loader `error` ref and never block navigation.
  `null` results mean not-found.
- A loader declared on several matched records (a layout and its children, or sibling routes
  sharing one dataset) runs once per navigation; the kernel deduplicates by identity.
- Loader modules and their imports are reachable from the entry through the manifests, so they
  must deep-import owning modules (e.g. `@renderer/composables/use-db-changes`), never the
  `@renderer/composables` barrel; a barrel edge would put every composable back on the
  full-reload path.

### Entity Detail Providers (Dual Surface)

The provider/consumer shell is owned once by `composables/entity-context.ts`:
`createEntityDetailContext(spec)` builds the route loader (with cross-entry params reset), the
dialog provider, the computed projection over the spec's `empty` shape, db-change invalidation,
and the injected consumer. A `use-<entity>.ts` file declares only the spec — `entityType`,
`empty` projection, `initialParams()`, `fetch(id, params, view)` (view carries the NSFW
preference), `relevantTables(data)` (decided by the loaded data, so a resolved type or an
active filter widens the set), and `entityTable` — and re-exports the factory's typed entries;
the detail-route param derives from the entity type through the entity route grammar
(`utils/entity-routes.ts`). Add a new entity detail surface by writing that spec, never by
re-implementing the shell.

Entity detail composables (`use-game`, `use-character`, ...) expose two provider entries over
one shared fetcher, context assembly, and db-event sync:

- `useGameRouteProvider()` - route page surface; reads the settled loader store, no isLoading.
- `useGameDialogProvider(gameId)` - dialog surface; `useAsyncData` after mount.

Both provide the same context; child components consume `useGame()` and cannot tell which
surface they are on. In-page fetch parameters come back as `params`: one writable computed per
spec param key; a set replaces the params holder wholesale and triggers a non-blocking SWR
refetch. The seven content entities share `EntitySpoilerParams` (`params.spoilersRevealed`);
the organizer surfaces (`use-tag`, `use-collection`) ride the same factory with
`params.query: EntityListQuery` driving their browse band. Route-surface params live beside
the loader and reset when a different entry loads; dialog params are instance-local.

## Naming & Organization Conventions

### Core Rules (Must Follow)

1. Boundary path is the public context.
2. Local names keep only immediate semantic context; avoid ancestor prefix chains.
3. Use `kebab-case` for folders/files and `PascalCase` for exported component/type names.
4. First-level public module must be folderized and expose `index.ts`.
5. Public exports must be explicit named exports; `export *` is forbidden.
6. External imports must use boundary entrypoints; no deep private subpath imports.
7. Reusable named exports should not stay in `.vue`; move to sidecars (`types.ts`, `variants.ts`, `utils.ts`).
8. Keep stable role suffixes for clarity (e.g. `-dialog`, `-form`, `-tab`, `-toolbar`, `-panel`).

### Naming Pattern

- Folder: keep semantic role only.
  - Good: `shared/character/detail/tabs/`
  - Avoid: `shared/character/character-detail/character-detail-tabs/`
- File: keep immediate-local context.
  - Preferred: `<parent>-<semantic>[-<role>]`
  - Allowed: `<semantic>-<role>` (when role already implies parent)
  - Good: `features/library/explorer/toolbar/toolbar-nav.vue`
  - Avoid: `features/library/explorer/toolbar/library-explorer-toolbar-nav.vue`

### Export & Import Gate

- `index.ts` should be minimal and explicit:

```ts
export { default as Button } from './button.vue'
export { buttonVariants, type ButtonVariants } from './variants'
export type { ButtonProps } from './types'
```

- Lint gate:
  - `no-restricted-imports` for boundary access.
  - `no-restricted-syntax` to ban `ExportAllDeclaration`.

### Routing Topology (Must Follow)

Routing is layered so every dependency arrow points one way; each layer's placement encodes
the rule it enforces:

1. **Grammar** (`utils/entity-routes.ts`, `utils/library-context.ts`): pure URL contracts.
   Entity detail path patterns and param names have this single source; the manifest, the
   entity specs, and every page that links to a detail view derive from it.
2. **Kernel** (`core/route-data.ts`): `defineRouteData` and the `installRouteData` guard.
   `core/` has zero `features/*` imports; the kernel knows nothing about concrete routes.
3. **Feature manifests** (`features/<feature>/routes.ts`): each feature owns its
   `RouteRecordRaw[]` — paths, lazy page imports, `meta.dataLoaders` wiring, route-name
   constants, and per-feature guard policy (e.g. the library `from`-autofill guard). Route
   names are exported constants consumed inside the owning feature; nothing re-spells them.
   The library manifest generates its nine entity detail routes from `ALL_ENTITY_TYPES`, so
   adding a media type is one registry entry plus its page.
4. **Composition root** (`main.ts`): `createAppRouter()` concatenates the manifests, adds the
   two system routes, installs the kernel, and registers feature guards. The router instance
   is a local variable of the entry: components use `useRouter()`, and setup/wiring modules
   accept a `Router` parameter injected by the entry (see `core/deeplink.ts`,
   `core/extensions/webview-navigation.ts`). There is no importable router singleton.

Page import rules:

1. Route records lazy-load page components from their concrete `.vue` files:
   `component: () => import('./pages/<page>.vue')`. Never import page components statically
   in a manifest: pages sit downstream of the shared composable graph, and a static page edge
   would defeat route-level code splitting and put pages on the entry's full-reload path.
2. Feature root `index.ts` barrels exist only for features consumed as components by other
   surfaces (adder, scraper, settings, about, task-center); route wiring never goes through
   them. Manifests import loaders from their owning modules.
3. Root `src/pages/` charter: system-owned route surfaces only. A page belongs there if and
   only if a core-level subsystem owns it, it imports no `features/*` code, and no feature code
   references it (two-way zero coupling). Current members: `not-found-page.vue` (owner: the
   app router in `main.ts`) and `extension-webview-page.vue` (owner: `core/extensions` webview
   runtime; its route name, pattern, and path builder are exported by
   `core/extensions/webview-navigation.ts` as the webview navigation contract). Every other
   page lives in its feature's `pages/` folder.

## Vue 3 SFC Patterns

### Component Structure

Always use `<script setup lang="ts">`:

```vue
<script setup lang="ts">
interface Props {
  gameId: string
  editable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  editable: false
})

// Access props via props.xxx, never destructure
const title = computed(() => props.gameId)
</script>
```

### Props Rules

- Define with `interface Props` + `defineProps<Props>()`
- Use `withDefaults()` for default values
- **Never destructure props** - access via `props.xxx`
- ESLint rule `vue/no-setup-props-reactivity-loss` enforces this

### v-model Pattern

Use `defineModel()` for two-way binding:

```typescript
// Simple boolean
const open = defineModel<boolean>('open', { required: true })

// With store binding (use computed wrapper)
const value = computed({
  get: () => store.value,
  set: (v) => store.setValue(v)
})
```

## Composables

### useAsyncData

Unified async data fetching with loading/error states. For dialogs and embedded blocks only;
route pages load data through route data loaders (see above):

```typescript
const { data, loading, error, refetch } = useAsyncData(() => fetchGameById(props.gameId), {
  enabled: () => open.value, // Only fetch when dialog is open
  immediate: true
})
```

### useRenderState

Manages render state with delayed loading (prevents flash):

```typescript
const state = useRenderState(data, error, {
  preset: 'network' // Longer delay for network requests
})

// States: 'loading' | 'pending' | 'error' | 'not-found' | 'success'
```

Template pattern:

```vue
<template>
  <div v-if="state === 'loading'"><Spinner /></div>
  <div v-else-if="state === 'error'">Error occurred</div>
  <div v-else-if="state === 'not-found'">Not found</div>
  <template v-else-if="state === 'success'">
    <Empty v-if="items.length === 0" />
    <div v-else>{{ items }}</div>
  </template>
</template>
```

**State semantics**:

- `pending`: Fast loading (within delay threshold), show blank/skeleton
- `loading`: Slow loading (past threshold), show spinner
- `success`: Data loaded (empty array is success, not not-found)
- `not-found`: Detail query returned `null`
- `error`: Request failed

### useDbChanges / useIpc

Subscribe to main-process pushes with auto-cleanup:

```typescript
// Db change feed (batched invalidation signal; branch on operation/table)
useDbChanges(({ operation, table, id }) => {
  if (operation === 'updated' && table === 'games' && id === props.gameId) {
    refetch()
  }
})

// Domain IPC pushes
useIpc('library:entity-merged', (_e, event) => {
  // Handle push
})
```

## Dialog Patterns

## Form Patterns

### `formData` Typing (Must Follow)

- Any local form state object named `formData` **must** be explicitly typed via a generic on `ref()` / `reactive()`.
- **Do not** use `as` type assertions inside the `formData` initializer (including `null as X`, `'foo' as SomeUnion`, `{} as Something`, or `as unknown as ...`).
  - If a value needs a specific type, fix it by typing the form model (`FormData`) and letting the initializer be context-typed.

Preferred:

```ts
interface FormData {
  title: string
  sortDirection: 'asc' | 'desc'
  coverFile: string | null
}

const formData = ref<FormData>({
  title: '',
  sortDirection: 'asc',
  coverFile: null
})
```

Also allowed (when you want the value to stay a narrow literal but still be checked):

```ts
interface FormData {
  layout: 'grid' | 'horizontal'
}

const formData = ref({
  layout: 'horizontal'
} satisfies FormData)
```

Forbidden:

```ts
const formData = ref({
  sortDirection: 'asc' as SortDirection,
  coverFile: null as string | null
})
```

### Mounting Control

Use `v-if` at call site to control dialog mounting:

```vue
<!-- Parent component -->
<GameDialog v-if="dialogOpen" v-model:open="dialogOpen" :game-id="selectedId" />
```

### Dialog Component Structure

```vue
<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true })

const { data, refetch } = useAsyncData(
  () => fetchData(),
  { enabled: () => open.value } // Gate requests to open state
)

// Local editable copy
const localData = ref<Data | null>(null)
watch(
  () => data.value,
  (newData) => {
    if (newData) localData.value = { ...newData }
  },
  { immediate: true }
)
</script>
```

### Preventing Close During Submit

```typescript
const isSubmitting = ref(false)

const openModel = computed({
  get: () => open.value,
  set: (v) => {
    if (!isSubmitting.value) open.value = v
  }
})
```

## State Management

### Pinia Stores

Use for UI state and cross-component short-lived state:

```typescript
export const useTaskRunStore = defineStore('task-run', () => {
  const runs = ref(new Map<string, TaskRun>())

  // For Map/Set, reassign to trigger reactivity
  function updateRun(run: TaskRun) {
    const newMap = new Map(runs.value)
    newMap.set(run.id, run)
    runs.value = newMap
  }

  return { runs, updateRun }
})
```

**Note**: Entity data should come from DB queries, not stores.

### Task Center and Long-Running Workflows

Renderer long-running workflow state should come from `useTaskRunStore()` and `task-run:*` IPC, not
from ad hoc component refs, command execution ids, scanner progress IPC, or loading toast ids.

Rules:

- Initialize the task-run store from both `task-run:list-active` and `task-run:list-history`, then
  subscribe to `task-run:changed` and `task-run:deleted`.
- Keep active and completed views separate in the store/UI. Active runs come from main memory;
  completed runs come from persisted final history.
- `task-run:changed` payloads are full snapshots. Replace the whole run in the `Map` and reassign
  the `Map`.
- The task center displays `category`, `operation`, `owner`, `initiator`, and `subject`. Route
  navigation is derived in renderer from `subject.type` and `subject.id`; `subject` does not include
  a route.
- Scanner pages derive active scan state by finding TaskRuns with
  `operation === 'scanner.scan'` and matching `subject.type === 'scanner'`. Do not maintain a second
  scanner active-progress source.
- Automation pages read automation configuration/history from automation APIs. They do not link to,
  store, or infer status from TaskRun ids.
- Long-running renderer flows should start a main-side task and then let task center observe the
  `runId`; renderer loops with `notify.loading` should be reserved for short, local interactions
  only.
- Loading toasts are optional TaskRun presentation. Closing a toast does not cancel the run and
  should not be used as application state.

## Search Patterns

- SFC: `<script setup lang="ts">`
- Props: `defineProps<`, `withDefaults(`, `props.`
- v-model: `defineModel(`, `v-model:open`
- Dialog mounting: `v-if="...open"`, `enabled: () => open.value`
- Composables: `useAsyncData(`, `useRenderState(`, `useDbChanges(`, `useIpc(`
- Route data: `defineRouteData(`, `meta.dataLoaders`, `RouteProvider`, `DialogProvider`
- TaskRun: `useTaskRunStore`, `task-run:changed`, `features/task-center`, `TaskRun`
- Forbidden: `watchEffect`, `watchPostEffect`, `watchSyncEffect`

## Constraints

- Must use `<script setup lang="ts">`
- Never destructure props
- Use `watch` with explicit dependencies, not `watchEffect`
- Dialog data requests must be gated by `open` state
- Use `computed` for derived state, not `watch` + ref
- Pinia stores for UI state only; entity data from DB
- For `Map`/`Set` in stores, reassign new instance to trigger reactivity

## Procedures

### Adding a Business Dialog

1. Create dialog component with `defineModel<boolean>('open')`:

   ```vue
   <script setup lang="ts">
   const open = defineModel<boolean>('open', { required: true })

   const { data } = useAsyncData(fetchData, {
     enabled: () => open.value
   })
   </script>
   ```

2. Use `v-if` at call site:

   ```vue
   <MyDialog v-if="showDialog" v-model:open="showDialog" />
   ```

3. For editable data, use `watch` to initialize local copy:
   ```typescript
   const localData = ref<Data | null>(null)
   watch(
     () => data.value,
     (d) => {
       if (d) localData.value = { ...d }
     },
     { immediate: true }
   )
   ```

## Related

- [UI System](ui-system.md) - Component styling and recipes
- [IPC & Events](ipc-events.md) - Event subscription
- [Conventions](conventions.md) - Async patterns
