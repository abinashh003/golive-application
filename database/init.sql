-- Livestream platform schema

CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    avatar_color  VARCHAR(7) DEFAULT '#9333ea',
    created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS streams (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
    stream_key   VARCHAR(64) UNIQUE NOT NULL,
    title        VARCHAR(255) DEFAULT 'Untitled Stream',
    category     VARCHAR(100) DEFAULT 'Just Chatting',
    is_live      BOOLEAN DEFAULT false,
    mode         VARCHAR(20) DEFAULT 'webrtc',
    started_at   TIMESTAMP,
    ended_at     TIMESTAMP,
    created_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
    id          SERIAL PRIMARY KEY,
    stream_id   INTEGER REFERENCES streams(id) ON DELETE CASCADE,
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    message     TEXT NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS follows (
    id             SERIAL PRIMARY KEY,
    follower_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
    broadcaster_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at     TIMESTAMP DEFAULT NOW(),
    UNIQUE (follower_id, broadcaster_id)
);

CREATE TABLE IF NOT EXISTS reactions (
    id          SERIAL PRIMARY KEY,
    stream_id   INTEGER REFERENCES streams(id) ON DELETE CASCADE,
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    emoji       VARCHAR(16) NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS polls (
    id          SERIAL PRIMARY KEY,
    stream_id   INTEGER REFERENCES streams(id) ON DELETE CASCADE,
    question    VARCHAR(255) NOT NULL,
    options     JSONB NOT NULL,
    is_active   BOOLEAN DEFAULT true,
    created_at  TIMESTAMP DEFAULT NOW(),
    closed_at   TIMESTAMP
);

CREATE TABLE IF NOT EXISTS poll_votes (
    id          SERIAL PRIMARY KEY,
    poll_id     INTEGER REFERENCES polls(id) ON DELETE CASCADE,
    user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
    option_idx  INTEGER NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW(),
    UNIQUE (poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_stream ON messages(stream_id);
CREATE INDEX IF NOT EXISTS idx_reactions_stream ON reactions(stream_id);
CREATE INDEX IF NOT EXISTS idx_follows_broadcaster ON follows(broadcaster_id);
CREATE INDEX IF NOT EXISTS idx_polls_stream ON polls(stream_id);
