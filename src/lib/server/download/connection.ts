import type { Database } from 'better-sqlite3';
import type { DownloadClientConnection } from './client';

interface ConnectionRow {
	url: string | null;
	username: string | null;
	password: string | null;
}

export function readConnection(db: Database): DownloadClientConnection | null {
	const row = db.prepare('select * from download_client where id = 1').get() as ConnectionRow;
	if (row.url === null || row.url === '') return null;
	return { url: row.url, username: row.username ?? '', password: row.password ?? '' };
}

export function writeConnection(db: Database, connection: DownloadClientConnection): void {
	db.prepare('update download_client set url = ?, username = ?, password = ? where id = 1').run(
		connection.url,
		connection.username,
		connection.password
	);
}
