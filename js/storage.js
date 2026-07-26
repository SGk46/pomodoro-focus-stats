const KEY = "pomodoro-focus-stats:v1";

const DEFAULTS = {
  settings: {
    workMin: 25,
    shortMin: 5,
    longMin: 15,
    untilLong: 4,
    notify: true,
    chime: true,
    ambient: false,
  },
  sessions: [],
  completedFocusCount: 0,
};

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const data = JSON.parse(raw);
    return {
      settings: { ...DEFAULTS.settings, ...(data.settings || {}) },
      sessions: Array.isArray(data.sessions) ? data.sessions : [],
      completedFocusCount: data.completedFocusCount || 0,
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function saveState(state) {
  localStorage.setItem(
    KEY,
    JSON.stringify({
      settings: state.settings,
      sessions: state.sessions.slice(-500),
      completedFocusCount: state.completedFocusCount,
    })
  );
}

export function clearSessions(state) {
  state.sessions = [];
  state.completedFocusCount = 0;
  saveState(state);
}

/** Focus minutes for a local calendar day (YYYY-MM-DD) */
export function focusMinutesOnDay(sessions, dayKey) {
  return sessions
    .filter((s) => s.mode === "work" && s.completed && dayKeyFromTs(s.endedAt) === dayKey)
    .reduce((sum, s) => sum + Math.round(s.durationSec / 60), 0);
}

export function dayKeyFromTs(ts) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function lastNDays(n) {
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    d.setHours(12, 0, 0, 0);
    out.push(dayKeyFromTs(d.getTime()));
  }
  return out;
}

export function weekKeyFromTs(ts) {
  const d = new Date(ts);
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function lastNWeeks(n) {
  const keys = [];
  const labels = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i * 7);
    keys.push(weekKeyFromTs(d.getTime()));
    labels.push(weekKeyFromTs(d.getTime()).replace(/^\d+-W/, "W"));
  }
  return { keys, labels };
}

export function focusMinutesInWeek(sessions, weekKey) {
  return sessions
    .filter((s) => s.mode === "work" && s.completed && weekKeyFromTs(s.endedAt) === weekKey)
    .reduce((sum, s) => sum + Math.round(s.durationSec / 60), 0);
}

export function consecutiveFocusDays(sessions) {
  const days = new Set(
    sessions
      .filter((s) => s.mode === "work" && s.completed)
      .map((s) => dayKeyFromTs(s.endedAt))
  );
  let streak = 0;
  const d = new Date();
  // if today empty, still allow streak ending yesterday
  for (let i = 0; i < 365; i++) {
    const key = dayKeyFromTs(d.getTime());
    if (days.has(key)) {
      streak += 1;
      d.setDate(d.getDate() - 1);
    } else if (i === 0) {
      d.setDate(d.getDate() - 1);
      continue;
    } else break;
  }
  return streak;
}
