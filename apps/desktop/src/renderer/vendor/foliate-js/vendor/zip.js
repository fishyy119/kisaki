/**
 * Local shim replacing upstream's vendored zip.js build with the npm package,
 * so the bundler owns the dependency instead of a checked-in binary blob.
 */
export * from '@zip.js/zip.js'
