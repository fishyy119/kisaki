<!--
Account Tab manages the Bangumi login session: OAuth login, verification,
credential refresh, and logout.
Boundary: renders `overview.account` and emits refresh/error to the app shell.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { Badge, Button, Field, FieldContent, FieldGroup } from '@kisaki3/extension-ui-vue'
import type { BangumiSettingsOverview } from '../../../shared/settings'
import { host, toErrorMessage } from '../rpc'

interface Props {
  overview: BangumiSettingsOverview
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'error', message: string): void
}>()

const busyAction = ref<string | null>(null)
const verifiedNickname = ref<string | null>(null)

const account = computed(() => props.overview.account)
const summary = computed(() =>
  account.value.loggedIn && account.value.nickname
    ? `${account.value.nickname} (@${account.value.username ?? ''})`
    : '未登录'
)
const expiresAtLabel = computed(() => {
  if (!account.value.hasToken || account.value.expiresAt === null) {
    return null
  }

  return new Date(account.value.expiresAt).toLocaleString('zh-CN', { hour12: false })
})

async function runAction(action: string, run: () => Promise<void>): Promise<void> {
  if (busyAction.value) {
    return
  }

  busyAction.value = action
  try {
    await run()
    emit('refresh')
  } catch (error) {
    emit('error', toErrorMessage(error))
  } finally {
    busyAction.value = null
  }
}

function login(): void {
  void runAction('login', () => host.login())
}

function verify(): void {
  void runAction('verify', async () => {
    const result = await host.verifyAccount()
    verifiedNickname.value = result.nickname
  })
}

function refreshCredentials(): void {
  void runAction('refresh', () => host.refreshCredentials())
}

function logout(): void {
  void runAction('logout', () => host.logout())
}
</script>

<template>
  <FieldGroup>
    <Field
      orientation="horizontal"
      label="登录状态"
      :description="verifiedNickname ? `账号验证成功：${verifiedNickname}` : undefined"
    >
      <FieldContent class="flex-row items-center">
        <span
          class="text-sm"
          :class="account.loggedIn ? '' : 'text-muted-foreground'"
        >
          {{ summary }}
        </span>
      </FieldContent>
    </Field>

    <Field
      v-if="expiresAtLabel"
      orientation="horizontal"
      label="凭据有效期"
    >
      <FieldContent class="flex-row items-center gap-2">
        <span class="text-sm">{{ expiresAtLabel }}</span>
        <Badge
          v-if="account.expired"
          variant="destructive"
        >
          已过期
        </Badge>
      </FieldContent>
    </Field>

    <Field
      orientation="horizontal"
      label="账号操作"
      description="登录通过浏览器完成，回调后自动刷新此页面。"
    >
      <FieldContent class="flex-row items-center gap-2">
        <Button
          v-if="!account.loggedIn"
          type="button"
          :disabled="busyAction !== null"
          @click="login"
        >
          登录
        </Button>
        <Button
          variant="outline"
          type="button"
          :disabled="!account.hasToken || busyAction !== null"
          @click="verify"
        >
          验证账号
        </Button>
        <Button
          variant="outline"
          type="button"
          :disabled="
            !account.hasRefreshToken || busyAction !== null || overview.activeJobs.accountRefresh
          "
          @click="refreshCredentials"
        >
          刷新凭据
        </Button>
        <Button
          v-if="account.loggedIn"
          variant="destructive"
          type="button"
          :disabled="busyAction !== null"
          @click="logout"
        >
          退出
        </Button>
      </FieldContent>
    </Field>
  </FieldGroup>
</template>
