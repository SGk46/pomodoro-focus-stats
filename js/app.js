import {
  loadState,
  saveState,
  clearSessions,
  focusMinutesOnDay,
  dayKeyFromTs,
  lastNDays,
  lastNWeeks,
  focusMinutesInWeek,
  consecutiveFocusDays,
} from "./storage.js";
import { playChime, startAmbient, stopAmbient, ensureAudio } from "./audio.js";
import { renderDailyChart, renderWeeklyChart } from "./charts.js";

const CIRC = 2 * Math.PI * 88;

const state = loadState();
const ui = {
  time: document.getElementById("time-display"),
  phase: document.getElementById("phase-label"),
  meta: document.getElementById("session-meta"),
  ring: document.getElementById("ring"),
  toggle: document.getElementById("btn-toggle"),
  reset: document.getElementById("btn-reset"),
  skip: document.getElementById("btn-skip"),
  todayFocus: document.getElementById("today-focus"),
  todayCount: document.getElementById("today-count"),
  streak: document.getElementById("streak"),
  historyList: document.getElementById("history-list"),
  historyEmpty: document.getElementById("history-empty"),
  weekMin: document.getElementById("week-minutes"),
  weekSessions: document.getElementById("week-sessions"),
  avgDay: document.getElementById("avg-day"),
  bestDay: document.getElementById("best-day"),
  dailyChart: document.getElementById("daily-chart"),
  weeklyChart: document.getElementById("weekly-chart"),
};

/** @type {'work'|'short'|'long'} */
let mode = "work";
let remainingSec = state.settings.workMin * 60;
let totalSec = remainingSec;
let running = false;
let timerId = null;
let phaseStartedAt = null;
let focusInCycle = state.completedFocusCount % state.settings.untilLong;

const labels = {
  work: "Focus session",
  short: "Short break",
  long: "Long break",
};

function durationFor(m) {
  const s = state.settings;
  if (m === "work") return s.workMin * 60;
  if (m === "short") return s.shortMin * 60;
  return s.longMin * 60;
}

function formatTime(sec) {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function setMode(next, { resetTimer = true } = {}) {
  mode = next;
  document.body.dataset.mode = next;
  document.querySelectorAll("[data-set-mode]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.setMode === next);
  });
  if (resetTimer) {
    stopClock();
    running = false;
    totalSec = durationFor(mode);
    remainingSec = totalSec;
    phaseStartedAt = null;
    ui.toggle.textContent = "Start";
    syncAmbient();
  }
  renderTimer();
}

function renderTimer() {
  ui.time.textContent = formatTime(remainingSec);
  ui.phase.textContent = labels[mode];
  const progress = totalSec > 0 ? 1 - remainingSec / totalSec : 0;
  ui.ring.style.strokeDasharray = String(CIRC);
  ui.ring.style.strokeDashoffset = String(CIRC * (1 - progress));
  const pomodoroNum = focusInCycle + (mode === "work" ? 1 : 0);
  ui.meta.textContent = running
    ? `Pomodoro ${Math.max(1, pomodoroNum)} · running`
    : remainingSec === totalSec
      ? `Pomodoro ${Math.max(1, pomodoroNum)} · ready`
      : `Pomodoro ${Math.max(1, pomodoroNum)} · paused`;
  document.title = `${formatTime(remainingSec)} · ${labels[mode]}`;
}

function stopClock() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

function tick() {
  remainingSec -= 1;
  if (remainingSec <= 0) {
    remainingSec = 0;
    renderTimer();
    void completePhase(true);
    return;
  }
  renderTimer();
}

async function completePhase(natural) {
  stopClock();
  running = false;
  ui.toggle.textContent = "Start";

  const ended = Date.now();
  const started = phaseStartedAt || ended - (totalSec - remainingSec) * 1000;
  const durationSec = Math.max(1, Math.round((ended - started) / 1000));

  if (natural || durationSec >= 5) {
    state.sessions.unshift({
      id: `${ended}-${Math.random().toString(36).slice(2, 7)}`,
      mode,
      startedAt: started,
      endedAt: ended,
      durationSec: Math.min(durationSec, totalSec),
      completed: natural,
    });
    if (natural && mode === "work") {
      state.completedFocusCount += 1;
      focusInCycle = state.completedFocusCount % state.settings.untilLong;
    }
    saveState(state);
  }

  if (natural) {
    if (state.settings.chime) await playChime();
    notifyPhaseEnd();
  }

  // auto-advance mode
  if (natural) {
    if (mode === "work") {
      const next =
        state.completedFocusCount % state.settings.untilLong === 0
          ? "long"
          : "short";
      setMode(next, { resetTimer: true });
    } else {
      setMode("work", { resetTimer: true });
    }
  } else {
    totalSec = durationFor(mode);
    remainingSec = totalSec;
    phaseStartedAt = null;
    renderTimer();
  }

  syncAmbient();
  refreshStats();
  renderHistory();
}

function notifyPhaseEnd() {
  if (!state.settings.notify || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const title =
    mode === "work" ? "Focus complete 🍅" : "Break over — back to focus";
  const body =
    mode === "work"
      ? "Nice work. Time for a break."
      : "Ready for another focus session?";
  try {
    new Notification(title, { body, silent: true });
  } catch {
    /* ignore */
  }
}

async function toggle() {
  await ensureAudio();
  if (running) {
    stopClock();
    running = false;
    ui.toggle.textContent = "Start";
    ui.meta.textContent = ui.meta.textContent.replace("running", "paused");
    syncAmbient();
    return;
  }
  if (remainingSec <= 0) {
    totalSec = durationFor(mode);
    remainingSec = totalSec;
  }
  if (!phaseStartedAt) phaseStartedAt = Date.now();
  running = true;
  ui.toggle.textContent = "Pause";
  timerId = setInterval(tick, 1000);
  syncAmbient();
  renderTimer();
}

function reset() {
  stopClock();
  running = false;
  phaseStartedAt = null;
  totalSec = durationFor(mode);
  remainingSec = totalSec;
  ui.toggle.textContent = "Start";
  syncAmbient();
  renderTimer();
}

async function skip() {
  stopClock();
  running = false;
  ui.toggle.textContent = "Start";

  // log partial session if meaningful time elapsed
  if (phaseStartedAt) {
    const ended = Date.now();
    const durationSec = Math.round((ended - phaseStartedAt) / 1000);
    if (durationSec >= 5) {
      state.sessions.unshift({
        id: `${ended}-skip`,
        mode,
        startedAt: phaseStartedAt,
        endedAt: ended,
        durationSec: Math.min(durationSec, totalSec),
        completed: false,
      });
      saveState(state);
    }
  }

  phaseStartedAt = null;
  if (mode === "work") {
    // preview next break without counting a completed focus
    const nextIndex = (state.completedFocusCount + 1) % state.settings.untilLong;
    setMode(nextIndex === 0 ? "long" : "short", { resetTimer: true });
  } else {
    setMode("work", { resetTimer: true });
  }
  syncAmbient();
  refreshStats();
  renderHistory();
}

function syncAmbient() {
  if (state.settings.ambient && running && mode === "work") {
    void startAmbient();
  } else {
    stopAmbient();
  }
}

function refreshTodayBar() {
  const today = dayKeyFromTs(Date.now());
  const mins = focusMinutesOnDay(state.sessions, today);
  const count = state.sessions.filter(
    (s) => s.mode === "work" && s.completed && dayKeyFromTs(s.endedAt) === today
  ).length;
  ui.todayFocus.textContent = `${mins} min`;
  ui.todayCount.textContent = String(count);
  ui.streak.textContent = String(consecutiveFocusDays(state.sessions));
}

function refreshStats() {
  refreshTodayBar();
  const days = lastNDays(7);
  const dayMins = days.map((d) => focusMinutesOnDay(state.sessions, d));
  renderDailyChart(ui.dailyChart, days, dayMins);

  const { keys, labels: wlabels } = lastNWeeks(8);
  const weekMins = keys.map((k) => focusMinutesInWeek(state.sessions, k));
  renderWeeklyChart(ui.weeklyChart, wlabels, weekMins);

  const weekTotal = weekMins[weekMins.length - 1] || 0;
  // sum last 7 days
  const last7 = dayMins.reduce((a, b) => a + b, 0);
  ui.weekMin.textContent = String(last7);
  const weekSessions = state.sessions.filter((s) => {
    if (!s.completed || s.mode !== "work") return false;
    const day = dayKeyFromTs(s.endedAt);
    return days.includes(day);
  }).length;
  ui.weekSessions.textContent = `${weekSessions} completed sessions`;
  ui.avgDay.textContent = String(Math.round(last7 / 7));
  let best = 0;
  let bestKey = "—";
  days.forEach((d, i) => {
    if (dayMins[i] > best) {
      best = dayMins[i];
      bestKey = d;
    }
  });
  ui.bestDay.textContent =
    best > 0 ? `Best day: ${bestKey} (${best} min)` : "Best day: —";
}

function renderHistory() {
  const list = state.sessions.slice(0, 80);
  ui.historyList.innerHTML = "";
  ui.historyEmpty.hidden = list.length > 0;
  list.forEach((s) => {
    const li = document.createElement("li");
    const when = new Date(s.endedAt).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const mins = Math.round(s.durationSec / 60);
    const modeLabel =
      s.mode === "work" ? "Focus" : s.mode === "short" ? "Short break" : "Long break";
    li.innerHTML = `
      <span class="badge-mode ${s.mode}">${modeLabel}</span>
      <div class="hist-main">
        <strong>${s.completed ? "Completed" : "Stopped early"}</strong>
        <span>${when}</span>
      </div>
      <span class="hist-dur">${mins}m</span>`;
    ui.historyList.appendChild(li);
  });
}

function loadSettingsForm() {
  document.getElementById("set-work").value = state.settings.workMin;
  document.getElementById("set-short").value = state.settings.shortMin;
  document.getElementById("set-long").value = state.settings.longMin;
  document.getElementById("set-until-long").value = state.settings.untilLong;
  document.getElementById("set-notify").checked = state.settings.notify;
  document.getElementById("set-chime").checked = state.settings.chime;
  document.getElementById("set-ambient").checked = state.settings.ambient;
}

function bindSettings() {
  const map = [
    ["set-work", "workMin"],
    ["set-short", "shortMin"],
    ["set-long", "longMin"],
    ["set-until-long", "untilLong"],
  ];
  map.forEach(([id, key]) => {
    document.getElementById(id).addEventListener("change", (e) => {
      const v = Math.max(1, Math.min(120, Number(e.target.value) || 1));
      state.settings[key] = v;
      e.target.value = v;
      saveState(state);
      if (!running) {
        totalSec = durationFor(mode);
        remainingSec = totalSec;
        renderTimer();
      }
    });
  });

  document.getElementById("set-notify").addEventListener("change", (e) => {
    state.settings.notify = e.target.checked;
    saveState(state);
  });
  document.getElementById("set-chime").addEventListener("change", (e) => {
    state.settings.chime = e.target.checked;
    saveState(state);
  });
  document.getElementById("set-ambient").addEventListener("change", (e) => {
    state.settings.ambient = e.target.checked;
    saveState(state);
    syncAmbient();
  });

  document.getElementById("btn-notify-perm").addEventListener("click", async () => {
    if (!("Notification" in window)) {
      alert("Notifications are not supported in this browser.");
      return;
    }
    const p = await Notification.requestPermission();
    alert(p === "granted" ? "Notifications enabled." : `Permission: ${p}`);
  });
}

function switchView(name) {
  document.querySelectorAll(".tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.view === name);
  });
  document.querySelectorAll(".view").forEach((v) => {
    const on = v.id === `view-${name}`;
    v.classList.toggle("active", on);
    v.hidden = !on;
  });
  if (name === "stats") refreshStats();
  if (name === "history") renderHistory();
}

function wireUi() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });
  document.querySelectorAll("[data-set-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (running) return;
      setMode(btn.dataset.setMode);
    });
  });
  ui.toggle.addEventListener("click", () => void toggle());
  ui.reset.addEventListener("click", reset);
  ui.skip.addEventListener("click", () => void skip());

  document.getElementById("btn-export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state.sessions, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pomodoro-history-${dayKeyFromTs(Date.now())}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  document.getElementById("btn-clear-history").addEventListener("click", () => {
    if (confirm("Clear all session history on this device?")) {
      clearSessions(state);
      focusInCycle = 0;
      refreshStats();
      renderHistory();
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea")) return;
    if (e.code === "Space") {
      e.preventDefault();
      void toggle();
    } else if (e.key === "r" || e.key === "R") reset();
    else if (e.key === "s" || e.key === "S") void skip();
    else if (e.key === "1") {
      if (!running) setMode("work");
    } else if (e.key === "2") {
      if (!running) setMode("short");
    } else if (e.key === "3") {
      if (!running) setMode("long");
    } else if (e.key === "n" || e.key === "N") {
      if ("Notification" in window) void Notification.requestPermission();
    }
  });

  window.addEventListener("resize", () => {
    if (document.getElementById("view-stats").classList.contains("active")) {
      refreshStats();
    }
  });

  bindSettings();
  loadSettingsForm();
  setMode("work");
  refreshStats();
  renderHistory();
}

wireUi();
