/**
 * Public surface of the ingest service.
 *
 * Handlers, graph builders, and pipeline internals are reached through the
 * service namespaces; nothing outside ingest constructs them directly.
 */

export { IngestService } from './service'
