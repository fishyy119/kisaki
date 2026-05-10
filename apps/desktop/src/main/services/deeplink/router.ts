import type {
  DeeplinkResult,
  DeeplinkRouteContext,
  DeeplinkRouteHandler,
  ParsedDeeplink
} from './types'
import {
  compileDeeplinkRoutePattern,
  matchDeeplinkRoutePathInfo,
  type CompiledDeeplinkRoutePattern
} from './route-pattern'

interface DeeplinkRouteRecord {
  compiled: CompiledDeeplinkRoutePattern
  handler: DeeplinkRouteHandler
  order: number
}

export class DeeplinkRouter {
  private routes: DeeplinkRouteRecord[] = []
  private nextOrder = 0

  register<const TPattern extends string>(
    pattern: TPattern,
    handler: DeeplinkRouteHandler<TPattern>
  ): () => void {
    const compiled = compileDeeplinkRoutePattern(pattern)
    if (this.routes.some((route) => route.compiled.pattern === compiled.pattern)) {
      throw new Error(`Deeplink route "${compiled.pattern}" is already registered.`)
    }

    const record: DeeplinkRouteRecord = {
      compiled,
      handler: handler as unknown as DeeplinkRouteHandler,
      order: this.nextOrder++
    }
    this.routes.push(record)
    this.sortRoutes()

    return () => {
      this.routes = this.routes.filter((route) => route !== record)
    }
  }

  unregister(pattern: string): void {
    const compiled = compileDeeplinkRoutePattern(pattern)
    this.routes = this.routes.filter((route) => route.compiled.pattern !== compiled.pattern)
  }

  async route(deeplink: ParsedDeeplink): Promise<DeeplinkResult> {
    for (const route of this.routes) {
      const match = matchDeeplinkRoutePathInfo(route.compiled, deeplink.path)
      if (!match) {
        continue
      }

      const context: DeeplinkRouteContext = {
        ...deeplink,
        path: match.path,
        pattern: route.compiled.pattern,
        params: match.params
      }
      return route.handler.handle(context)
    }

    return {
      success: false,
      path: deeplink.path,
      message: `No deeplink route matched: ${deeplink.path}`
    }
  }

  listRoutes(): { pattern: string }[] {
    return this.routes.map((route) => ({ pattern: route.compiled.pattern }))
  }

  hasRoute(pattern: string): boolean {
    const compiled = compileDeeplinkRoutePattern(pattern)
    return this.routes.some((route) => route.compiled.pattern === compiled.pattern)
  }

  private sortRoutes(): void {
    this.routes.sort(
      (left, right) => right.compiled.score - left.compiled.score || left.order - right.order
    )
  }
}
