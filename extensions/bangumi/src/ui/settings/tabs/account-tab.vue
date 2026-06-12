<!--
Account Tab manages the Bangumi login session: OAuth login, verification,
credential refresh, and logout.
Boundary: renders `overview.account` and emits refresh/error to the app shell.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
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
  <section>
    <div class="field">
      <div class="field-info">
        <span class="field-label">登录状态</span>
        <span
          v-if="verifiedNickname"
          class="field-hint"
        >
          账号验证成功：{{ verifiedNickname }}
        </span>
      </div>
      <div class="field-control">
        <span :class="account.loggedIn ? '' : 'text-muted-foreground'">{{ summary }}</span>
      </div>
    </div>

    <div
      v-if="expiresAtLabel"
      class="field"
    >
      <div class="field-info">
        <span class="field-label">凭据有效期</span>
      </div>
      <div class="field-control">
        <span :class="account.expired ? 'text-danger' : ''">{{ expiresAtLabel }}</span>
      </div>
    </div>

    <div class="field">
      <div class="field-info">
        <span class="field-label">账号操作</span>
        <span class="field-hint">登录通过浏览器完成，回调后自动刷新此页面。</span>
      </div>
      <div class="field-control">
        <button
          v-if="!account.loggedIn"
          type="button"
          class="border-transparent bg-primary text-primary-foreground"
          :disabled="busyAction !== null"
          @click="login"
        >
          登录
        </button>
        <button
          type="button"
          :disabled="!account.hasToken || busyAction !== null"
          @click="verify"
        >
          验证账号
        </button>
        <button
          type="button"
          :disabled="
            !account.hasRefreshToken || busyAction !== null || overview.activeJobs.accountRefresh
          "
          @click="refreshCredentials"
        >
          刷新凭据
        </button>
        <button
          v-if="account.loggedIn"
          type="button"
          class="border-transparent bg-danger text-primary-foreground"
          :disabled="busyAction !== null"
          @click="logout"
        >
          退出
        </button>
      </div>
    </div>
  </section>
</template>
