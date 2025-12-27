import React, { useEffect, useMemo, useState } from "react";


/**
 * Timeboxing + Habits
 * - Weekly habits grid (top)
 * - Calendar: Day / Week / Month (middle)
 *   - Day view: drag & drop timeboxing
 *   - + button opens modal to add events (time, name, color, comments, duration)
 *   - Click event to edit/delete
 * - 3 pies (bottom)
 *
 * Persistence: localStorage
 */

// ------------------------- Helpers -------------------------
const LS_KEY = "tb_habits_v4";

const pad2 = (n) => String(n).padStart(2, "0");

function toISODate(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
}

// Use noon to avoid DST/off-by-one issues for date-only logic.
function parseISODate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}
function startOfDay(d) {
  const x = new Date(d);
  x.setHours(12, 0, 0, 0);
  return x;
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  x.setHours(12, 0, 0, 0);
  return x;
}
function startOfISOWeek(d) {
  const x = startOfDay(d);
  const day = x.getDay(); // 0 Sun ... 6 Sat
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  return addDays(x, diff);
}
function endOfISOWeek(d) {
  return addDays(startOfISOWeek(d), 6);
}
function startOfMonth(d) {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}
function endOfMonth(d) {
  const x = startOfMonth(d);
  x.setMonth(x.getMonth() + 1);
  x.setDate(0);
  x.setHours(12, 0, 0, 0);
  return x;
}

function completionColor(pct) {
  // 0% → ljusgrön, 100% → mörkgrön
  const light = 92 - Math.round((pct / 100) * 40); // 92 → 52
  return `hsl(140, 45%, ${light}%)`;
}

function minutesToHHMM(m) {
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${pad2(hh)}:${pad2(mm)}`;
}

function hhmmToMinutes(hhmm) {
  const [hh, mm] = hhmm.split(":").map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return 8 * 60;
  return hh * 60 + mm;
}

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function fmtShortWeekday(d) {
  return new Date(d).toLocaleDateString("sv-SE", { weekday: "short" });
}
function fmtMonthDay(d) {
  return new Date(d).toLocaleDateString("sv-SE", { month: "short", day: "numeric" });
}
function fmtFull(d) {
  return new Date(d).toLocaleDateString("sv-SE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// ------------------------- UI bits -------------------------
function Section({ title, right, children }) {
  return (
    <div className="rounded-2xl border bg-white/50 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold">{title}</div>
        </div>
        {right}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Pill({ children }) {
  return (
    <span className="inline-flex items-center rounded-xl border bg-white px-2.5 py-1 text-xs font-medium shadow-sm">
      {children}
    </span>
  );
}

function IconButton({ title, onClick, children }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border bg-white text-sm shadow-sm hover:bg-neutral-50"
    >
      {children}
    </button>
  );
}

function Pie({ percent, label, sublabel }) {
  const p = clamp(Math.round(percent), 0, 100);
  const r = 36;
  const c = 2 * Math.PI * r;
  const dash = (p / 100) * c;
  const gap = c - dash;

  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-white/50 p-4 shadow-sm">
      <svg width="92" height="92" viewBox="0 0 92 92" aria-label={label}>
        <circle cx="46" cy="46" r={r} fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="10" />
        <circle
          cx="46"
          cy="46"
          r={r}
          fill="none"
          stroke="rgba(0,0,0,0.85)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`}
          transform="rotate(-90 46 46)"
        />
        <text x="46" y="51" textAnchor="middle" className="fill-black" style={{ fontSize: 16, fontWeight: 700 }}>
          {p}%
        </text>
      </svg>
      <div>
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-sm text-black/60">{sublabel}</div>
      </div>
    </div>
  );
}

function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border bg-white p-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="text-base font-semibold">{title}</div>
          <button
            type="button"
            className="rounded-xl border bg-white px-2 py-1 text-xs shadow-sm hover:bg-neutral-50"
            onClick={onClose}
          >
            Stäng
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

// ------------------------- App -------------------------
const DEFAULT_HABITS = [
  { id: "h1", name: "Vatten", active: true },
  { id: "h2", name: "Träning", active: true },
  { id: "h3", name: "Läs 20 min", active: true },
];

// Event model:
// eventsByDate[iso] = [{
//   id,
//   type: "habit"|"custom",
//   habitId?,
//   title,
//   startMin,
//   durationMin,
//   color,     // hex
//   notes,     // string
// }]
export default function App() {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [selectedISO, setSelectedISO] = useState(toISODate(today));
  const selectedDate = useMemo(() => parseISODate(selectedISO), [selectedISO]);

  const [view, setView] = useState("day"); // day | week | month
  const TIME_GRID_STEP_MIN = 15;

  const [habits, setHabits] = useState(DEFAULT_HABITS);
  const [habitChecksByDate, setHabitChecksByDate] = useState({});
  const [eventsByDate, setEventsByDate] = useState({});

  // Drag payload: { source: "palette"|"existing", habitId?, eventId? }
  const [dragPayload, setDragPayload] = useState(null);

  // Modal state
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventModalISO, setEventModalISO] = useState(selectedISO);
  const [editingEventId, setEditingEventId] = useState(null);
  const [habitModalOpen, setHabitModalOpen] = useState(false);

  const [formTime, setFormTime] = useState("09:00");
  const [formTitle, setFormTitle] = useState("");
  const [formDuration, setFormDuration] = useState(30);
  const [formColor, setFormColor] = useState("#93c5fd"); // light blue default
  const [formNotes, setFormNotes] = useState("");

  // ------------------ Persistence ------------------
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s.selectedISO) setSelectedISO(s.selectedISO);
      if (s.view) setView(s.view);
      if (Array.isArray(s.habits)) setHabits(s.habits);
      if (s.habitChecksByDate) setHabitChecksByDate(s.habitChecksByDate);
      if (s.eventsByDate) setEventsByDate(s.eventsByDate);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({ selectedISO, view, habits, habitChecksByDate, eventsByDate })
      );
    } catch {
      // ignore
    }
  }, [selectedISO, view, habits, habitChecksByDate, eventsByDate]);

  const activeHabits = useMemo(() => habits.filter((h) => h.active), [habits]);

  // ------------------ Habit actions ------------------
  const [newHabitName, setNewHabitName] = useState("");

  function addHabit() {
    const name = newHabitName.trim();
    if (!name) return;
    setHabits((prev) => [...prev, { id: uid(), name, active: true }]);
    setNewHabitName("");
  }

  function toggleHabitActive(id) {
    setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, active: !h.active } : h)));
  }

  function deleteHabit(id) {
    setHabits((prev) => prev.filter((h) => h.id !== id));

    setHabitChecksByDate((prev) => {
      const next = { ...prev };
      for (const iso of Object.keys(next)) {
        const row = next[iso] || {};
        if (Object.prototype.hasOwnProperty.call(row, id)) {
          const { [id]: _rm, ...rest } = row;
          next[iso] = rest;
        }
      }
      return next;
    });

    setEventsByDate((prev) => {
      const next = { ...prev };
      for (const iso of Object.keys(next)) {
        next[iso] = (next[iso] || []).filter((e) => e.type !== "habit" || e.habitId !== id);
      }
      return next;
    });
  }

  function setHabitCheckForDate(iso, habitId, checked) {
    setHabitChecksByDate((prev) => {
      const cur = prev[iso] ?? {};
      return { ...prev, [iso]: { ...cur, [habitId]: checked } };
    });
  }

  // ------------------ Week grid (top) ------------------
  const weekStart = useMemo(() => startOfISOWeek(selectedDate), [selectedDate]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekISOs = useMemo(() => weekDays.map((d) => toISODate(d)), [weekDays]);
  const weekHourRows = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);

  // ------------------ Default habit blocks per day ------------------

    function snapToTimeGrid(minutes) {
    return Math.ceil(minutes / TIME_GRID_STEP_MIN) * TIME_GRID_STEP_MIN;
  }

  function ensureDefaultHabitBlocksForDay(iso) {
    ensureDefaultHabitBlocksForDates([iso]);
  }

  function ensureDefaultHabitBlocksForDates(isos) {
    if (activeHabits.length === 0 || isos.length === 0) return;

    setEventsByDate((prev) => {
      let changed = false;
      const next = { ...prev };

      isos.forEach((iso) => {
        const existing = next[iso] ?? [];
        const habitBlocks = existing.filter((e) => e.type === "habit");
        const existingHabitIds = new Set(habitBlocks.map((e) => e.habitId));
        const missingHabits = activeHabits.filter((h) => !existingHabitIds.has(h.id));
        if (missingHabits.length === 0) return;

        const startBase = 8 * 60; // 08:00
         const gap = TIME_GRID_STEP_MIN;
        const dur = 30;
        const lastEnd =
          habitBlocks.length > 0
            ? Math.max(...habitBlocks.map((e) => e.startMin + (e.durationMin ?? dur))) + gap
            : startBase;
        let cursor = snapToTimeGrid(lastEnd);

        const newBlocks = missingHabits.map((h) => {
          const block = {
            id: uid(),
            type: "habit",
            habitId: h.id,
            title: h.name,
            startMin: cursor,
            durationMin: dur,
            color: "#bbf7d0", // light green
            notes: "",
          };
          cursor = snapToTimeGrid(cursor + dur + gap);
          return block;
        });

        if (newBlocks.length > 0) {
          changed = true;
          next[iso] = [...existing, ...newBlocks];
        }
      });

      return changed ? next : prev;
    });
  }
  
  // ------------------ Event CRUD ------------------
  function addEventForDay(iso, evt) {
    setEventsByDate((prev) => {
      const cur = prev[iso] ?? [];
      return { ...prev, [iso]: [...cur, evt] };
    });
  }

  function updateEventForDay(iso, eventId, patch) {
    setEventsByDate((prev) => {
      const cur = prev[iso] ?? [];
      const next = cur.map((e) => (e.id === eventId ? { ...e, ...patch } : e));
      return { ...prev, [iso]: next };
    });
  }

  function deleteEventForDay(iso, eventId) {
    setEventsByDate((prev) => {
      const cur = prev[iso] ?? [];
      return { ...prev, [iso]: cur.filter((e) => e.id !== eventId) };
    });
  }

  function openAddEventModal(iso) {
    setEventModalISO(iso);
    setEditingEventId(null);
    setFormTime("09:00");
    setFormTitle("");
    setFormDuration(30);
    setFormColor("#93c5fd");
    setFormNotes("");
    setEventModalOpen(true);
  }

  
  function openHabitModal() {
    setHabitModalOpen(true);
  }


  function openEditEventModal(iso, evt) {
    setEventModalISO(iso);
    setEditingEventId(evt.id);
    setFormTime(minutesToHHMM(evt.startMin));
    setFormTitle(evt.title ?? "");
    setFormDuration(evt.durationMin ?? 30);
    setFormColor(evt.color ?? "#93c5fd");
    setFormNotes(evt.notes ?? "");
    setEventModalOpen(true);
  }

  function saveEventModal() {
    const title = formTitle.trim();
    if (!title) return;

    const iso = eventModalISO;
    const startMin = hhmmToMinutes(formTime);
    const durationMin = Math.max(5, Number(formDuration) || 30);
    const color = formColor || "#93c5fd";
    const notes = formNotes ?? "";

    if (!editingEventId) {
      addEventForDay(iso, {
        id: uid(),
        type: "custom",
        title,
        startMin,
        durationMin,
        color,
        notes,
      });
    } else {
      updateEventForDay(iso, editingEventId, { title, startMin, durationMin, color, notes });
    }

    setEventModalOpen(false);
  }

  function deleteFromModal() {
    if (!editingEventId) return;
    deleteEventForDay(eventModalISO, editingEventId);
    setEventModalOpen(false);
  }

  // ------------------ Drag/drop helpers ------------------
  function moveEventToTime(iso, eventId, newStartMin) {
    updateEventForDay(iso, eventId, { startMin: newStartMin });
  }

  function addHabitBlockAtTime(iso, habitId, startMin) {
    const h = habits.find((x) => x.id === habitId);
    if (!h) return;

    addEventForDay(iso, {
      id: uid(),
      type: "habit",
      habitId: h.id,
      title: h.name,
      startMin,
      durationMin: 30,
      color: "#bbf7d0",
      notes: "",
    });
  }

  // ------------------ Completion calculations ------------------
  function completionForRange(startIso, endIsoInclusive) {
    const start = parseISODate(startIso);
    const end = parseISODate(endIsoInclusive);
    const days = [];
    for (let d = startOfDay(start); d <= end; d = addDays(d, 1)) {
      days.push(toISODate(d));
    }

    const habitsActive = activeHabits;
    if (habitsActive.length === 0) return { done: 0, total: 0, pct: 0 };

    let done = 0;
    let total = 0;

    for (const iso of days) {
      const checks = habitChecksByDate[iso] ?? {};
      for (const h of habitsActive) {
        total += 1;
        if (checks[h.id]) done += 1;
      }
    }
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { done, total, pct };
  }

  const todayComp = useMemo(
    () => completionForRange(selectedISO, selectedISO),
    [selectedISO, habitChecksByDate, activeHabits]
  );

  const weekComp = useMemo(() => {
    const s = toISODate(startOfISOWeek(selectedDate));
    const e = toISODate(endOfISOWeek(selectedDate));
    return completionForRange(s, e);
  }, [selectedDate, habitChecksByDate, activeHabits]);

  const monthComp = useMemo(() => {
    const s = toISODate(startOfMonth(selectedDate));
    const e = toISODate(endOfMonth(selectedDate));
    return completionForRange(s, e);
  }, [selectedDate, habitChecksByDate, activeHabits]);

  // ------------------ Month grid for calendar ------------------
  const monthDays = useMemo(() => {
    const first = startOfMonth(selectedDate);
    const last = endOfMonth(selectedDate);

    const gridStart = startOfISOWeek(first);
    const gridEnd = addDays(startOfISOWeek(addDays(last, 6)), 6);

    const out = [];
    for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) out.push(startOfDay(d));
    return out;
  }, [selectedDate]);

   const visibleISOs = useMemo(() => {
    if (view === "week") return weekISOs;
    if (view === "month") return monthDays.map((d) => toISODate(d));
    return [selectedISO];
  }, [view, weekISOs, monthDays, selectedISO]);

  useEffect(() => {
    // Auto-create default habit blocks for all visible days
    ensureDefaultHabitBlocksForDates(visibleISOs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleISOs, activeHabits]);


  // ------------------ Navigation ------------------
  function goPrev() {
    if (view === "day") setSelectedISO(toISODate(addDays(selectedDate, -1)));
    if (view === "week") setSelectedISO(toISODate(addDays(selectedDate, -7)));
    if (view === "month") {
      const d = new Date(selectedDate);
      d.setMonth(d.getMonth() - 1);
      setSelectedISO(toISODate(d));
    }
  }
  function goNext() {
    if (view === "day") setSelectedISO(toISODate(addDays(selectedDate, 1)));
    if (view === "week") setSelectedISO(toISODate(addDays(selectedDate, 7)));
    if (view === "month") {
      const d = new Date(selectedDate);
      d.setMonth(d.getMonth() + 1);
      setSelectedISO(toISODate(d));
    }
  }
  function goToday() {
    setSelectedISO(toISODate(today));
  }

  // ------------------ Day view time grid ------------------
  const DAY_START_MIN = 6 * 60; // 06:00
  const DAY_END_MIN = 22 * 60; // 22:00
  const STEP_MIN = TIME_GRID_STEP_MIN;
  const ROW_HEIGHT_PX = 32;
  const WEEK_START_MIN = 0;
  const WEEK_END_MIN = 24 * 60;

  const timeRows = useMemo(() => {
    const rows = [];
    for (let m = DAY_START_MIN; m <= DAY_END_MIN; m += STEP_MIN) rows.push(m);
    return rows;
  }, []);

    const weekTimeRows = useMemo(() => {
    const rows = [];
    for (let m = WEEK_START_MIN; m <= WEEK_END_MIN; m += STEP_MIN) rows.push(m);
    return rows;
  }, []);


  const dayEventsSorted = useMemo(() => {
    const arr = eventsByDate[selectedISO] ?? [];
    return [...arr].sort((a, b) => a.startMin - b.startMin);
  }, [eventsByDate, selectedISO]);

  // ------------------------- Render -------------------------
  return (
    <div className="min-h-screen w-full bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-6xl p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-2xl font-semibold">Timeboxing + Habits</div>
            <div className="text-sm text-neutral-600">
              Veckohabits överst. Kalender med dag/vecka/månad. Dagvy har drag & drop. + för att lägga till aktiviteter.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button className="rounded-2xl border bg-white px-3 py-2 text-sm shadow-sm" onClick={goPrev} type="button">
              Föregående
            </button>
            <button className="rounded-2xl border bg-white px-3 py-2 text-sm shadow-sm" onClick={goToday} type="button">
              Idag
            </button>
            <button className="rounded-2xl border bg-white px-3 py-2 text-sm shadow-sm" onClick={goNext} type="button">
              Nästa
            </button>

            <div className="ml-0 md:ml-2">
              <input
                className="rounded-2xl border bg-white px-3 py-2 text-sm shadow-sm"
                type="date"
                value={selectedISO}
                onChange={(e) => setSelectedISO(e.target.value)}
              />
            </div>

            <div className="ml-0 flex items-center gap-2 md:ml-2">
              <select
                className="rounded-2xl border bg-white px-3 py-2 text-sm shadow-sm"
                value={view}
                onChange={(e) => setView(e.target.value)}
              >
                <option value="day">Dagvy</option>
                <option value="week">Veckovy</option>
                <option value="month">Månadsvy</option>
              </select>
            </div>
          </div>
        </div>

        {/* Top: Weekly habits grid */}
        <div className="mt-5">
          <Section
            title="Dagliga vanor – veckovy"
            right={
              <div className="flex flex-wrap items-center gap-2">
                <Pill>
                  {fmtMonthDay(weekDays[0])}–{fmtMonthDay(weekDays[6])}
                </Pill>
                <Pill>Klicka på en dag för att välja datum i kalendern.</Pill>
                                <IconButton title="Lägg till vana" onClick={openHabitModal}>
                  +
                </IconButton>
              </div>
            }
          >
         <div className="w-full overflow-x-auto rounded-2xl border bg-white shadow-sm">
              <div className="min-w-[860px]">
                <div className="grid grid-cols-[260px_repeat(7,1fr)] border-b bg-neutral-50">
                  <div className="p-3 text-sm font-semibold">Dagliga vanor</div>
                  {weekDays.map((d) => {
                    const iso = toISODate(d);
                    const isSelected = iso === selectedISO;
                    return (
                      <button
                        key={iso}
                        className={`p-3 text-left text-sm hover:bg-neutral-100 ${isSelected ? "bg-neutral-100" : ""}`}
                          onClick={() => {
                          setSelectedISO(iso);
                          setView("day");
                        }}
                        type="button"
                      >
                        <div className="font-semibold">{fmtShortWeekday(d)}</div>
                        <div className="text-xs text-neutral-600">{fmtMonthDay(d)}</div>
                      </button>
                    );
                  })}
                </div>
                        <div className="divide-y">
{activeHabits.map((h) => (
  <div key={h.id} className="grid grid-cols-[260px_repeat(7,1fr)] items-center">
    <div className="p-3">
      <div className="text-sm font-semibold">{h.name}</div>
      <div className="text-xs text-neutral-600">Bocka av per dag</div>
    </div>

    {weekISOs.map((iso) => {
      const checked = !!habitChecksByDate[iso]?.[h.id];

      return (
        <div key={iso} className="flex items-center justify-center p-3">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setHabitCheckForDate(iso, h.id, e.target.checked)}
            className="h-4 w-4"
          />
        </div>
      );
    })}
  </div>
))}

                  {activeHabits.length === 0 && (
                    <div className="p-4 text-sm text-neutral-600">
                      Inga aktiva vanor ännu. Lägg till en med + uppe till höger.


                    </div>
         )}
                </div>
              </div>
            </div>
                        <div className="mt-3 rounded-2xl border bg-white p-3 text-sm text-neutral-700 shadow-sm">
              Klicka på ett event i kalendern för att redigera. Använd + uppe till höger i kalendern för att lägga till
              aktiviteter.
            </div>
          </Section>
        </div>

        {/* Calendar section */}
        <div className="mt-5">
          <Section
            title="Kalender"
            right={
              <div className="flex items-center gap-2">
                <Pill>Valt datum: {fmtFull(selectedDate)}</Pill>
                <IconButton title="Lägg till aktivitet" onClick={() => openAddEventModal(selectedISO)}>
                  +
                </IconButton>
              </div>
            }
          >
            {/* Views */}
            {view === "day" && (
              <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Dagvy (drag & drop)</div>
                  <Pill>{selectedISO}</Pill>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                  {/* Habit palette */}
                  <div className="lg:col-span-1">
                    <div className="rounded-2xl border bg-white p-3 shadow-sm">
                      <div className="text-sm font-semibold">Dra in habits</div>
                      <div className="mt-2 text-xs text-neutral-600">
                        Dra en habit och släpp på en tid i tidslinjen för att skapa ett block.
                      </div>

                      <div className="mt-3 space-y-2">
                        {activeHabits.map((h) => (
                          <div
                            key={h.id}
                            draggable
                            onDragStart={() => setDragPayload({ source: "palette", habitId: h.id })}
                            className="cursor-grab rounded-2xl border bg-neutral-50 p-2 text-sm font-semibold hover:bg-neutral-100"
                            title="Dra till tidslinjen"
                          >
                            {h.name}
                          </div>
                        ))}
                        {activeHabits.length === 0 && <div className="text-sm text-neutral-600">Inga aktiva habits.</div>}
                      </div>

                      <button
                        className="mt-3 w-full rounded-2xl border bg-white px-3 py-2 text-sm shadow-sm"
                        onClick={() => {
                          // Remove habit blocks and recreate
                          setEventsByDate((prev) => {
                            const cur = prev[selectedISO] ?? [];
                            const kept = cur.filter((e) => e.type !== "habit");
                            return { ...prev, [selectedISO]: kept };
                          });
                          setTimeout(() => ensureDefaultHabitBlocksForDay(selectedISO), 0);
                        }}
                        type="button"
                      >
                        Återskapa default-habits för dagen
                      </button>

                      <div className="mt-3 rounded-2xl border bg-neutral-50 p-3 text-xs text-neutral-700">
                        Tips: Klicka på ett block i tidslinjen för att redigera färg, namn, tid, kommentar eller ta bort.
                      </div>
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="lg:col-span-2">
                    <div className="rounded-2xl border bg-white shadow-sm">
                      <div className="border-b p-3 text-sm font-semibold">
                        Tidslinje ({minutesToHHMM(DAY_START_MIN)}–{minutesToHHMM(DAY_END_MIN)})
                      </div>

                      <div className="max-h-[560px] overflow-auto">
                        {timeRows.map((m) => {
                          const label = m % 60 === 0 ? minutesToHHMM(m) : "";
                          const rowEvents = (eventsByDate[selectedISO] ?? [])
                            .filter((e) => e.startMin === m)
                            .sort((a, b) => a.durationMin - b.durationMin);

                          return (
                            <div
                              key={m}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={() => {
                                if (!dragPayload) return;

                                if (dragPayload.source === "existing") {
                                  moveEventToTime(selectedISO, dragPayload.eventId, m);
                                } else if (dragPayload.source === "palette") {
                                  addHabitBlockAtTime(selectedISO, dragPayload.habitId, m);
                                }
                                setDragPayload(null);
                              }}
                               className="relative flex items-stretch border-b overflow-visible"
                              style={{ height: ROW_HEIGHT_PX }}>
                              <div className="w-16 shrink-0 p-2 text-right text-xs text-neutral-500">{label}</div>

                              <div className="flex-1 p-2">
                                {rowEvents.length === 0 ? (
                                  <div className="h-3" />
                                ) : (
                                  <div className="space-y-2">
                                    {rowEvents.map((e) => (
                                      <div
                                        key={e.id}
                                        draggable
                                        onDragStart={() => setDragPayload({ source: "existing", eventId: e.id })}
                                        onClick={() => openEditEventModal(selectedISO, e)}
                                        className="cursor-pointer rounded-2xl border p-2 text-sm shadow-sm hover:brightness-95"
                                        style={{
                                          backgroundColor: e.color || (e.type === "habit" ? "#bbf7d0" : "#93c5fd"),
                                            height: `${Math.max(1, (e.durationMin ?? STEP_MIN) / STEP_MIN) * ROW_HEIGHT_PX}px`,
                                        }}
                                        title="Klicka för att redigera • Dra för att flytta"
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="min-w-0">
                                            <div className="truncate font-semibold">{e.title}</div>
                                            <div className="text-xs text-neutral-700">
                                              {minutesToHHMM(e.startMin)} • {e.durationMin} min •{" "}
                                              {e.type === "habit" ? "habit" : "custom"}
                                            </div>
                                            {e.notes ? (
                                              <div className="mt-1 truncate text-xs text-neutral-700">{e.notes}</div>
                                            ) : null}
                                          </div>
                                          <button
                                            type="button"
                                            className="rounded-xl border bg-white px-2 py-1 text-xs shadow-sm hover:bg-neutral-50"
                                            onClick={(ev) => {
                                              ev.stopPropagation();
                                              deleteEventForDay(selectedISO, e.id);
                                            }}
                                            title="Ta bort"
                                          >
                                            Ta bort
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Fallback list (nice to have) */}
                    <div className="mt-3 rounded-2xl border bg-white p-3 shadow-sm">
                      <div className="text-sm font-semibold">Dagens aktiviteter</div>
                      {dayEventsSorted.length === 0 ? (
                        <div className="mt-2 text-sm text-neutral-600">Inga aktiviteter ännu.</div>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {dayEventsSorted.map((e) => (
                            <button
                              key={e.id}
                              type="button"
                              onClick={() => openEditEventModal(selectedISO, e)}
                              className="flex w-full items-center justify-between gap-3 rounded-2xl border p-2 text-left hover:bg-neutral-50"
                            >
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold">{e.title}</div>
                                <div className="text-xs text-neutral-600">
                                  {minutesToHHMM(e.startMin)} • {e.durationMin} min
                                </div>
                              </div>
                              <span
                                className="h-4 w-4 rounded-full border"
                                style={{ backgroundColor: e.color || "#e5e7eb" }}
                                aria-label="color"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {view === "week" && (
              <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Veckovy</div>
                  <Pill>
                    {toISODate(startOfISOWeek(selectedDate))}–{toISODate(endOfISOWeek(selectedDate))}
                  </Pill>
                </div>

                <div className="mt-3 w-full overflow-x-auto">
                  <div className="min-w-[980px] rounded-2xl border">
                        <div className="grid grid-cols-[90px_repeat(7,1fr)] border-b bg-neutral-50">
                      <div className="p-3 text-xs font-semibold text-neutral-600">Tid</div>
                      {weekDays.map((d) => {
                        const iso = toISODate(d);
                        return (
                          <button
                            key={iso}
                            className={`p-3 text-left text-sm hover:bg-neutral-100 ${
                              iso === selectedISO ? "bg-neutral-100" : ""
                            }`}
                             onClick={() => {
                              setSelectedISO(iso);
                              setView("day");
                            }}
                            type="button"
                          >
                            <div className="font-semibold">{fmtShortWeekday(d)}</div>
                            <div className="text-xs text-neutral-600">{fmtMonthDay(d)}</div>
                          </button>
                        );
                      })}
                    </div>

                                     <div className="border-b px-3 py-2 text-xs text-neutral-600">
                      Skrolla för att se hela dygnet (00:00–24:00). Klicka på en aktivitet för att redigera. + lägger
                      till på valt datum.
                    </div>

                                         <div className="max-h-[640px] overflow-y-auto">
                      {weekTimeRows.map((m) => {
                        const label = m % 60 === 0 ? minutesToHHMM(m) : "";
                        return (
                             <div
                           key={m}
                           className="grid grid-cols-[90px_repeat(7,1fr)] border-b"
                           style={{ height: ROW_HEIGHT_PX }}
                         >
                            <div className="p-2 text-right text-[11px] text-neutral-500">{label}</div>
                            {weekISOs.map((iso) => {
                              const rowEvents = (eventsByDate[iso] ?? [])
                                .filter((e) => e.startMin === m)
                                .sort((a, b) => a.durationMin - b.durationMin);
                              return (
                                 <div key={iso} className="relative overflow-visible border-l p-1">
                                  {rowEvents.length === 0 ? (
                                    <div className="h-3" />
                                  ) : (
                                    <div className="space-y-1">
                                      {rowEvents.map((e) => (
                                        <button
                                          key={e.id}
                                          type="button"
                                          onClick={() => openEditEventModal(iso, e)}
                                          className="w-full rounded-xl border px-2 py-1 text-left text-[11px] shadow-sm hover:brightness-95"
                                          style={{
                                            backgroundColor: e.color || (e.type === "habit" ? "#bbf7d0" : "#93c5fd"),
                                            height: `${Math.max(1, (e.durationMin ?? STEP_MIN) / STEP_MIN) * ROW_HEIGHT_PX}px`,
                                          }}
                                          title="Klicka för att redigera"
                                        >
                                          <div className="truncate font-semibold">{e.title}</div>
                                          <div className="text-[10px] text-neutral-700">
                                            {minutesToHHMM(e.startMin)} • {e.durationMin} min
                                          </div>
                                        </button>
                                      ))}

                                    </div>
                                            )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {view === "month" && (
              <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Månadsvy</div>
                  <Pill>{selectedDate.toLocaleDateString("sv-SE", { year: "numeric", month: "long" })}</Pill>
                </div>

                <div className="mt-3 grid grid-cols-7 gap-2">
                  {["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"].map((x) => (
                    <div key={x} className="px-2 text-xs font-semibold text-neutral-700">
                      {x}
                    </div>
                  ))}

                  {monthDays.map((d) => {
                    const iso = toISODate(d);
                    const inMonth = d.getMonth() === selectedDate.getMonth();
                    const plannedCount = (eventsByDate[iso] ?? []).length;

                    const checks = habitChecksByDate[iso] ?? {};
                    const dayDone = activeHabits.reduce((acc, h) => acc + (checks[h.id] ? 1 : 0), 0);
                    const dayTotal = activeHabits.length;
                    const dayPct = dayTotal ? Math.round((dayDone / dayTotal) * 100) : 0;

                    return (
                      <button
                        key={iso}
                         onClick={() => {
                          setSelectedISO(iso);
                          setView("day");
                        }}
                        type="button"
                        style={{ backgroundColor: inMonth ? completionColor(dayPct) : "transparent" }}
                        className={`rounded-2xl border p-3 text-left shadow-sm transition hover:brightness-95 ${
                          iso === selectedISO ? "ring-2 ring-black/30" : ""
                        } ${inMonth ? "" : "opacity-40"}`}
                        title="Klicka för att välja datum. Använd + för att lägga till aktivitet."
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold">{d.getDate()}</div>
                          {plannedCount > 0 && <Pill>{plannedCount} plan</Pill>}
                        </div>

                        <div className="mt-2 text-center text-2xl font-extrabold leading-none">{dayPct}%</div>
                        <div className="mt-1 text-center text-[11px] text-neutral-700">
                          {dayTotal > 0 ? `${dayDone}/${dayTotal} habits` : "Inga habits"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </Section>
        </div>

        {/* Bottom: pie charts */}
        <div className="mt-5">
          <Section title="Uppföljning">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Pie percent={todayComp.pct} label="Idag" sublabel={`${todayComp.done}/${todayComp.total} habits klara`} />
              <Pie percent={weekComp.pct} label="Denna vecka" sublabel={`${weekComp.done}/${weekComp.total} habits klara`} />
              <Pie percent={monthComp.pct} label="Denna månad" sublabel={`${monthComp.done}/${monthComp.total} habits klara`} />
            </div>

            <div className="mt-3 rounded-2xl border bg-white p-3 text-sm text-neutral-700 shadow-sm">
              Diagrammen baseras på bockade habits (aktiva habits). Kalender-aktiviteter är separat och hjälper dig timeboxa.
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div className="mt-6 text-xs text-neutral-500">
          Sparas lokalt i din webbläsare (localStorage). Inget skickas någonstans.
        </div>
      </div>

      {/* Event Modal */}
      <Modal
        open={eventModalOpen}
        title={editingEventId ? "Redigera aktivitet" : "Lägg till aktivitet"}
        onClose={() => setEventModalOpen(false)}
      >
        <div className="grid grid-cols-1 gap-3">
          <div className="text-xs font-semibold text-neutral-700">Datum</div>
          <div className="rounded-2xl border bg-neutral-50 px-3 py-2 text-sm">{eventModalISO}</div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <div className="text-xs font-semibold text-neutral-700">Tid</div>
              <input
                className="mt-1 w-full rounded-2xl border bg-white px-3 py-2 text-sm"
                type="time"
                value={formTime}
                onChange={(e) => setFormTime(e.target.value)}
              />
            </div>

            <div>
              <div className="text-xs font-semibold text-neutral-700">Minuter</div>
              <input
                className="mt-1 w-full rounded-2xl border bg-white px-3 py-2 text-sm"
                type="number"
                min={5}
                step={5}
                value={formDuration}
                onChange={(e) => setFormDuration(e.target.value)}
              />
            </div>

            <div>
              <div className="text-xs font-semibold text-neutral-700">Färg</div>
              <input
                className="mt-1 h-[40px] w-full rounded-2xl border bg-white px-2 py-2"
                type="color"
                value={formColor}
                onChange={(e) => setFormColor(e.target.value)}
              />
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-neutral-700">Namn</div>
            <input
              className="mt-1 w-full rounded-2xl border bg-white px-3 py-2 text-sm"
              placeholder="T.ex. Möte, Gym, Plugga..."
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
            />
          </div>

          <div>
            <div className="text-xs font-semibold text-neutral-700">Kommentar</div>
            <textarea
              className="mt-1 w-full rounded-2xl border bg-white px-3 py-2 text-sm"
              rows={3}
              placeholder="Valfritt..."
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <div className="flex gap-2">
              {editingEventId ? (
                <button
                  type="button"
                  className="rounded-2xl border bg-white px-3 py-2 text-sm shadow-sm hover:bg-neutral-50"
                  onClick={deleteFromModal}
                >
                  Ta bort
                </button>
              ) : null}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-2xl border bg-white px-3 py-2 text-sm shadow-sm hover:bg-neutral-50"
                onClick={() => setEventModalOpen(false)}
              >
                Avbryt
              </button>
              <button
                type="button"
                className="rounded-2xl border bg-black px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90"
                onClick={saveEventModal}
              >
                Spara
              </button>
            </div>
          </div>

          {!formTitle.trim() ? (
            <div className="text-xs text-neutral-600">Obs: Namn måste fyllas i för att spara.</div>
          ) : null}
        </div>
      </Modal>
      
      {/* Habit Modal */}
      <Modal open={habitModalOpen} title="Hantera vanor" onClose={() => setHabitModalOpen(false)}>
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              className="w-full rounded-2xl border bg-white px-3 py-2 text-sm"
              placeholder="Ny vana (t.ex. Meditation)"
              value={newHabitName}
              onChange={(e) => setNewHabitName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addHabit();
              }}
            />
            <button className="rounded-2xl border bg-black px-3 py-2 text-sm text-white" onClick={addHabit} type="button">
              Lägg till
            </button>
          </div>

          <div className="space-y-2">
            {habits.map((h) => (
              <div key={h.id} className="flex items-center justify-between gap-2 rounded-2xl border p-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{h.name}</div>
                  <div className="text-xs text-neutral-600">{h.active ? "Aktiv" : "Inaktiv"}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-xl border bg-white px-2 py-1 text-xs"
                    onClick={() => toggleHabitActive(h.id)}
                    type="button"
                  >
                    {h.active ? "Inaktivera" : "Aktivera"}
                  </button>
                  <button
                    className="rounded-xl border bg-white px-2 py-1 text-xs"
                    onClick={() => deleteHabit(h.id)}
                    type="button"
                    title="Ta bort"
                  >
                    Ta bort
                  </button>
                </div>
              </div>
            ))}
            {habits.length === 0 && <div className="text-sm text-neutral-600">Inga vanor ännu.</div>}
          </div>

          <div className="rounded-2xl border bg-neutral-50 p-3 text-xs text-neutral-700">
            Dagvyn auto-lägger in default-block för alla aktiva vanor första gången du öppnar en dag.
          </div>
        </div>
      </Modal>
    </div>
  );
}
