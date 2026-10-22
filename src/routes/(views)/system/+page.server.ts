import { healthChecks } from '../../../lib/server/health/checks';
import { countHistory, readHistory } from '../../../lib/server/history/store';
import { getApp } from '../../../lib/server/runtime';
import type { PageServerLoad } from './$types';

const pageSize = 100;

export const load: PageServerLoad = async ({ url }) => {
	const app = getApp();
	// The one view whose job is to say whether Pacerr works asks the Download Client rather than
	// reporting whatever the last unrelated operation happened to learn.
	await app.downloads.test();

	const total = countHistory(app.db);
	const from = Math.max(0, Math.min(Number(url.searchParams.get('from') ?? 0) || 0, total));

	return {
		checks: healthChecks(app),
		unmatched: app.releases.unmatched(),
		history: {
			entries: readHistory(app.db, pageSize, from),
			from,
			total,
			newer: from === 0 ? null : Math.max(0, from - pageSize),
			older: from + pageSize < total ? from + pageSize : null
		}
	};
};
