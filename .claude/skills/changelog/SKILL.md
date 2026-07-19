---
name: changelog
description: Maintain CHANGELOG.md for this project. Use after completing any user-visible feature, fix, or change, or when the user asks "what's new" / to update the changelog / to cut a release.
---

# Changelog

Maintain [CHANGELOG.md](../../../CHANGELOG.md) at the repository root using the
[Keep a Changelog](https://keepachangelog.com) format. The app renders this file in
**Settings → What's new** (imported with `?raw` in `SettingsView.tsx`), so it is
user-facing — write for travellers using the app, not for developers.

## Rules

1. Every user-visible change lands under the `## [Unreleased]` section at the top,
   in one of: `### Added`, `### Changed`, `### Fixed`, `### Removed`.
2. One bullet per change, plain language, no code identifiers, no file paths.
   Good: "Search countries by name in the list view."
   Bad: "Refactored ListView.tsx filtering logic."
3. Internal-only changes (refactors, CI, deps) do NOT go in the changelog.
4. When cutting a release: rename `[Unreleased]` to `[x.y.z] - YYYY-MM-DD`,
   bump `version` in `package.json` to match, and add a fresh empty
   `[Unreleased]` section above it.
5. Never rewrite or delete entries from released versions.
6. The in-app renderer only understands `##` / `###` headings and `- ` bullets —
   don't use tables, links, or nested lists in this file.

## Template for a new release

```markdown
## [Unreleased]

## [0.2.0] - 2026-08-01

### Added

- New thing the user can do.
```
