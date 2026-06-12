import { protocol } from 'electron'

export interface ProtocolHandlerSlot {
  /**
   * Makes the given handler the active receiver for the scheme, registering
   * the Electron protocol handler on first activation.
   */
  activate(handler: (request: Request) => Promise<Response>): void
}

/**
 * Routes a custom scheme to a replaceable handler. Electron allows only one
 * `protocol.handle` registration per scheme for the process lifetime, while
 * the owning service object is recreated across service restarts; the slot
 * registers once and forwards requests to the most recently activated owner.
 */
export function createProtocolHandlerSlot(
  scheme: string,
  unavailableMessage: string
): ProtocolHandlerSlot {
  let registered = false
  let activeHandler: ((request: Request) => Promise<Response>) | null = null

  return {
    activate(handler) {
      activeHandler = handler
      if (registered) {
        return
      }

      protocol.handle(scheme, (request) => {
        if (!activeHandler) {
          return new Response(unavailableMessage, { status: 503 })
        }

        return activeHandler(request)
      })
      registered = true
    }
  }
}
