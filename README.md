# Pomodoro Timer + Focus Stats

A beautiful **Pomodoro timer** with session history, daily/weekly focus analytics, keyboard shortcuts, notifications, and optional free ambient sound (Web Audio — no paid assets).

## Features

- Customizable **focus / short break / long break** lengths  
- Session **history** in `localStorage`  
- **Daily** (7 days) and **weekly** (8 weeks) focus charts  
- **Keyboard shortcuts**: Space, R, S, 1/2/3, N  
- **Desktop notifications** when a phase ends  
- Optional **ambient tone** + end chime (Web Audio API)  
- Export history as JSON  

## Tech (free)

Vanilla HTML / CSS / JS · `localStorage` · Canvas charts · Web Audio · Notifications API  

No build step, no paid APIs, no accounts.

## Run locally

```powershell
cd C:\Users\Gowtham\Source\Repos\pomodoro-focus-stats
python -m http.server 8080
```

Open http://localhost:8080  

Or open `index.html` via any static server (ES modules need HTTP, not raw `file://` in some browsers).

## Stack level

Beginner → Intermediate: timers, state machine, local storage, subtle animations.

## License

MIT
