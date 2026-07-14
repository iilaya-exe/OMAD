/* =============================================================
   storage.js — data model + localStorage persistence
   Amounts are stored as integer centavos to avoid floating-point
   rounding bugs (e.g. 0.1 + 0.2 !== 0.3).
   ============================================================= */

"use strict";

const Storage = (() => {
  const KEY = "student-budget-tracker:v1";
  const CURRENCY = "₱"; // fixed — the app budgets in Philippine pesos

  /* Fixed category list. Each maps to one categorical color slot
     (--cat-1 … --cat-8 in style.css); the order never changes so
     a category keeps its color everywhere in the app. */
  const CATEGORIES = [
    { id: "food",          name: "Food & Dining",       slot: 1 },
    { id: "groceries",     name: "Groceries",            slot: 2 },
    { id: "transport",     name: "Transport",            slot: 3 },
    { id: "housing",       name: "Housing & Utilities",  slot: 4 },
    { id: "education",     name: "Education",            slot: 5 },
    { id: "entertainment", name: "Entertainment",        slot: 6 },
    { id: "health",        name: "Health",               slot: 7 },
    { id: "other",         name: "Other",                slot: 8 },
  ];

  const VALID_IDS = new Set(CATEGORIES.map((c) => c.id));
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  function defaultData() {
    return {
      version: 1,
      settings: {
        currency: CURRENCY,
        theme: "auto",
        period: null, // { semester, academicYear "YYYY-YYYY" } — set during onboarding
      },
      budgets: {},   // { categoryId: centavos }
      expenses: [],  // { id, amountCents, category, date "YYYY-MM-DD", method, note }
      goals: [],     // { id, name, targetCents, deadline "YYYY-MM-DD"|"", entries: [{ id, amountCents, date }] }
      archives: [],  // finished periods: { id, period, archivedAt, expenses, budgets, goals }
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultData();
      return sanitize(JSON.parse(raw));
    } catch (err) {
      console.error("Failed to load saved data, starting fresh.", err);
      return defaultData();
    }
  }

  function save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (err) {
      console.error("Failed to save data.", err);
      return false;
    }
  }

  /* ---------- field-by-field validation (used on every load, so a
     corrupted or hand-edited localStorage entry can't break the app) */

  function cleanPeriod(p) {
    if (p && typeof p === "object" &&
        typeof p.semester === "string" && p.semester.trim() &&
        typeof p.academicYear === "string" && /^\d{4}-\d{4}$/.test(p.academicYear)) {
      return { semester: p.semester.trim().slice(0, 30), academicYear: p.academicYear };
    }
    return null;
  }

  function cleanExpenseList(list) {
    const out = [];
    if (!Array.isArray(list)) return out;
    for (const e of list) {
      if (!e || typeof e !== "object") continue;
      if (!Number.isFinite(e.amountCents) || e.amountCents <= 0) continue;
      if (!VALID_IDS.has(e.category)) continue;
      if (typeof e.date !== "string" || !DATE_RE.test(e.date)) continue;
      out.push({
        id: typeof e.id === "string" ? e.id : uid(),
        amountCents: Math.round(e.amountCents),
        category: e.category,
        date: e.date,
        method: typeof e.method === "string" ? e.method.slice(0, 40) : "Cash",
        note: typeof e.note === "string" ? e.note.slice(0, 120) : "",
      });
    }
    return out;
  }

  function cleanBudgetMap(obj) {
    const out = {};
    if (!obj || typeof obj !== "object") return out;
    for (const [cat, cents] of Object.entries(obj)) {
      if (VALID_IDS.has(cat) && Number.isFinite(cents) && cents >= 0) {
        out[cat] = Math.round(cents);
      }
    }
    return out;
  }

  function cleanGoalList(list) {
    const out = [];
    if (!Array.isArray(list)) return out;
    for (const g of list) {
      if (!g || typeof g !== "object") continue;
      if (typeof g.name !== "string" || !g.name.trim()) continue;
      if (!Number.isFinite(g.targetCents) || g.targetCents <= 0) continue;
      const entries = [];
      if (Array.isArray(g.entries)) {
        for (const e of g.entries) {
          if (!e || typeof e !== "object") continue;
          if (!Number.isFinite(e.amountCents) || e.amountCents === 0) continue;
          if (typeof e.date !== "string" || !DATE_RE.test(e.date)) continue;
          entries.push({
            id: typeof e.id === "string" ? e.id : uid(),
            amountCents: Math.round(e.amountCents),
            date: e.date,
          });
        }
      }
      out.push({
        id: typeof g.id === "string" ? g.id : uid(),
        name: g.name.trim().slice(0, 60),
        targetCents: Math.round(g.targetCents),
        deadline: typeof g.deadline === "string" && DATE_RE.test(g.deadline) ? g.deadline : "",
        entries,
      });
    }
    return out;
  }

  function sanitize(obj) {
    const clean = defaultData();
    if (!obj || typeof obj !== "object") return clean;

    if (obj.settings && typeof obj.settings === "object") {
      if (["auto", "light", "dark"].includes(obj.settings.theme)) {
        clean.settings.theme = obj.settings.theme;
      }
      clean.settings.period = cleanPeriod(obj.settings.period);
    }

    clean.budgets = cleanBudgetMap(obj.budgets);
    clean.expenses = cleanExpenseList(obj.expenses);
    clean.goals = cleanGoalList(obj.goals);

    if (Array.isArray(obj.archives)) {
      for (const a of obj.archives) {
        if (!a || typeof a !== "object") continue;
        const period = cleanPeriod(a.period);
        if (!period) continue;
        clean.archives.push({
          id: typeof a.id === "string" ? a.id : uid(),
          period,
          archivedAt: typeof a.archivedAt === "string" && DATE_RE.test(a.archivedAt)
            ? a.archivedAt
            : new Date().toISOString().slice(0, 10),
          expenses: cleanExpenseList(a.expenses),
          budgets: cleanBudgetMap(a.budgets),
          goals: cleanGoalList(a.goals),
        });
      }
    }

    return clean;
  }

  function uid() {
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  /* ---------- sample data (for the ?demo preview) ---------- */

  function sampleData() {
    const data = defaultData();
    const now = new Date();
    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    // Peso-realistic recurring patterns (amounts in centavos).
    const templates = [
      { category: "food",          min: 5000,   max: 25000,  perMonth: 14, notes: ["Campus cafeteria", "Coffee", "Lunch out", "Late-night snacks", "Pizza with roommates"] },
      { category: "groceries",     min: 30000,  max: 150000, perMonth: 4,  notes: ["Weekly groceries", "Grocery run"] },
      { category: "transport",     min: 2000,   max: 15000,  perMonth: 8,  notes: ["Jeepney fare", "Ride share", "Bus ticket"] },
      { category: "housing",       min: 400000, max: 500000, perMonth: 1,  notes: ["Boarding house + utilities"] },
      { category: "education",     min: 10000,  max: 200000, perMonth: 2,  notes: ["Textbook", "Printing", "Lab fee", "Online course"] },
      { category: "entertainment", min: 10000,  max: 80000,  perMonth: 4,  notes: ["Movie night", "Streaming subscription", "Game", "Concert ticket"] },
      { category: "health",        min: 10000,  max: 100000, perMonth: 1,  notes: ["Pharmacy", "Gym fee"] },
      { category: "other",         min: 5000,   max: 50000,  perMonth: 2,  notes: ["Gift", "Haircut", "Laundry"] },
    ];
    const methods = ["Cash", "Debit card", "Credit card", "Mobile / e-wallet"];

    function genExpenses(monthsBackFrom, monthsBackTo, out) {
      for (let m = monthsBackFrom; m <= monthsBackTo; m++) {
        const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
        const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        const maxDay = m === 0 ? now.getDate() : daysInMonth; // current month: only up to today
        for (const t of templates) {
          const count = m === 0 ? Math.max(1, Math.round(t.perMonth * (maxDay / daysInMonth))) : t.perMonth;
          for (let i = 0; i < count; i++) {
            out.push({
              id: uid(),
              amountCents: rand(t.min, t.max),
              category: t.category,
              date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(rand(1, maxDay)).padStart(2, "0")}`,
              method: methods[rand(0, methods.length - 1)],
              note: t.notes[rand(0, t.notes.length - 1)],
            });
          }
        }
      }
    }

    // Current period: guess the school term from today's date.
    const mo = now.getMonth() + 1;
    const startYear = mo >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    data.settings.period = {
      semester: mo >= 8 ? "1st Semester" : (mo <= 5 ? "2nd Semester" : "Summer / Midyear"),
      academicYear: `${startYear}-${startYear + 1}`,
    };

    data.budgets = {
      food: 350000, groceries: 400000, transport: 100000, housing: 500000,
      education: 250000, entertainment: 150000, health: 100000, other: 100000,
    };

    genExpenses(0, 2, data.expenses);

    const monthsFromNow = (n) => iso(new Date(now.getFullYear(), now.getMonth() + n, 15));
    const mkGoal = (name, targetCents, deadline, deposits) => ({
      id: uid(),
      name,
      targetCents,
      deadline,
      entries: deposits.map((cents, i) => ({
        id: uid(),
        amountCents: cents,
        date: iso(new Date(now.getFullYear(), now.getMonth() - i, rand(1, Math.min(28, now.getDate())))),
      })),
    });

    data.goals = [
      mkGoal("Emergency fund", 500000, "", [80000, 60000, 50000]),
      mkGoal("Semester break trip", 350000, monthsFromNow(8), [40000, 50000]),
      mkGoal("New laptop", 3000000, monthsFromNow(14), [100000]),
    ];

    // One archived (previous) period so the History section has content.
    const cur = data.settings.period;
    let prev;
    if (cur.semester === "1st Semester") {
      const sy = startYear - 1;
      prev = { semester: "2nd Semester", academicYear: `${sy}-${sy + 1}` };
    } else if (cur.semester === "2nd Semester") {
      prev = { semester: "1st Semester", academicYear: cur.academicYear };
    } else {
      prev = { semester: "2nd Semester", academicYear: cur.academicYear };
    }

    const archExpenses = [];
    genExpenses(3, 5, archExpenses);
    data.archives.push({
      id: uid(),
      period: prev,
      archivedAt: iso(new Date(now.getFullYear(), now.getMonth() - 3, 20)),
      expenses: archExpenses,
      budgets: {
        food: 300000, groceries: 350000, transport: 100000, housing: 480000,
        education: 300000, entertainment: 120000, health: 100000, other: 80000,
      },
      goals: [
        mkGoal("Concert ticket", 150000, "", [80000, 70000]), // completed
        mkGoal("Books fund", 100000, "", [60000]),
      ],
    });

    return data;
  }

  return { CATEGORIES, CURRENCY, defaultData, load, save, sanitize, uid, sampleData };
})();
