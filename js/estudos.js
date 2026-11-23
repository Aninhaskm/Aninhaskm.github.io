document.addEventListener("DOMContentLoaded", () => {
  createStudyBoard().start();
});

const STORAGE_KEY = "alk-estudo-v1";
const DAY_LABELS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const WEEKDAY_FROM_MONDAY = [1, 2, 3, 4, 5, 6, 0];

const OVERRIDES = {
  "2026-12-15": { title: "Prova AIF-C01", detail: "15h15 · UNICIT", minutes: 0 },
  "2026-12-24": { title: "Véspera de Natal", detail: "folga", minutes: 0 },
  "2026-12-25": { title: "Natal", detail: "folga", minutes: 0 },
  "2026-12-28": { title: "Prova CLF-C02", detail: "15h15 · UNICIT", minutes: 0 },
  "2027-01-01": { title: "Ano novo", detail: "folga", minutes: 0 },
};

const PHASES = {
  aif: {
    label: "fase AIF · até a prova de 15/12",
    slots: {
      1: { title: "Pós · Segurança da Informação", detail: "19h15 · 1h30", minutes: 90 },
      2: { title: "AIF-C01", detail: "19h15 · 1h30", minutes: 90 },
      3: { title: "Folga", detail: "sem estudo", minutes: 0 },
      4: { title: "AIF-C01", detail: "19h15 · 1h30", minutes: 90 },
      5: { title: "Pós · Arquitetura e Cloud", detail: "19h15 · 1h15", minutes: 75 },
      6: { title: "Path ACE", detail: "9h–13h · 4h", minutes: 240 },
      0: { title: "Revisão AIF", detail: "9h–12h · 3h", minutes: 180 },
    },
  },
  clf: {
    label: "fase Cloud Practitioner · até a prova de 28/12",
    slots: {
      1: { title: "Pós · Segurança da Informação", detail: "19h15 · 1h30", minutes: 90 },
      2: { title: "CLF-C02", detail: "19h15 · 1h30", minutes: 90 },
      3: { title: "Folga", detail: "sem estudo", minutes: 0 },
      4: { title: "CLF-C02", detail: "19h15 · 1h30", minutes: 90 },
      5: { title: "Pós · Arquitetura e Cloud", detail: "19h15 · 1h15", minutes: 75 },
      6: { title: "Path ACE", detail: "9h–13h · 4h", minutes: 240 },
      0: { title: "Revisão CLF", detail: "9h–12h · 3h", minutes: 180 },
    },
  },
  ace: {
    label: "fase badge ACE · até 31/01",
    slots: {
      1: { title: "Pós · Segurança da Informação", detail: "19h15 · 1h30", minutes: 90 },
      2: { title: "Path ACE", detail: "19h15 · 1h30", minutes: 90 },
      3: { title: "Folga", detail: "sem estudo", minutes: 0 },
      4: { title: "Path ACE", detail: "19h15 · 2h", minutes: 120 },
      5: { title: "Pós · Arquitetura e Cloud", detail: "19h15 · 1h15", minutes: 75 },
      6: { title: "Path ACE", detail: "9h–13h · 4h", minutes: 240 },
      0: { title: "Path ACE", detail: "9h–12h · 3h", minutes: 180 },
    },
  },
  sim: {
    label: "fase simulado ACE · depois do badge",
    slots: {
      1: { title: "Pós · Segurança da Informação", detail: "19h15 · 1h30", minutes: 90 },
      2: { title: "Simulado ACE", detail: "19h15 · 1h30", minutes: 90 },
      3: { title: "Folga", detail: "sem estudo", minutes: 0 },
      4: { title: "Simulado ACE", detail: "19h15 · 2h", minutes: 120 },
      5: { title: "Pós · Arquitetura e Cloud", detail: "19h15 · 1h15", minutes: 75 },
      6: { title: "Simulado ACE", detail: "9h–13h · 4h", minutes: 240 },
      0: { title: "Revisão ACE", detail: "9h–12h · 3h", minutes: 180 },
    },
  },
};

function createStudyBoard() {
  const counts = document.querySelectorAll(".exam-count");
  const phaseEl = document.getElementById("study-phase");
  const kickerEl = document.getElementById("study-kicker");
  const titleEl = document.getElementById("study-today-title");
  const detailEl = document.getElementById("study-today-detail");
  const weeksEl = document.getElementById("weeks");
  const metricsEl = document.getElementById("metrics");
  const clockEl = document.getElementById("timer-clock");
  const metaEl = document.getElementById("timer-meta");
  const barEl = document.getElementById("timer-bar");
  const fillEl = document.getElementById("timer-fill");
  const startBtn = document.getElementById("timer-start");
  const pauseBtn = document.getElementById("timer-pause");
  const resetBtn = document.getElementById("timer-reset");

  const state = loadState();
  let renderedWeek = "";

  function tick() {
    const now = new Date();
    const today = spParts(now);

    let soonest = null;
    counts.forEach((node) => {
      const at = node.getAttribute("data-at");
      if (!at) return;
      const remaining = new Date(at).getTime() - now.getTime();
      node.textContent = formatCountdown(remaining);
      const card = node.closest("article");
      if (card) card.classList.remove("is-soon");
      if (remaining > 0 && (!soonest || remaining < soonest.remaining)) {
        soonest = { card, remaining };
      }
    });
    if (soonest && soonest.card) soonest.card.classList.add("is-soon");

    const slot = slotFor(today.iso, today.weekday);
    const phase = PHASES[phaseFor(today.iso)];
    if (phaseEl) phaseEl.textContent = phase.label;
    if (kickerEl) kickerEl.textContent = `hoje · ${DAY_LABELS[today.weekday]}`;
    if (titleEl) titleEl.textContent = slot.title;
    if (detailEl) detailEl.textContent = slot.detail;

    const weekKey = mondayOf(today.iso);
    if (weeksEl && renderedWeek !== weekKey) {
      renderWeeks(weeksEl, today.iso, state, () => paintMetrics(metricsEl, state));
      renderedWeek = weekKey;
    } else if (weeksEl) {
      markToday(weeksEl, today.iso);
    }

    paintTimer(now.getTime(), today.iso, slot.minutes);
    paintMetrics(metricsEl, state);
  }

  function paintTimer(nowMs, iso, targetMinutes) {
    const running = Boolean(state.timer.runningSince);
    const sessionMs = state.timer.sessionMs + (running ? nowMs - state.timer.runningSince : 0);
    if (clockEl) clockEl.textContent = formatClock(sessionMs);

    const logged = Number(state.log[iso]) || 0;
    const liveLogged = logged + (running ? nowMs - state.timer.runningSince : 0);
    const targetLabel = targetMinutes ? `meta ${formatMinutes(targetMinutes)}` : "sem meta hoje";
    if (metaEl) metaEl.textContent = `${targetLabel} · hoje ${formatClock(liveLogged)}`;

    if (startBtn) startBtn.disabled = running;
    if (pauseBtn) pauseBtn.disabled = !running;

    if (!barEl || !fillEl) return;
    if (!targetMinutes) {
      barEl.hidden = true;
      return;
    }
    barEl.hidden = false;
    const ratio = Math.min(100, (liveLogged / (targetMinutes * 60 * 1000)) * 100);
    fillEl.style.width = `${ratio}%`;
  }

  function start() {
    if (state.timer.runningSince) return;
    state.timer.runningSince = Date.now();
    saveState(state);
    tick();
  }

  function pause() {
    if (!state.timer.runningSince) return;
    const now = Date.now();
    const delta = Math.max(0, now - state.timer.runningSince);
    state.timer.sessionMs += delta;
    state.timer.runningSince = null;
    addLog(state, spParts(new Date(now)).iso, delta);
    saveState(state);
    tick();
  }

  function reset() {
    if (state.timer.runningSince) pause();
    state.timer.sessionMs = 0;
    state.timer.runningSince = null;
    saveState(state);
    tick();
  }

  if (startBtn) startBtn.addEventListener("click", start);
  if (pauseBtn) pauseBtn.addEventListener("click", pause);
  if (resetBtn) resetBtn.addEventListener("click", reset);

  return {
    start() {
      tick();
      window.setInterval(tick, 1000);
    },
  };
}

function renderWeeks(container, todayIso, state, onChange) {
  container.replaceChildren();
  weeksToShow(todayIso).forEach((monday) => {
    const block = document.createElement("section");
    block.className = "week-block";
    if (monday === mondayOf(todayIso)) block.classList.add("is-current");

    const title = document.createElement("h3");
    title.textContent = formatRange(monday);
    if (monday === mondayOf(todayIso)) {
      const tag = document.createElement("span");
      tag.textContent = "esta semana";
      title.append(tag);
    }

    const list = document.createElement("ul");
    list.className = "study-week";
    renderWeek(list, monday, todayIso, state, onChange);
    block.append(title, list);
    container.append(block);
  });
}

function renderWeek(list, mondayIso, todayIso, state, onChange) {
  list.replaceChildren();
  WEEKDAY_FROM_MONDAY.forEach((weekday, index) => {
    const iso = addDays(mondayIso, index);
    const slot = slotFor(iso, weekday);
    const item = document.createElement("li");
    item.className = "study-item";
    item.dataset.date = iso;
    if (iso === todayIso) item.classList.add("is-today");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(state.checks[iso]);
    checkbox.setAttribute("aria-label", `${DAY_LABELS[weekday]} · ${slot.title}`);
    if (state.checks[iso]) item.classList.add("is-done");
    checkbox.addEventListener("change", () => {
      state.checks[iso] = checkbox.checked;
      item.classList.toggle("is-done", checkbox.checked);
      saveState(state);
      if (onChange) onChange();
    });

    const day = document.createElement("span");
    day.className = "study-day";
    day.textContent = DAY_LABELS[weekday];

    const title = document.createElement("span");
    title.className = "study-item-title";
    title.textContent = slot.title;

    const detail = document.createElement("span");
    detail.className = "study-item-detail";
    detail.textContent = slot.minutes ? formatMinutes(slot.minutes) : "livre";

    item.append(checkbox, day, title, detail);
    list.append(item);
  });
}

function markToday(list, todayIso) {
  list.querySelectorAll(".study-item").forEach((item) => {
    item.classList.toggle("is-today", item.dataset.date === todayIso);
  });
}

function paintMetrics(metricsEl, state) {
  if (!metricsEl) return;
  const today = spParts(new Date());
  const weeks = weeksToShow(today.iso);
  const cycleStart = weeks[0];
  const cycleEnd = addDays(weeks[weeks.length - 1], 6);
  const untilToday = sumRange(cycleStart, today.iso, today.iso, state);
  const cycle = sumRange(cycleStart, cycleEnd, today.iso, state);

  metricsEl.replaceChildren();

  const head = document.createElement("div");
  head.className = "metric-head";

  const kicker = document.createElement("p");
  kicker.className = "metric-kicker";
  kicker.textContent = "até hoje";

  const value = document.createElement("p");
  value.className = "metric-value";
  value.textContent = formatHours(untilToday.done);
  const goal = document.createElement("span");
  goal.textContent = ` / ${formatHours(untilToday.planned)}`;
  value.append(goal);

  const note = document.createElement("p");
  note.className = "metric-note";
  const ratio = percent(untilToday.done, untilToday.planned);
  note.textContent = `${ratio}% da meta acumulada · ciclo ${formatHours(cycle.done)} de ${formatHours(cycle.planned)}`;

  const track = document.createElement("div");
  track.className = "metric-track";
  const fill = document.createElement("div");
  fill.className = "metric-fill";
  fill.style.width = `${ratio}%`;
  track.append(fill);
  head.append(kicker, value, note, track);

  const chart = document.createElement("ul");
  chart.className = "metric-weeks";
  weeks.forEach((monday) => {
    const sunday = addDays(monday, 6);
    const score = sumRange(monday, sunday, today.iso, state);
    const weekRatio = percent(score.done, score.planned);
    const item = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = formatRange(monday);
    const bar = document.createElement("div");
    bar.className = "metric-track";
    const barFill = document.createElement("div");
    barFill.className = "metric-fill";
    barFill.style.width = `${weekRatio}%`;
    bar.append(barFill);
    const numbers = document.createElement("span");
    numbers.textContent = `${formatHours(score.done)} / ${formatHours(score.planned)}`;
    item.append(label, bar, numbers);
    chart.append(item);
  });

  metricsEl.append(head, chart);
}

function weeksToShow(todayIso) {
  const start = mondayOf(todayIso);
  let last = mondayOf("2027-01-31");
  if (todayIso > "2027-01-31") last = addDays(start, 21);
  if (last < start) last = start;
  const weeks = [];
  let cursor = start;
  while (cursor <= last && weeks.length < 16) {
    weeks.push(cursor);
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

function sumRange(fromIso, toIso, todayIso, state) {
  let planned = 0;
  let done = 0;
  let cursor = fromIso;
  const runningExtra = state.timer.runningSince && todayIso
    ? Math.max(0, Date.now() - state.timer.runningSince)
    : 0;
  while (cursor <= toIso) {
    const score = dayScore(cursor, weekdayOfIso(cursor), cursor === todayIso ? runningExtra : 0, state);
    planned += score.planned;
    done += score.done;
    cursor = addDays(cursor, 1);
  }
  return { planned, done };
}

function dayScore(iso, weekday, extraMs, state) {
  const planned = slotFor(iso, weekday).minutes || 0;
  if (!planned) return { planned: 0, done: 0 };
  const loggedMin = ((Number(state.log[iso]) || 0) + extraMs) / 60000;
  const done = state.checks[iso] ? planned : Math.min(planned, loggedMin);
  return { planned, done };
}

function percent(done, planned) {
  if (!planned) return 0;
  return Math.max(0, Math.min(100, Math.round((done / planned) * 100)));
}

function formatRange(mondayIso) {
  return `${formatDay(mondayIso)} – ${formatDay(addDays(mondayIso, 6))}`;
}

function formatDay(iso) {
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const [, month, day] = iso.split("-");
  return `${Number(day)} ${months[Number(month) - 1]}`;
}

function formatHours(mins) {
  const rounded = Math.round(mins);
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  if (!hours) return `${minutes}min`;
  if (!minutes) return `${hours}h`;
  return `${hours}h${String(minutes).padStart(2, "0")}`;
}

function slotFor(iso, weekday) {
  if (OVERRIDES[iso]) return OVERRIDES[iso];
  return PHASES[phaseFor(iso)].slots[weekday];
}

function phaseFor(iso) {
  if (iso <= "2026-12-15") return "aif";
  if (iso <= "2026-12-28") return "clf";
  if (iso <= "2027-01-31") return "ace";
  return "sim";
}

function spParts(date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });
  const bag = {};
  fmt.formatToParts(date).forEach((part) => {
    if (part.type !== "literal") bag[part.type] = part.value;
  });
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const month = bag.month;
  const day = bag.day;
  return {
    weekday: weekdayMap[bag.weekday],
    iso: `${bag.year}-${month}-${day}`,
  };
}

function mondayOf(iso) {
  const weekday = weekdayOfIso(iso);
  const offset = weekday === 0 ? 6 : weekday - 1;
  return addDays(iso, -offset);
}

function weekdayOfIso(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function addDays(iso, days) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatCountdown(ms) {
  if (ms <= 0) return "encerrada";
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days > 0) return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
  const seconds = total % 60;
  return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

function formatClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function formatMinutes(mins) {
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  if (!hours) return `${minutes}min`;
  if (!minutes) return `${hours}h`;
  return `${hours}h${String(minutes).padStart(2, "0")}`;
}

function emptyState() {
  return { checks: {}, log: {}, timer: { sessionMs: 0, runningSince: null } };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return emptyState();
    const checks = {};
    if (data.checks && typeof data.checks === "object") {
      Object.keys(data.checks).forEach((key) => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(key) && data.checks[key] === true) checks[key] = true;
      });
    }
    const log = {};
    if (data.log && typeof data.log === "object") {
      Object.keys(data.log).forEach((key) => {
        const value = Number(data.log[key]);
        if (/^\d{4}-\d{2}-\d{2}$/.test(key) && Number.isFinite(value) && value > 0) {
          log[key] = Math.min(value, 20 * 60 * 60 * 1000);
        }
      });
    }
    const sessionMs = Number(data.timer && data.timer.sessionMs);
    const runningSince = Number(data.timer && data.timer.runningSince);
    return {
      checks,
      log,
      timer: {
        sessionMs: Number.isFinite(sessionMs) && sessionMs > 0 ? Math.min(sessionMs, 12 * 60 * 60 * 1000) : 0,
        runningSince: Number.isFinite(runningSince) && runningSince > 0 ? runningSince : null,
      },
    };
  } catch (error) {
    return emptyState();
  }
}

function addLog(state, iso, delta) {
  if (!delta) return;
  const current = Number(state.log[iso]) || 0;
  state.log[iso] = Math.min(current + delta, 20 * 60 * 60 * 1000);
}

function saveState(state) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        checks: state.checks,
        log: state.log,
        timer: state.timer,
      })
    );
  } catch (error) {
    // armazenamento local indisponível: o cronômetro segue só nesta visita
  }
}
