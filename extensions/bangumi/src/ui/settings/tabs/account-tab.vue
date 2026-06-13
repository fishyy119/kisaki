<!-- Account Tab owns OAuth session actions and credential lifecycle. -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  Badge,
  Button,
  Field,
  FieldContent,
  FieldGroup,
  Icon,
  Spinner
} from '@kisaki3/extension-ui-vue'
import type { BangumiSettingsOverview } from '../../../shared/settings'
import { host, toErrorMessage } from '../rpc'
import SettingsSection from '../components/settings-section.vue'

interface Props {
  overview: BangumiSettingsOverview
}

const props = defineProps<Props>()

const emit = defineEmits<{
  refresh: []
  error: [message: string]
}>()

const busyAction = ref<string | null>(null)
const verifiedNickname = ref<string | null>(null)

const account = computed(() => props.overview.account)
const accountUsername = computed(() => account.value.username?.trim() || null)
const accountProfileUrl = computed(() =>
  account.value.loggedIn && accountUsername.value
    ? `https://bgm.tv/user/${encodeURIComponent(accountUsername.value)}`
    : null
)
const summary = computed(() =>
  account.value.loggedIn && account.value.nickname ? account.value.nickname : '未登录'
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

function openAccountProfile(): void {
  if (!accountProfileUrl.value) {
    return
  }

  void host.openExternal(accountProfileUrl.value).catch((error) => {
    emit('error', toErrorMessage(error))
  })
}
</script>

<template>
  <div class="space-y-4">
    <SettingsSection
      title="Bangumi 账号"
      surface="rows"
    >
      <FieldGroup>
        <Field
          orientation="horizontal"
          label="登录状态"
          :description="verifiedNickname ? `账号验证成功：${verifiedNickname}` : undefined"
        >
          <FieldContent class="flex-row items-center justify-end">
            <span
              class="min-w-0 truncate text-sm"
              :class="account.loggedIn ? '' : 'text-muted-foreground'"
            >
              {{ summary }}
              <span
                v-if="accountUsername"
                class="ml-1 inline-flex text-muted-foreground"
              >
                <a
                  v-if="accountProfileUrl"
                  :href="accountProfileUrl"
                  class="rounded-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  @click.prevent="openAccountProfile"
                >
                  @{{ accountUsername }}
                </a>
                <span
                  v-else
                  class="text-muted-foreground"
                >
                  @{{ accountUsername }}
                </span>
              </span>
            </span>
          </FieldContent>
        </Field>

        <Field
          orientation="horizontal"
          label="访问令牌"
        >
          <FieldContent class="flex-row items-center gap-2">
            <Badge :variant="account.hasToken ? 'success' : 'secondary'">
              {{ account.hasToken ? '已保存' : '未保存' }}
            </Badge>
            <Badge
              v-if="account.hasRefreshToken"
              variant="secondary"
            >
              可刷新
            </Badge>
            <Badge
              v-if="account.expired"
              variant="warning"
            >
              已过期
            </Badge>
          </FieldContent>
        </Field>

        <Field
          v-if="expiresAtLabel"
          orientation="horizontal"
          label="凭据有效期"
        >
          <FieldContent class="flex-row items-center">
            <span class="text-sm">{{ expiresAtLabel }}</span>
          </FieldContent>
        </Field>
      </FieldGroup>
    </SettingsSection>

    <SettingsSection title="账号操作">
      <div class="flex flex-wrap items-center gap-2">
        <Button
          v-if="!account.loggedIn"
          size="sm"
          type="button"
          :disabled="busyAction !== null"
          @click="login"
        >
          <Spinner v-if="busyAction === 'login'" />
          <Icon
            v-else
            icon="icon-[mdi--login]"
            class="size-3.5"
          />
          登录 Bangumi
        </Button>
        <Button
          variant="outline"
          size="sm"
          type="button"
          :disabled="!account.hasToken || busyAction !== null"
          @click="verify"
        >
          <Spinner v-if="busyAction === 'verify'" />
          <Icon
            v-else
            icon="icon-[mdi--account-check-outline]"
            class="size-3.5"
          />
          验证账号
        </Button>
        <Button
          variant="outline"
          size="sm"
          type="button"
          :disabled="
            !account.hasRefreshToken ||
            busyAction !== null ||
            props.overview.activeJobs.accountRefresh
          "
          @click="refreshCredentials"
        >
          <Spinner v-if="busyAction === 'refresh' || props.overview.activeJobs.accountRefresh" />
          <Icon
            v-else
            icon="icon-[mdi--refresh]"
            class="size-3.5"
          />
          刷新凭据
        </Button>
        <Button
          v-if="account.loggedIn"
          variant="destructive"
          size="sm"
          type="button"
          :disabled="busyAction !== null"
          @click="logout"
        >
          <Spinner v-if="busyAction === 'logout'" />
          <Icon
            v-else
            icon="icon-[mdi--logout]"
            class="size-3.5"
          />
          退出登录
        </Button>
      </div>
    </SettingsSection>
  </div>
</template>
