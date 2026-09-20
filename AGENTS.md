# BabyBook+ Codex Adapter

This file adapts the project for Codex. `CLAUDE.md` is the authoritative source
of project knowledge, architecture, status, conventions, and gotchas. Read the
relevant sections there before making changes, and update `CLAUDE.md` when the
project itself changes. Keep this adapter concise instead of duplicating that
guide.

## Project map

- `front-end/`: Expo/React Native application with custom state-based
  navigation (not Expo Router or React Navigation).
- `front-end/App.js`: root auth gate, providers, header, navigation, and global
  modals.
- `front-end/components/`: feature screens and shared UI.
- `front-end/context/`, `front-end/utils/`, `front-end/theme.js`: theme,
  language, API/adapters, notifications, storage, and shared tokens.
- `back-end/`: Express/PostgreSQL API.
- `back-end/src/routes/`, `middleware/`, `utils/`, `db/`: endpoints, auth and
  validation, shared backend logic, schema, and additive migrations.
- `back-end/tests/api.test.js`: destructive-schema integration suite; use only
  with a throwaway/local test database.
- `Documents/`: research, compliance material, archives, and implementation
  plans.
- `graphify-out/`: generated code knowledge graph; use the Graphify skill for
  codebase questions when `graphify-out/graph.json` exists.

## Common commands

- Front end: from `front-end/`, run `npm run web` or `npm run build`.
- Back end: from `back-end/`, run `npm run dev`, `npm start`, or `npm test`.
- Database changes: use `npm run db:migrate:up` for additive migrations.
  Never run `npm run db:migrate` against real or shared data because it drops
  and recreates the schema.

## Working rules

- Preserve the custom navigation model; discuss any navigation-paradigm change
  first.
- Use theme tokens and the established `useTheme`/`makeStyles` pattern. Do not
  add hard-coded brand colors to components.
- Preserve QR sharing, encryption, consent, attachment, and record behavior
  during refactors.
- Ask before adding dependencies.
- Never commit `.env` files, credentials, tokens, database URLs, encryption
  keys, or local tool overrides.
- Keep `DATA_ENCRYPTION_KEY` stable across environments; changing it makes
  existing ciphertext unreadable.
- Before running backend integration tests, explicitly point `DATABASE_URL` at
  a disposable database. The suite executes the destructive schema.
- After code changes, run focused verification proportional to risk. Follow
  the Graphify guidance in `CLAUDE.md` for keeping the knowledge graph current.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
