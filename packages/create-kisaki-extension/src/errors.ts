/** Expected user-facing scaffold failure. */
export class ScaffoldCliError extends Error {}

/** User cancellation without a partial scaffold result. */
export class ScaffoldCancelledError extends ScaffoldCliError {
  constructor() {
    super('Operation cancelled.')
  }
}
