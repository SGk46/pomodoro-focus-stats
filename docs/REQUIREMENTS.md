# Requirements brief (from skill prompt)

## App name & purpose

**Pomodoro Timer + Focus Stats** — A beautiful Pomodoro timer with session history, daily focus minutes, and simple analytics. Optional ambient sounds (free / generated audio).

## Users / roles

Single personal user (browser local only). No accounts.

## Features (must-have)

- Customizable work / short break / long break lengths
- Pomodoro state machine: idle → work → break → … with long break after N sessions
- Session history stored in `localStorage`
- Daily / weekly focus minutes chart
- Keyboard shortcuts
- Browser notifications on phase complete
- Optional ambient sound (Web Audio API, free)

## Nice-to-have

- Subtle animations / progress ring
- Export history JSON
- Dark focus-friendly UI

## Screens / flows

1. **Timer** — main ring, start/pause/reset, mode badges
2. **Settings** — durations, sessions until long break, sound toggles
3. **History** — list of past sessions
4. **Stats** — daily bars + weekly summary

## Data model

- `settings`: workMin, shortBreakMin, longBreakMin, sessionsUntilLong, notify, ambient, soundTick
- `sessions[]`: `{ id, mode, startedAt, endedAt, durationSec, completed }`
- `stats cache` derived from sessions

## Integrations / APIs

None paid. Web Notifications API, Web Audio API, localStorage only.

## Design notes

Calm dark UI, soft gradients, large readable timer, mobile + desktop.

## Source

User skill args: Pomodoro Timer + Focus Stats (text brief).
