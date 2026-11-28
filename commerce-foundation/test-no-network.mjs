// Loaded before all test files. All provider calls must use injected mocks.
globalThis.fetch = async () => { throw new Error('REAL_NETWORK_DISABLED_IN_TESTS'); };
