# Repository Guidelines

## Project Structure & Module Organization
- modules/: JavaScript/ESM sources (e.g., `documents/`, `sheets/`, `utils/`, entry `anyventure.mjs`).
- templates/: Handlebars UI (`actor/`, `item/`, `partials/`). Paths load via `systems/anyventure/...`.
- styles/: Compiled CSS and SCSS sources (`anyventure.scss`, maps).
- images/, artwork/: UI and icon assets (see `images/icons/license.txt`).
- lang/: Localization files (e.g., `en.json`).
- packs/: Compendia (if used).
- system.json, template.json: Foundry manifest and data schema.

## Build, Test, and Development Commands
- No mandatory build step. Edit and refresh the Foundry client.
- Optional SCSS compile: `sass styles/anyventure.scss styles/anyventure.css --style=expanded --source-map`.
- Local install for dev: place this folder at `%LOCALAPPDATA%/FoundryVTT/Data/systems/anyventure` (Windows) or symlink to that path.
- Zip for distribution: archive repository contents (excluding `.git/`) and install via Foundry’s “Install System” (From Zip).

## Coding Style & Naming Conventions
- JavaScript: 2-space indent, semicolons, ESM imports, prefer single quotes; classes in PascalCase; files in kebab-case (`attack-roll-dialog.mjs`).
- Templates: kebab-case filenames; use registered Handlebars helpers (see `anyventure.mjs`).
- SCSS/CSS: keep variables and partials in `styles/`; compile to `anyventure.css`.
- Paths: reference templates as `systems/anyventure/templates/...` and images under `systems/anyventure/images/...`.

## Testing Guidelines
- No automated test harness. Perform manual verification in Foundry:
  - Create a world using the Anyventure system; open actor/item sheets; exercise rolls and dialogs.
  - Validate localization keys in `lang/en.json` (fallbacks should not appear in UI).
  - Check CSS across light/dark themes and typical resolutions.

## Commit & Pull Request Guidelines
- Commits: small, descriptive, imperative subject lines (e.g., "Fix actor sheet armor calc").
- PRs: include summary, user-visible changes, repro steps, screenshots/GIFs of UI, and any schema or manifest updates (`system.json`, `template.json`). Link related issues.

## Security & Configuration Tips
- Keep `system.json` version in sync with changes and update template paths when moving files.
- Do not include unlicensed assets. Respect notes in `images/icons/license.txt`.
- Avoid breaking stored actor/item data; when changing schema, provide migration notes.
