# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (Vite)
npm run build     # Production build → dist/
npm run preview   # Preview production build locally
npm run lint      # ESLint (zero warnings enforced)
```

## Architecture

This is a single-page React app with no routing. The entire application lives in one component file:

- [App.jsx](App.jsx) — contains `DuffyGame` (all game logic and UI) and a thin `App` wrapper that renders it
- [main.jsx](main.jsx) — React root mount
- [index.css](index.css) — global styles (Tailwind base/components/utilities)
- Tailwind is configured to scan `index.html` and all `*.{js,ts,jsx,tsx}` in root only

**Game logic summary:**

Duffy is a 16-round trick-taking card game for 4 players. Rounds 1–13 deal 13 down to 1 card; rounds 14–16 each deal 1 card with fixed trump suits (Heart, Diamond, Club). Trump suit for rounds 1–13 cycles through Spades/Hearts/Diamonds/Clubs by `(round - 1) % 4`.

Scoring per round: if `bid === win`, player earns `5 + win`; otherwise they earn just `win`.

Bid validation: the last bidder cannot bid a value that would make the total equal to `cardsThisRound` (forbidden bid). Win validation: total wins must equal `cardsThisRound`.

Player order rotates each round — the previous round's second bidder becomes the next first bidder, maintaining the same direction.

**Keyboard shortcuts** (when no input is focused):
- `Q/W/E/R` — focus/cycle bid for players 1–4
- `A/S/D/F` — focus/cycle wins for players 1–4
- `0-9` — set numeric value on focused bid/win input
- `N` — submit round (Next Round)
- `U` — undo last round

**Google Sheets integration:** After a game, results can be POSTed to a Google Apps Script web app URL via `no-cors` fetch. The GAS URL is persisted to `localStorage` under key `duffy_gas_url`. The GAS script appends game summary and round-by-round data to the active sheet.
