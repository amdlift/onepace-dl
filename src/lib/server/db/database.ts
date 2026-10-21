import Database from 'better-sqlite3';

export type { Database } from 'better-sqlite3';

const migrations = [
	`
	create table arc (
		slug text primary key,
		position integer not null,
		title text not null,
		description text,
		special integer not null,
		unfinished integer not null,
		chapters text,
		episodes text,
		cover_image_url text
	);
	create table part (
		slug text primary key,
		arc_slug text not null references arc(slug) on delete cascade,
		position integer not null,
		number integer not null,
		title text not null,
		description text,
		chapters text,
		episodes text,
		to_be_redone integer not null
	);
	create index part_by_arc on part(arc_slug);
	create table unreleased_part (
		arc_slug text not null references arc(slug) on delete cascade,
		number integer not null,
		primary key (arc_slug, number)
	);
	create table catalogue_release (
		infohash text primary key,
		arc_slug text not null,
		resolution integer not null,
		variant text not null,
		size_label text,
		batch_complete integer,
		batch_part_count integer,
		batch_part_range text
	);
	create table catalogue_release_part (
		infohash text not null references catalogue_release(infohash) on delete cascade,
		part_slug text not null,
		primary key (infohash, part_slug)
	);
	create table catalogue_source (
		id integer primary key check (id = 1),
		body_sha256 text,
		etag text,
		last_modified text,
		checked_at text,
		updated_at text,
		failure text
	);
	insert into catalogue_source (id) values (1);
	`,
	`
	create table authentication (
		id integer primary key check (id = 1),
		enabled integer not null,
		username text,
		password_hash text
	);
	insert into authentication (id, enabled) values (1, 0);
	create table session (
		id text primary key,
		created_at text not null,
		expires_at text not null
	);
	`,
	`
	create table feed_release (
		infohash text primary key,
		title text not null,
		published_at text not null,
		variant text not null,
		status text not null,
		resolution integer,
		chapters text,
		episodes text,
		magnet_uri text,
		torrent_url text
	);
	create table feed_source (
		id integer primary key check (id = 1),
		last_build_date text,
		etag text,
		last_modified text,
		checked_at text,
		updated_at text,
		failure text
	);
	insert into feed_source (id) values (1);
	`,
	`
	-- The Catalogue is replaced wholesale by every clean scrape, so none of these reference it:
	-- a standing instruction has to outlive the rows it names.
	create table monitored_arc (
		arc_slug text primary key
	);
	create table not_wanted_part (
		part_slug text primary key
	);
	create table had_part (
		part_slug text primary key,
		library_path text not null,
		infohash text,
		had_at text not null
	);
	`,
	`
	create table profile (
		id integer primary key check (id = 1),
		resolutions text not null,
		variant text not null,
		cutoff integer not null
	);
	insert into profile (id, resolutions, variant, cutoff)
		values (1, '[1080,720,480]', 'regular', 1080);
	`,
	`
	create table download_client (
		id integer primary key check (id = 1),
		url text,
		username text,
		password text
	);
	insert into download_client (id) values (1);
	create table grab (
		infohash text primary key,
		release_title text not null,
		batch integer not null,
		grabbed_at text not null
	);
	create table grab_part (
		infohash text not null references grab(infohash) on delete cascade,
		part_slug text not null,
		primary key (infohash, part_slug)
	);
	-- Both the Catalogue and the feed are replaced wholesale, so History keeps its own copy of
	-- every name it states: an event has to stay readable once the rows it names are gone.
	create table history (
		id integer primary key,
		at text not null,
		event text not null,
		outcome text not null,
		part_slug text,
		part_title text,
		infohash text,
		release_title text,
		replaced_infohash text,
		detail text,
		reason text
	);
	create index history_by_time on history(at desc, id desc);
	`,
	`
	alter table catalogue_source add column outcome text;
	alter table feed_source add column outcome text;
	`,
	`
	-- Where each Arc sits in the Library, fixed on first sight. Deliberately not derived from
	-- arc.position, which the next clean scrape is free to change.
	create table arc_library_index (
		arc_slug text primary key,
		library_index integer not null
	);
	-- Null means "whatever Pacerr ships as the default", so that default lives in one place.
	create table naming_template (
		id integer primary key check (id = 1),
		template text
	);
	insert into naming_template (id) values (1);
	`,
	`
	-- Library index zero is the one index many Arcs share, so the Parts filed under it would
	-- otherwise all claim the same place in it. Fixed on first sight, for the same reason
	-- arc_library_index is: a special published upstream tomorrow must not move the ones a
	-- Library already holds.
	create table part_library_index (
		part_slug text primary key,
		library_index integer not null
	);
	`,
	`
	create table remote_path_mapping (
		id integer primary key,
		remote_path text not null,
		local_path text not null
	);
	`,
	`
	-- Null means Manual Import has nowhere to look, which is the state Pacerr ships in: there is
	-- no sensible default directory of files the user already has.
	create table import_source (
		id integer primary key check (id = 1),
		path text
	);
	insert into import_source (id) values (1);
	`,
	`
	-- An Upgrade in flight. The row outlives the import it describes, because the superseded
	-- torrent is only removed afterwards and a removal the Download Client refused has to be
	-- retried rather than forgotten.
	create table upgrade (
		part_slug text primary key,
		replaced_infohash text not null,
		replaced_release_title text not null,
		replaced_library_path text not null,
		replacement_infohash text not null,
		imported_at text
	);
	alter table history add column replaced_release_title text;
	`,
	`
	-- The watch page and the release feed are one concept polled twice, so they are one table with
	-- a row each rather than two tables that have to be kept in step. The freshness column is
	-- whichever answer the document gives about its own age: the feed's lastBuildDate, or a
	-- hash of the watch page body, which states nothing of its own.
	create table upstream_source (
		name text primary key,
		freshness text,
		etag text,
		last_modified text,
		checked_at text,
		updated_at text,
		outcome text,
		failure text
	);
	insert into upstream_source
		select 'catalogue', body_sha256, etag, last_modified, checked_at, updated_at, outcome, failure
		from catalogue_source;
	insert into upstream_source
		select 'feed', last_build_date, etag, last_modified, checked_at, updated_at, outcome, failure
		from feed_source;
	drop table catalogue_source;
	drop table feed_source;
	`,
	`
	-- Null means "whatever the deployment mounts by default", so that default lives in one place.
	create table directory (
		id integer primary key check (id = 1),
		library text,
		downloads text
	);
	insert into directory (id) values (1);
	`,
	`
	-- Where a Part's file actually is when that is not the configured Library, which a move
	-- partway through makes true of some Parts and not others. Null means the configured Library.
	alter table had_part add column library_root text;
	-- A move outlives the request that started it and the process that was running it, so one
	-- stopped partway still knows where it was going and why it stopped. Where the files still
	-- are is read back from had_part rather than recorded here, because a move stopped partway and
	-- then pointed somewhere else again leaves them under more than one root.
	create table library_move (
		id integer primary key autoincrement,
		destination text not null,
		parts integer not null,
		same_filesystem integer not null,
		state text not null,
		reason text,
		planned_at text not null,
		finished_at text
	);
	`,
	`
	-- One row rather than a row per kind, because the four kinds are fixed by what a media server
	-- reads and a user switching one off is editing a single standing instruction.
	create table sidecar (
		id integer primary key check (id = 1),
		show_nfo integer not null default 1,
		arc_nfo integer not null default 1,
		part_nfo integer not null default 1,
		arc_poster integer not null default 1
	);
	insert into sidecar (id) values (1);
	`
];

export function openDatabase(file: string): Database.Database {
	const db = new Database(file);
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');
	migrate(db);
	return db;
}

function migrate(db: Database.Database): void {
	const applied = db.pragma('user_version', { simple: true }) as number;
	for (const [index, migration] of migrations.entries()) {
		if (index < applied) continue;
		db.transaction(() => {
			db.exec(migration);
			db.pragma(`user_version = ${index + 1}`);
		})();
	}
}
