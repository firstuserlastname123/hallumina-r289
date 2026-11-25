# Hallumina-owned code and configuration

`config/world.example.json` is a secret-free partial configuration merged with the
pinned engine's defaults. `scripts/runtime.mjs prepare` copies it into a fresh
external runtime. `.env.example` documents the launch wrapper's single environment
variable. Engine settings come from `data/config/world.json`, not process env vars.

Future scoped extensions belong here, keeping upstream repositories updateable.
No extension framework, custom mechanics or autonomous playerbots are implemented.
