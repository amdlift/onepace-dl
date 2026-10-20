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
