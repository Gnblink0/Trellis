# Project: Trellis

## Design Token Policy

**NEVER set specific pixel or color values directly in component code.**
**ALWAYS use existing design tokens** (defined in the theme/token files).
If a token doesn't exist for the value you need, **ask the user first or propose a new token** before proceeding.
**DO NOT create one-off values.** Every spacing, color, font size, radius, and shadow must trace back to a named token.

Reference: `document/AdaptEd_Design_Style_Guide.md`

## Architecture

- Monorepo: npm workspaces (`app/` + `server/`)
- Frontend: React Native + TypeScript (Expo), targeting iPad 768×1024
- Backend: Node.js + Express.js (stateless BFF) — not in active development yet
- Font families: Fredoka (headings), Nunito (body)
