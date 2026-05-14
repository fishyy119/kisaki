import type {
  CommandContribution,
  CommandExecuteRequest,
  CommandRegistration,
  SerializableValue
} from '@kisaki/extension-api'
import { validateCommandContributionShape } from '@kisaki/extension-api'
import { requireRuntimeByScope, throwValidationIssues } from '../utils'
import type { HostContributionDomainOptions, HostContributionScope } from '../types'
import { createContributionRegistration } from '../registration'
import { toSerializableValue } from '../../sdk-bridge/utils/serialization'

export class HostCommandContributionPoint {
  constructor(private readonly options: HostContributionDomainOptions) {}

  register(scope: HostContributionScope, command: CommandContribution): CommandRegistration {
    const issues = validateCommandContributionShape(command)
    if (issues.length > 0) {
      throwValidationIssues('Command contribution', issues)
    }

    const runtime = requireRuntimeByScope(this.options.registry, scope)
    if (runtime.commands.has(command.id)) {
      throw new Error(`Command "${command.id}" is already registered by "${scope.extensionId}".`)
    }

    this.options.registry.registerCommand(scope.extensionId, command)

    const request = this.options.rpc.requestMain(
      'contributions.commands.register',
      {
        runtimeHandle: scope.runtimeHandle,
        command: toCommandRegistrationRpcInput(command)
      },
      this.options.getRequestOptions(scope)
    )
    const registration = createContributionRegistration({
      scope,
      label: `Command contribution "${command.id}"`,
      mainRegistration: request,
      reportDiagnostic: (diagnostic) => this.options.reportDiagnostic(scope, diagnostic),
      disposeLocal: () => {
        this.options.registry.unregisterCommand(scope.extensionId, command.id)
      },
      unregisterMain: () =>
        this.options.rpc.requestMain(
          'contributions.commands.unregister',
          {
            runtimeHandle: scope.runtimeHandle,
            commandId: command.id
          },
          this.options.getCleanupRequestOptions(scope)
        ),
      invalidateLocal: () => {
        this.options.registry.unregisterCommand(scope.extensionId, command.id)
      },
      onSyncFailure: (error) => {
        runtime.context.logger.error(
          `Command contribution "${command.id}" was disabled because main registry synchronization failed.`,
          error
        )
      }
    })

    this.options.trackMainRequest(scope, registration.sync)
    return registration
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
