import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
		globalSetup: ['./tests/harness/build.ts'],
		testTimeout: 30_000,
		hookTimeout: 30_000
	}
});
