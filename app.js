(() => {
  "use strict";
  const KEY = "time-me-state-v1", C = 666.02;
  const defaults = { durations: { focus: 25, short: 5, long: 15 }, autoFullscreen: true, logs: [], tasks: [{ id: "read", name: "Read a few pages", done: false }, { id: "practice", name: "Practice something tricky", done: false }], selectedTaskId: "read" };
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (_) {}
  const s = { mode: "focus", durations: { ...defaults.durations, ...(saved.durations || {}) }, autoFullscreen: saved.autoFullscreen !== false, logs: Array.isArray(saved.logs) ? saved.logs : [], tasks: Array.isArray(saved.tasks) ? saved.tasks : defaults.tasks.map(x => ({ ...x })), selectedTaskId: saved.selectedTaskId || "read", running: false, remaining: (Number((saved.durations || {}).focus) || 25) * 60, freeElapsed: 0, endsAt: 0, freeStartedAt: 0, interval: 0, toastTimeout: 0, notice: "" };
  const $ = id => document.getElementById(id);
  const e = { date: $("todayDate"), percent: $("goalPercent"), goalBar: $("goalBar"), count: $("sessionCount"), heading: $("timerHeading"), display: $("timerDisplay"), label: $("timerLabel"), subtitle: $("timerSubtitle"), ring: $("ringProgress"), toggle: $("toggleTimer"), toggleLabel: $("toggleLabel"), hint: $("timerHint"), currentTask: $("currentTaskLabel"), taskForm: $("taskForm"), taskInput: $("taskInput"), taskList: $("taskList"), taskTotal: $("taskTotal"), focusToday: $("focusToday"), freeToday: $("freeToday"), weekTotal: $("weekTotal"), weekChart: $("weekChart"), dialog: $("settingsDialog"), form: $("settingsForm"), fullToggle: $("autoFullscreen"), toast: $("toast") };
  const pad = n => String(n).padStart(2, "0");
  const fmtTime = sec => pad(Math.floor(Math.max(0, sec) / 60)) + ":" + pad(Math.floor(Math.max(0, sec) % 60));
  const dayKey = date => date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  const mins = sec => { const n = Math.floor(Math.max(0, sec) / 60), h = Math.floor(n / 60), r = n % 60; return h ? h + "h " + r + "m" : n + "m"; };
  const modeLength = () => (s.durations[s.mode] || 0) * 60;
  const activeTask = () => s.tasks.find(t => t.id === s.selectedTaskId && !t.done);
  function persist() { try { localStorage.setItem(KEY, JSON.stringify({ durations: s.durations, autoFullscreen: s.autoFullscreen, logs: s.logs.slice(-500), tasks: s.tasks, selectedTaskId: s.selectedTaskId })); } catch (_) { toast("Couldn’t save on this device."); } }
  function toast(message) { e.toast.textContent = message; e.toast.classList.add("visible"); clearTimeout(s.toastTimeout); s.toastTimeout = setTimeout(() => e.toast.classList.remove("visible"), 2600); }
  function todayLogs() { const key = dayKey(new Date()); return s.logs.filter(x => x.day === key); }
  function sum(logs, kind) { return logs.reduce((a, x) => a + (x.kind === kind ? (Number(x.seconds) || 0) : 0), 0); }
  function renderDate() { e.date.textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }).toUpperCase(); }
  function renderTimer() {
    const free = s.mode === "free", amount = free ? s.freeElapsed : s.remaining;
    e.display.textContent = fmtTime(amount); e.display.dateTime = "PT" + Math.floor(amount / 60) + "M" + (amount % 60) + "S";
    const copy = { focus: ["Find your flow", "FOCUS SESSION", "A focused session, just for you."], short: ["Take a breath", "SHORT BREAK", "Step back. You’ve earned it."], long: ["Let your mind wander", "LONG BREAK", "A proper pause to reset."], free: ["Time to yourself", "FREE TIME", "Enjoy a little room to roam."] }[s.mode];
    e.heading.textContent = s.running && s.mode === "focus" ? "You’re in your focus zone" : copy[0];
    e.label.textContent = s.running ? (free ? "FREE TIME IN PROGRESS" : "YOU’RE RIGHT ON TRACK") : copy[1];
    e.subtitle.textContent = s.notice || (s.running ? "Stay with this moment. The rest can wait." : copy[2]);
    e.toggleLabel.textContent = s.running ? (free ? "Save free time" : "Pause session") : (free && s.freeElapsed > 0 ? "Resume free time" : (!free && s.remaining !== modeLength() ? "Resume session" : "Start " + (s.mode === "focus" ? "focus" : free ? "free time" : "break")));
    e.toggle.classList.toggle("running", s.running); e.toggle.setAttribute("aria-pressed", String(s.running));
    document.querySelectorAll(".mode-button").forEach(b => { const on = b.dataset.mode === s.mode; b.classList.toggle("active", on); b.setAttribute("aria-pressed", String(on)); b.disabled = s.running; });
    const task = activeTask(); e.currentTask.textContent = s.mode === "focus" ? (task ? task.name : "Choose what you’ll work on") : free ? "No plan needed. Just be here." : "A pause is part of the process.";
    const fraction = free ? (s.freeElapsed % 60) / 60 : 1 - s.remaining / Math.max(1, modeLength());
    e.ring.style.strokeDashoffset = String(C * (1 - Math.min(1, Math.max(0, fraction)))); e.ring.style.stroke = free || s.mode !== "focus" ? "#a7d7bb" : "#d4f47d";
    e.hint.innerHTML = '<i>✳</i> ' + (s.notice ? "Your session is paused." : "This space pauses when you step away.");
  }
  function renderTasks() {
    const open = s.tasks.filter(t => !t.done).length; e.taskTotal.textContent = open + " left"; e.taskList.replaceChildren();
    if (!s.tasks.length) { const li = document.createElement("li"); li.className = "empty-task"; li.textContent = "Your list is clear. Add a task when you’re ready."; e.taskList.append(li); renderTimer(); return; }
    s.tasks.forEach(task => {
      const row = document.createElement("li"); row.className = "task-item" + (task.done ? " done" : "") + (task.id === s.selectedTaskId ? " selected" : "");
      const check = document.createElement("button"); check.type = "button"; check.className = "task-check"; check.setAttribute("aria-label", (task.done ? "Mark incomplete: " : "Complete: ") + task.name); check.setAttribute("aria-pressed", String(task.done)); check.addEventListener("click", ev => { ev.stopPropagation(); toggleTask(task.id); });
      const name = document.createElement("span"); name.className = "task-name"; name.textContent = task.name; row.append(check, name);
      if (task.id === s.selectedTaskId && !task.done) { const tag = document.createElement("small"); tag.textContent = "UP NEXT"; row.append(tag); }
      row.addEventListener("click", () => { if (!task.done) { s.selectedTaskId = task.id; persist(); renderTasks(); } }); e.taskList.append(row);
    }); renderTimer();
  }
  function renderWeek() {
    const now = new Date(), days = []; let week = 0;
    for (let i = 6; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i), key = dayKey(d); const secs = sum(s.logs.filter(x => x.day === key), "focus"); days.push({ d, key, secs }); week += secs; }
    const peak = Math.max(1, ...days.map(x => x.secs)); e.weekTotal.textContent = mins(week); e.weekChart.replaceChildren();
    days.forEach(x => { const col = document.createElement("div"); col.className = "day" + (x.key === dayKey(now) ? " today" : "") + (x.secs ? "" : " empty"); const wrap = document.createElement("div"); wrap.className = "bar-wrap"; const bar = document.createElement("i"); bar.className = "day-bar"; bar.style.height = (x.secs ? Math.max(8, Math.round(x.secs / peak * 76)) : 4) + "px"; bar.dataset.minutes = Math.floor(x.secs / 60) + " min"; bar.setAttribute("role", "img"); bar.setAttribute("aria-label", x.d.toLocaleDateString(undefined, { weekday: "long" }) + ": " + mins(x.secs) + " focused"); wrap.append(bar); const label = document.createElement("small"); label.textContent = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][x.d.getDay()]; col.append(wrap, label); e.weekChart.append(col); });
  }
  function renderStats() {
    const logs = todayLogs(), focus = sum(logs, "focus"), free = sum(logs, "free"), percent = Math.min(100, Math.round(focus / 7200 * 100));
    e.focusToday.innerHTML = mins(focus).replace(/(h|m)/g, "<span>$1</span>"); e.freeToday.innerHTML = mins(free).replace(/(h|m)/g, "<span>$1</span>");
    e.percent.textContent = String(percent); e.goalBar.style.width = percent + "%"; e.count.textContent = String(logs.filter(x => x.kind === "focus" && x.seconds >= 60).length); renderWeek();
  }
  function setMode(mode) { if (s.running) return; s.mode = mode; s.remaining = mode === "free" ? 0 : modeLength(); s.freeElapsed = 0; s.notice = ""; renderTimer(); }
  function log(kind, seconds) { if (seconds < 60) return; const task = kind === "focus" ? activeTask() : null; s.logs.push({ kind, seconds: Math.floor(seconds), day: dayKey(new Date()), at: new Date().toISOString(), task: task ? task.name : "" }); persist(); renderStats(); }
  function tick() {
    if (!s.running) return;
    if (s.mode === "free") { s.freeElapsed = Math.floor((Date.now() - s.freeStartedAt) / 1000); renderTimer(); return; }
    s.remaining = Math.max(0, Math.ceil((s.endsAt - Date.now()) / 1000)); renderTimer(); if (!s.remaining) complete();
  }
  function start() {
    s.notice = ""; s.running = true;
    if (s.mode === "free") s.freeStartedAt = Date.now() - s.freeElapsed * 1000; else s.endsAt = Date.now() + s.remaining * 1000;
    s.interval = setInterval(tick, 250); renderTimer();
    if (s.mode === "focus" && s.autoFullscreen && document.fullscreenEnabled && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => toast("Full screen isn’t available. Your session has still started."));
  }
  function pause(notice) {
    if (!s.running) return; tick(); if (!s.running) return; s.running = false; clearInterval(s.interval); s.interval = 0;
    if (s.mode === "free") s.freeElapsed = Math.floor((Date.now() - s.freeStartedAt) / 1000); s.endsAt = 0; s.notice = notice || ""; renderTimer(); persist();
  }
  function complete() {
    const mode = s.mode; s.running = false; clearInterval(s.interval); s.interval = 0; s.endsAt = 0; s.remaining = 0;
    if (mode === "focus") log("focus", modeLength()); else log("break", modeLength()); s.notice = "Session complete. Take a breath before your next one.";
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); renderTimer(); renderStats(); persist(); toast(mode === "focus" ? "Focus session complete. Nice work showing up." : "Break complete. Come back when you’re ready.");
  }
  function finishFree() { const elapsed = s.freeElapsed; s.running = false; clearInterval(s.interval); s.interval = 0; s.freeElapsed = 0; log("free", elapsed); s.notice = "Free time saved. Good to have that for yourself."; if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); renderTimer(); renderStats(); persist(); toast("Your free time has been logged."); }
  function toggle() { if (!s.running) { start(); return; } if (s.mode === "free") finishFree(); else pause(""); }
  function reset() { s.running = false; clearInterval(s.interval); s.interval = 0; s.remaining = s.mode === "free" ? 0 : modeLength(); s.freeElapsed = 0; s.endsAt = 0; s.notice = ""; if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); renderTimer(); }
  function toggleTask(id) { const task = s.tasks.find(t => t.id === id); if (!task) return; task.done = !task.done; if (task.done && s.selectedTaskId === id) s.selectedTaskId = (s.tasks.find(t => !t.done && t.id !== id) || {}).id || ""; if (!task.done && !activeTask()) s.selectedTaskId = id; persist(); renderTasks(); }
  function addTask(name) { const text = name.trim(); if (!text) return; const task = { id: "task-" + Date.now() + Math.random().toString(36).slice(2, 6), name: text, done: false }; s.tasks.unshift(task); s.selectedTaskId = task.id; persist(); renderTasks(); e.taskInput.value = ""; }
  function fullScreen() { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => toast("Full screen isn’t available in this browser.")); }
  document.querySelectorAll(".mode-button").forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));
  e.toggle.addEventListener("click", toggle); $("resetTimer").addEventListener("click", reset); $("fullscreenTimer").addEventListener("click", fullScreen);
  $("openSettings").addEventListener("click", () => { e.form.elements.focus.value = s.durations.focus; e.form.elements.short.value = s.durations.short; e.form.elements.long.value = s.durations.long; e.fullToggle.checked = s.autoFullscreen; e.dialog.showModal(); });
  $("closeSettings").addEventListener("click", () => e.dialog.close());
  e.form.addEventListener("submit", ev => { ev.preventDefault(); const fd = new FormData(e.form); s.durations.focus = Math.min(180, Math.max(1, Number(fd.get("focus")) || 25)); s.durations.short = Math.min(60, Math.max(1, Number(fd.get("short")) || 5)); s.durations.long = Math.min(90, Math.max(1, Number(fd.get("long")) || 15)); s.autoFullscreen = e.fullToggle.checked; if (!s.running && s.mode !== "free") s.remaining = modeLength(); persist(); e.dialog.close(); renderTimer(); toast("Your timer rhythm has been saved."); });
  e.taskForm.addEventListener("submit", ev => { ev.preventDefault(); addTask(e.taskInput.value); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && s.running) pause("Paused while you were away. Pick up whenever you’re ready."); });
  document.addEventListener("fullscreenchange", () => { const b = $("fullscreenTimer"); b.setAttribute("aria-label", document.fullscreenElement ? "Exit full screen" : "Enter full screen"); b.title = document.fullscreenElement ? "Exit full screen" : "Full screen"; });
  window.addEventListener("pagehide", () => { if (s.running) { s.running = false; clearInterval(s.interval); persist(); } });
  renderDate(); renderTasks(); renderTimer(); renderStats();
})();