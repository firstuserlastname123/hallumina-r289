# Development workflow

Read [AGENTS.md](../AGENTS.md) first. Keep the upstream source checkouts clean and
place Hallumina-specific work in `hallumina/`, `scripts/` and `docs/`.

```sh
git switch main
git pull --ff-only
git switch -c feat/describe-the-change
git submodule update --init --recursive
node scripts/verify-upstreams.mjs
bash scripts/install.sh

(cd engine && node node_modules/typescript/bin/tsc --noEmit)
(cd engine && npm run lint)
(cd rs2b0t && bun run typecheck)
(cd rs2b0t && bun run lint)
(cd rs2b0t && bun test)
(cd rs2b0t && bun run build && TARGET=local bun run build:bot)
# With a new external runtime configured as in installation.md:
node scripts/runtime.mjs prepare
node scripts/runtime.mjs build
node scripts/runtime.mjs smoke
git diff --check
git submodule foreach --recursive 'git status --short'
```

Engine `npm run build` compiles the game's content/cache with the RuneScript
compiler; it is not a TypeScript emit build. Its supported runtime executes TS
with tsx. Engine has no packaged unit-test command at this pin. Content's
`scripts/_test` consists of in-game fixtures; packing those files does not mean
their gameplay assertions ran. rs2b0t `bun test` is its unit suite; the live E2E
commands use separate deployment/account fixtures and must not be run against a
public or production server.

`runtime.mjs prepare` uses committed upstream snapshots, so uncommitted upstream
edits are rejected. Runtime configuration may be edited externally. After a pin
change, prepare a new runtime; the provenance marker rejects mixed versions.
Do not reinstall dependencies while any linked runtime is running.

Keep a PR focused, report actual commands and failures, and leave merging to a
human. Do not force all components forward to make a failing combination pass.
The initial baseline and deferred checks are recorded in [validation](validation.md).
