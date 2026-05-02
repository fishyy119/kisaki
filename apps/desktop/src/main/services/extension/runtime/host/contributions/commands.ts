import type {
  CommandContribution,
  CommandExecuteRequest,
  SerializableValue
} from '@kisaki/extension-api'
import {
  createContributionDisposable,
  requireRuntimeByScope,
  type ContributionDisposable,
  type HostContributionDomainOptions,
  type HostContributionScope
} from './types'
import { toSerializableValue } from '../sdk-bridge/utils/serialization'

export class HostCommandContributions {
  constructor(private readonly options: HostContributionDomainOptions) {}

  register(
    scope: HostContributionScope,
    command: CommandContribution
  ): Promise<ContributionDisposable> {
    const runtime = requireRuntimeByScope(this.options.registry, scope)
    if (runtime.commands.has(command.id)) {
      throw new Error(`Command "${command.id}" is already registered by "${scope.extensionId}".`)
    }

    this.options.registry.registerCommand(scope.extensionId, command)

    const request = this.options.rpc
      .requestMain(
        'contributions.commands.register',
        {
          runtimeHandle: scope.runtimeHandle,
          command: toCommandRegistrationRpcInput(command)
        },
        this.options.getRequestOptions(scope)
      )
      .catch((error) => {
        this.options.registry.unregisterCommand(scope.extensionId, command.id)
        throw error
      })
    this.options.trackMainRequest(scope, request)

    return request.then(() =>
      createContributionDisposable(async () => {
        await this.unregister(scope, command.id, true)
      })
    )
  }

  async unregister(
    scope: HostContributionScope,
    commandId: string,
    notifyMain: boolean
  ): Promise<void> {
    this.options.registry.unregisterCommand(scope.extensionId, commandId)

    if (!notifyMain) {
      return
    }

    await this.options.rpc.requestMain(
      'contributions.commands.unregister',
      {
        runtimeHandle: scope.runtimeHandle,
        commandId
      },
      this.options.getCleanupRequestOptions(scope)
    )
  }

  async execute(
    request: CommandExecuteRequest,
    signal: AbortSignal
  ): Promise<{ output?: SerializableValue }> {
    const runtime = this.options.registry.getByRuntimeHandle(request.runtimeHandle)
    if (!runtime) {
      throw new Error(`Extension runtime "${request.runtimeHandle}" is not active.`)
    }

    const command = runtime.commands.get(request.commandId)
    if (!command) {
      throw new Error(
        `Command "${request.commandId}" is not registered for "${runtime.metadata.id}".`
      )
    }

    const output = await this.options.runInExtensionContext(runtime, () =>
      command.execute(request.args, {
        commandId: request.commandId,
        executionId: request.executionId,
        source: request.source,
        signal
      })
    )

    if (output === undefined) {
      return {}
    }

    return {
      output: toSerializableValue(output, 'command output')
    }
  }

  releaseRuntime(runtimeHandle: string): void {
    this.options.registry.getByRuntimeHandle(runtimeHandle)?.commands.clear()
  }

  releaseAll(): void {
    for (const runtime of this.options.registry.list()) {
      runtime.commands.clear()
    }
  }
}

function toCommandRegistrationRpcInput(command: CommandContribution) {
  return {
    id: command.id,
    title: command.title,
    description: command.description,
    argsSchema: command.argsSchema,
    defaultArgs: command.defaultArgs,
    dangerLevel: command.dangerLevel,
    cancelable: command.cancelable
  }
}
