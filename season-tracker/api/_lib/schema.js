/**
 * The database, as tables.
 *
 * Five of them, and the shape follows how the site reads: an event row is what
 * the directory lists, a scoreboard row is one round, and the summary columns
 * beside its payload are there so a list view never has to load a killfeed.
 * Everything else an event owns — pins, renames, the tracker's own state — is
 * a single JSON document keyed by the event, because that is exactly how the
 * screens hold them and nothing queries inside them.
 *
 * The DDL is idempotent and runs once per cold start, so a fresh Neon database
 * needs no migration step: point WOR_DATABASE_URL at it and the first request
 * builds what it needs.
 */
export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS wor_events (
     slug             TEXT PRIMARY KEY,
     name             TEXT NOT NULL,
     published        BOOLEAN NOT NULL DEFAULT FALSE,
     seasons          JSONB NOT NULL DEFAULT '[]'::jsonb,
     registry_units   JSONB NOT NULL DEFAULT '[]'::jsonb,
     map_stats        JSONB,
     created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,

  // The directory only ever lists published events, and orders them by when
  // they were last touched.
  `CREATE INDEX IF NOT EXISTS wor_events_published_idx
     ON wor_events (published, updated_at DESC)`,

  `CREATE TABLE IF NOT EXISTS wor_scoreboards (
     event_slug       TEXT NOT NULL REFERENCES wor_events(slug) ON DELETE CASCADE,
     id               TEXT NOT NULL,
     source_filename  TEXT NOT NULL,
     recorded_at      TEXT,
     map              TEXT,
     mode             TEXT,
     area             TEXT,
     winner           TEXT,
     week_id          TEXT,
     round            SMALLINT,
     payload          JSONB NOT NULL,
     PRIMARY KEY (event_slug, id)
   )`,

  // A round list is "every scoreboard in this event, newest first", which is
  // the one query this table serves outside of fetching a round by id.
  `CREATE INDEX IF NOT EXISTS wor_scoreboards_event_idx
     ON wor_scoreboards (event_slug, recorded_at DESC)`,

  `CREATE TABLE IF NOT EXISTS wor_event_docs (
     event_slug       TEXT NOT NULL REFERENCES wor_events(slug) ON DELETE CASCADE,
     kind             TEXT NOT NULL,
     doc              JSONB NOT NULL,
     updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
     PRIMARY KEY (event_slug, kind)
   )`,

  // Share links: the pre-existing short-link store, moved off Redis so the
  // deployment needs one database rather than two. Chunks are content-addressed
  // and write-once; a manifest row (idx = -1) says how many there are.
  `CREATE TABLE IF NOT EXISTS wor_shares (
     id               TEXT NOT NULL,
     idx              INTEGER NOT NULL,
     chunk            TEXT NOT NULL,
     expires_at       TIMESTAMPTZ NOT NULL,
     PRIMARY KEY (id, idx)
   )`,

  `CREATE INDEX IF NOT EXISTS wor_shares_expiry_idx ON wor_shares (expires_at)`,
];

/** The three documents an event owns beside its rounds. */
export const DOC_KINDS = { assignments: 'assignments', aliases: 'aliases', tracker: 'tracker' };
