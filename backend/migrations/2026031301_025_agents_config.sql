-- Agent configuration: DB-driven agent definitions with defaults
-- Replaces hardcoded init_witcher_agents() — agents now CRUD-managed

CREATE TABLE IF NOT EXISTS ch_agents_config (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    role        TEXT NOT NULL,
    tier        TEXT NOT NULL CHECK (tier IN ('Commander', 'Coordinator', 'Executor')),
    status      TEXT NOT NULL DEFAULT 'active',
    description TEXT NOT NULL DEFAULT '',
    model       TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default Witcher agents (matching previous hardcoded values)
INSERT INTO ch_agents_config (id, name, role, tier, status, description, model)
VALUES
  ('agent-001', 'Geralt',   'Security',      'Commander',   'active', 'Master witcher and security specialist — hunts vulnerabilities like monsters',               'claude-opus-4-6'),
  ('agent-002', 'Yennefer', 'Architecture',  'Commander',   'active', 'Powerful sorceress of system architecture — designs elegant magical structures',              'claude-opus-4-6'),
  ('agent-003', 'Vesemir',  'Testing',       'Commander',   'active', 'Veteran witcher mentor — rigorously tests and validates all operations',                      'claude-opus-4-6'),
  ('agent-004', 'Triss',    'Data',          'Coordinator', 'active', 'Skilled sorceress of data management — weaves information with precision',                    'claude-sonnet-4-6'),
  ('agent-005', 'Jaskier',  'Documentation', 'Coordinator', 'active', 'Legendary bard — chronicles every detail with flair and accuracy',                            'claude-sonnet-4-6'),
  ('agent-006', 'Ciri',     'Performance',   'Coordinator', 'active', 'Elder Blood carrier — optimises performance with dimensional speed',                          'claude-sonnet-4-6'),
  ('agent-007', 'Dijkstra', 'Strategy',      'Coordinator', 'active', 'Spymaster strategist — plans operations with cunning intelligence',                           'claude-sonnet-4-6'),
  ('agent-008', 'Lambert',  'DevOps',        'Executor',    'active', 'Bold witcher — executes deployments and infrastructure operations',                           'claude-haiku-4-5-20251001'),
  ('agent-009', 'Eskel',    'Backend',       'Executor',    'active', 'Steady witcher — builds and maintains robust backend services',                               'claude-haiku-4-5-20251001'),
  ('agent-010', 'Regis',    'Research',      'Executor',    'active', 'Scholarly higher vampire — researches and analyses with ancient wisdom',                       'claude-haiku-4-5-20251001'),
  ('agent-011', 'Zoltan',   'Frontend',      'Executor',    'active', 'Dwarven warrior — forges powerful and resilient frontend interfaces',                          'claude-haiku-4-5-20251001'),
  ('agent-012', 'Philippa', 'Monitoring',    'Executor',    'active', 'All-seeing sorceress — monitors systems with her magical owl familiar',                        'claude-haiku-4-5-20251001')
ON CONFLICT (id) DO NOTHING;
