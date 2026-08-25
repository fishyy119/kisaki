/**
 * Local shim replacing upstream's vendored fflate build with the npm package,
 * so the bundler owns the dependency instead of a checked-in binary blob.
 */
export * from 'fflate'
