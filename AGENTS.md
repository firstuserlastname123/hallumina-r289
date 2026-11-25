# Hallumina r289 working rules

## Architecture and scope

- The parent repository owns orchestration, documentation and Hallumina-specific
  configuration. `engine/`, `content/` and `rs2b0t/` are pinned Git submodules.
- Engine and Content must stay siblings. The engine resolves `../content`.
- Engine-TS and Content must use revision **289** branches. rs2b0t uses `main` at
  its recorded pin. Do not follow upstream examples that select default r274.
- Preserve upstream updateability and all license notices. Put custom work under
  `hallumina/`, `scripts/` or `docs/` whenever practical. Do not vendor source
  trees or edit submodules incidentally. Proposed upstream patches need a separate
  scoped branch, documentation and explicit review; never push to upstream repos.
- No custom game mechanics, replacement rs2b0t API/UI/library, or server-managed
  playerbots until the base server is stable and that work is requested.

## Persistence and secrets

- Never track credentials, private RSA keys, account databases, character saves,
  session data or backups. Treat existing persistence as protected user data.
- Use fresh external disposable runtime directories for smoke checks. Never reset
  a database or overwrite keys/saves to make a check pass.
- Upstream Engine includes a published development key pair. Preserve the pinned
  submodule, but never use that pair for a Hallumina runtime or copy it into parent
  tracked files. `runtime.mjs prepare` creates a fresh pair outside the repository.
- Configuration templates contain no production secrets. Keep management and debug
  endpoints private; the upstream listeners bind `0.0.0.0`.

## Build and verification

- Inspect pinned manifests, lockfiles and lifecycle scripts before installing.
  Use `bash scripts/install.sh` (npm ci / Bun frozen install). Content currently
  has no package manifest. Do not invent a Content dependency install.
- Run pin verification, Engine build and typecheck, rs2b0t typecheck and suitable
  upstream tests. Run the isolated startup smoke when runtime behavior changes.
  See `docs/validation.md` for exact commands and known baseline failures.
- Do not modify, disable or narrow upstream tests just to report success. Record
  failures and environmental blockers with their command and actual result.
- Distinguish toolchain checks, upstream application tests, startup/protocol smoke,
  browser client loading, login/gameplay and deferred acceptance checks.
- Never claim game actions or saves work because a build or typecheck passes.

## Git workflow

- Preserve existing edits. Work on a feature branch from `main`; open a focused PR
  against `main`. Do not merge automatically or enable automatic merging.
- Initialize with `git submodule update --init --recursive`, never `--remote`.
- Keep gitlinks, `.gitmodules`, `hallumina/compatibility.json` and validation
  evidence consistent. Evaluate upstream updates separately using
  `docs/upstream-updates.md`; never blindly advance all three components.
