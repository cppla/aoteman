-- Keep successful mutation IDs even after old save history expires. A delayed
-- retry must never write an already-applied action for a second time.
CREATE TABLE mutations (
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    mutation_id TEXT NOT NULL,
    revision INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (profile_id, mutation_id)
);
