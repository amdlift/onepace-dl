import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
		// Timestamps render in the host's zone, so an unpinned suite asserts a different
		// string on every developer's machine.
		env: { TZ: 'UTC' },
		globalSetup: ['./tests/harness/build.ts'],
		testTimeout: 30_000,
		hookTimeout: 30_000
	}
});
