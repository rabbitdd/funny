export const schema = `
CREATE TABLE IF NOT EXISTS polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL CHECK (length(question) BETWEEN 3 AND 180),
  paused boolean NOT NULL DEFAULT false,
  revision integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS visitors (
  poll_id uuid NOT NULL REFERENCES polls(id),
  visitor_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, visitor_id)
);
CREATE TABLE IF NOT EXISTS votes (
  poll_id uuid NOT NULL REFERENCES polls(id),
  visitor_id text NOT NULL,
  answer text NOT NULL CHECK (answer IN ('yes', 'no')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, visitor_id)
);
CREATE INDEX IF NOT EXISTS votes_created_idx ON votes(poll_id, created_at);
CREATE TABLE IF NOT EXISTS rate_limits (
  key text PRIMARY KEY,
  attempts integer NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_limits_expiry_idx ON rate_limits(expires_at);
INSERT INTO polls (question) SELECT 'Should we say yes more often?' WHERE NOT EXISTS (SELECT 1 FROM polls);
`;
