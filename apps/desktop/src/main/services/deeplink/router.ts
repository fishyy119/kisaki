import {
  compileDeeplinkRoutePattern,
  matchDeeplinkRoutePattern,
  type CompiledDeeplinkRoutePattern,
  type DeeplinkRequest
} from '@shared/deeplink'
import type {
  DeeplinkOutcome,
  DeeplinkRouteContext,
  DeeplinkRouteHandler,
  DeeplinkRouteOptions
} from './types'

interface DeeplinkRouteRecord {
  compiled: CompiledDeeplinkRoutePattern
  handler: DeeplinkRouteHandler
  options: DeeplinkRouteOptions
  order: number
}

export interface DeeplinkRouteMatch {
  pattern: string
  focus: boolean
  execute(): Promise<DeeplinkOutcome>
}

/**
 * The single routing table of the `kisaki://` URL space. Route owners
 * (the deeplink service, domain services, the extension system) register
 * their patterns here; matching is most-specific-wins.
 */
export class DeeplinkRouter {
  private routes: DeeplinkRouteRecord[] = []
  private nextOrder = 0

  register<const TPattern extends string>(
    pattern: TPattern,
    handler: DeeplinkRouteHandler<TPattern>,
    options: DeeplinkRouteOptions
  ): () => void {
    const compiled = compileDeeplinkRoutePattern(pattern)
    if (this.routes.some((route) => route.compiled.pattern === compiled.pattern)) {
      throw new Error(`Deeplink route "${compiled.pattern}" is already registered.`)
    }

    const record: DeeplinkRouteRecord = {
      compiled,
      handler: handler as unknown as DeeplinkRouteHandler,
      options,
      order: this.nextOrder++
    }
    this.routes.push(record)
    this.routes.sort(
      (left, right) => right.compiled.score - left.compiled.score || left.order - right.order
    )

    return () => {
      this.routes = this.routes.filter((route) => route !== record)
    }
  }

  match(request: DeeplinkRequest): DeeplinkRouteMatch | null {
    for (const route of this.routes) {
      const params = matchDeeplinkRoutePattern(route.compiled, request.path)
      if (!params) {
        continue
      }

      const context: DeeplinkRouteContext = {
        ...request,
        pattern: route.compiled.pattern,
        params
      }
      return {
        pattern: route.compiled.pattern,
        focus: route.options.focus,
        execute: () => executeRoute(route, context)
      }
    }

    return null
  }
}

/** Handler failures become failed outcomes; the service logs them once. */
async function executeRoute(
  route: DeeplinkRouteRecord,
  context: DeeplinkRouteContext
): Promise<DeeplinkOutcome> {
  try {
    return await route.handler(context)
  } catch (error) {
    return {
      status: 'failed',
      message: error instanceof Error ? error.message : 'Deeplink route handler failed.'
    }
  }
}
