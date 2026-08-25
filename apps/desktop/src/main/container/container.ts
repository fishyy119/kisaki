/**
 * Service Container
 *
 * Manages service registration, initialization, and disposal.
 *
 * Lifecycle is explicitly two-phase:
 * 1) register(): add service instances (no side effects)
 * 2) initAll(): initialize services in dependency order
 *
 * On shutdown, services are disposed in reverse init order.
 */

import type { IService, ServiceStatus, ServiceName, ServiceType } from './types'
import { createLogger } from '@main/log'

const log = createLogger('Container')

export class ServiceContainer {
  private services = new Map<string, IService>()
  private serviceStatus = new Map<string, ServiceStatus>()
  private initOrder: string[] = []

  /**
   * Register a service instance. Synchronous by contract: registration has no
   * side effects, so nothing can await between two registrations.
   */
  register<T extends IService>(service: T): void {
    if (this.services.has(service.id)) {
      throw new Error(`Service "${service.id}" is already registered`)
    }

    this.services.set(service.id, service)
    this.serviceStatus.set(service.id, 'registered')
    log.info('Service registered.', { serviceId: service.id })
  }

  /**
   * Initialize all registered services in dependency order.
   */
  async initAll(): Promise<void> {
    if (this.services.size === 0) {
      throw new Error('[Container] No services registered')
    }

    const initOrder = this.computeInitOrder()
    log.info('Service initialization started.', { serviceCount: initOrder.length })

    // Reset init order for this run (idempotent initAll is not supported).
    this.initOrder = []

    let failedServiceId: string | null = null

    try {
      for (const id of initOrder) {
        const service = this.services.get(id)
        if (!service) {
          throw new Error(`[Container] Internal error: missing registered service "${id}"`)
        }

        this.serviceStatus.set(id, 'initializing')
        try {
          await service.init(this)
          this.serviceStatus.set(id, 'ready')
          this.initOrder.push(id)
          log.info('Service ready.', { serviceId: id })
        } catch (error) {
          this.serviceStatus.set(id, 'failed')
          failedServiceId = id
          throw error
        }
      }

      log.info('Service initialization completed.')
    } catch (error) {
      await this.rollbackInit()
      log.error('Service initialization failed.', error, { failedServiceId: failedServiceId })
      throw new Error('Failed to initialize services.', { cause: error })
    }
  }

  /**
   * Get a service by name.
   *
   * Typed by the service registry on purpose: there is no `string` overload, so
   * a mistyped id fails to compile instead of failing at startup.
   * @throws Error if service not registered or not ready
   */
  get<K extends ServiceName>(name: K): ServiceType<K> {
    const service = this.services.get(name)
    if (!service) {
      throw new Error(`Service "${name}" not found`)
    }

    const status = this.serviceStatus.get(name)
    if (status !== 'ready') {
      throw new Error(`Service "${name}" is not ready (status: ${status ?? 'unknown'})`)
    }
    return service as ServiceType<K>
  }

  /**
   * Dispose all initialized services in reverse init order.
   * Called during application shutdown.
   */
  async disposeAll(): Promise<void> {
    log.info('Service disposal started.')

    const reverseOrder = [...this.initOrder].reverse()
    for (const name of reverseOrder) {
      const service = this.services.get(name)
      if (service?.dispose && this.serviceStatus.get(name) === 'ready') {
        log.info('Service disposing.', { serviceId: name })
        this.serviceStatus.set(name, 'disposing')
        try {
          await service.dispose()
          this.serviceStatus.set(name, 'disposed')
        } catch (error) {
          log.error('Service disposal failed.', error, { serviceId: name })
        }
      }
    }

    this.services.clear()
    this.serviceStatus.clear()
    this.initOrder = []
    log.info('Service disposal completed.')
  }

  private computeInitOrder(): string[] {
    const graph = new Map<string, readonly string[]>()

    for (const [id, service] of this.services) {
      graph.set(id, service.deps ?? [])
    }

    // Validate missing dependencies early
    for (const [id, deps] of graph) {
      for (const dep of deps) {
        if (!graph.has(dep)) {
          throw new Error(
            `[Container] Service "${id}" depends on missing service "${dep}". Registered: ${[
              ...graph.keys()
            ].join(', ')}`
          )
        }
      }
    }

    // Kahn's algorithm for topological sort
    const inDegree = new Map<string, number>()
    const dependents = new Map<string, string[]>()
    for (const id of graph.keys()) {
      inDegree.set(id, 0)
      dependents.set(id, [])
    }
    for (const [id, deps] of graph) {
      for (const dep of deps) {
        inDegree.set(id, (inDegree.get(id) ?? 0) + 1)
        dependents.get(dep)!.push(id)
      }
    }

    const queue: string[] = []
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id)
    }

    const order: string[] = []
    while (queue.length > 0) {
      const id = queue.shift()!
      order.push(id)

      for (const next of dependents.get(id) ?? []) {
        const deg = (inDegree.get(next) ?? 0) - 1
        inDegree.set(next, deg)
        if (deg === 0) queue.push(next)
      }
    }

    if (order.length !== graph.size) {
      const remaining = [...graph.keys()].filter((id) => !order.includes(id))
      const cycle = this.findCycle(graph, remaining[0])
      const cycleText = cycle ? cycle.join(' -> ') : remaining.join(', ')
      throw new Error(`[Container] Circular dependency detected: ${cycleText}`)
    }

    return order
  }

  private findCycle(graph: Map<string, readonly string[]>, start?: string): string[] | null {
    if (!start) return null

    const visiting = new Set<string>()
    const visited = new Set<string>()
    const stack: string[] = []

    const dfs = (id: string): string[] | null => {
      visiting.add(id)
      stack.push(id)

      for (const dep of graph.get(id) ?? []) {
        if (!visited.has(dep)) {
          if (visiting.has(dep)) {
            const idx = stack.indexOf(dep)
            const cycle = stack.slice(idx)
            return [...cycle, dep]
          }
          const found = dfs(dep)
          if (found) return found
        }
      }

      visiting.delete(id)
      visited.add(id)
      stack.pop()
      return null
    }

    return dfs(start)
  }

  private async rollbackInit(): Promise<void> {
    if (this.initOrder.length === 0) return

    log.warn('Service initialization rollback started.')

    const reverse = [...this.initOrder].reverse()
    for (const id of reverse) {
      const service = this.services.get(id)
      if (!service?.dispose) continue

      log.info('Service disposing during rollback.', { serviceId: id })
      this.serviceStatus.set(id, 'disposing')
      try {
        await service.dispose()
        this.serviceStatus.set(id, 'disposed')
      } catch (error) {
        log.error('Service disposal failed during rollback.', error, { serviceId: id })
      }
    }

    this.initOrder = []
    log.warn('Service initialization rollback completed.')
  }
}

/**
 * Global service container instance
 */
export const container = new ServiceContainer()
