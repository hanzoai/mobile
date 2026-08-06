// The unit gate covers the PURE modules only — the SSE grammar, the run
// registry, catalog selection, widget serialization. No native tree, no
// jsdom. Repo types are gated by tsc --noEmit; ts-jest only transpiles, so
// the two tools cannot disagree about what the code means.
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tests/tsconfig.json', diagnostics: false }],
  },
  moduleNameMapper: {
    // The expo runtime is not present under node; each shim is the smallest
    // honest stand-in for the one thing a pure module imports.
    '^expo/fetch$': '<rootDir>/tests/stubs/fetch.ts',
    '^expo-auth-session$': '<rootDir>/tests/stubs/oauth.ts',
    '^expo-modules-core$': '<rootDir>/tests/stubs/modules.ts',
    '^expo-secure-store$': '<rootDir>/tests/stubs/keychain.ts',
    '^@/(.*)$': '<rootDir>/$1',
  },
}
