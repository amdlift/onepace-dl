/**
 * The sentence to show a person for something that was thrown, whatever it turned out to be.
 * Every slice that reports a failure it caught — a scrape, a poll, a grab, an import, the
 * Download Client — says it the same way.
 */
export const reasonOf = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);
