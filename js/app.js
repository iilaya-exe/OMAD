/* =============================================================
   app.js — application state, rendering, and event wiring
   Depends on storage.js (Storage) and charts.js (Charts).

   The money model is deliberately simple: one monthly budget for
   everything, and a flat list of expenses. Categories only label
   and colour an expense — nothing is allocated to them.
   ============================================================= */

"use strict";

(() => {
  /* ---------- state ---------- */

  let data = Storage.load();

  const today = new Date();
  const ui = {
    tab: "dashboard",
    month: monthKey(today),          // "YYYY-MM" shown on dashboard/expenses
    search: "",
    categoryFilter: "",
    sort: "date-desc",
  };

  const $ = (sel) => document.querySelector(sel);

  /* ---------- date helpers ---------- */

  function monthKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  function shiftMonth(key, delta) {
    const [y, m] = key.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return monthKey(d);
  }

  function monthLabel(key) {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }

  function shortMonthLabel(key) {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short" });
  }

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  /* ---------- money & category helpers ---------- */

  function fmtMoney(cents) {
    const abs = Math.abs(cents) / 100;
    const s = abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (cents < 0 ? "-" : "") + data.settings.currency + s;
  }

  function catById(id) {
    return Storage.CATEGORIES.find((c) => c.id === id) || Storage.CATEGORIES[Storage.CATEGORIES.length - 1];
  }

  function catColor(id) {
    const slot = catById(id).slot;
    return getComputedStyle(document.documentElement).getPropertyValue(`--cat-${slot}`).trim();
  }

  function expensesInMonth(key) {
    return data.expenses.filter((e) => e.date.startsWith(key));
  }

  function sumCents(list) {
    return list.reduce((acc, e) => acc + e.amountCents, 0);
  }

  /* ---------- persistence wrapper ---------- */

  function commit() {
    if (!Storage.save(data)) toast("Could not save — storage may be full");
  }

  /* ---------- theme ---------- */

  function resolveTheme() {
    // "?theme=dark|light" previews a theme without saving the preference
    const urlTheme = new URLSearchParams(location.search).get("theme");
    if (urlTheme === "dark" || urlTheme === "light") return urlTheme;
    const pref = data.settings.theme;
    if (pref === "auto") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return pref;
  }

  function applyTheme() {
    document.documentElement.dataset.theme = resolveTheme();
  }

  function toggleTheme() {
    data.settings.theme = resolveTheme() === "dark" ? "light" : "dark";
    commit();
    applyTheme();
    renderAll(); // charts re-read CSS variables
  }

  /* ---------- toast ---------- */

  let toastTimer = null;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  /* =============================================================
     Rendering
     ============================================================= */

  function renderAll() {
    renderPeriod();
    renderDashboard();
    renderExpenses();
    renderSavings();
    renderSettings();
  }

  /* ---------- budgeting period (semester / academic year) ---------- */

  function periodLabel(p) {
    return `${p.semester} · AY ${p.academicYear.replace("-", "–")}`;
  }

  function renderPeriod() {
    const p = data.settings.period;
    const badge = $("#period-badge");
    badge.hidden = !p;
    if (p) badge.textContent = periodLabel(p);
    // no period yet → the app starts at the onboarding screen
    $("#onboarding").hidden = !!p;
  }

  function guessPeriod() {
    const mo = new Date().getMonth() + 1;
    const startYear = mo >= 8 ? new Date().getFullYear() : new Date().getFullYear() - 1;
    return {
      semester: mo >= 8 ? "1st Semester" : (mo <= 5 ? "2nd Semester" : "Summer / Midyear"),
      academicYear: `${startYear}-${startYear + 1}`,
    };
  }

  function populateAcademicYearSelects() {
    const thisYear = new Date().getFullYear();
    for (const sel of [$("#ob-ay"), $("#set-ay")]) {
      for (let y = thisYear - 3; y <= thisYear + 2; y++) {
        const opt = document.createElement("option");
        opt.value = `${y}-${y + 1}`;
        opt.textContent = `${y}–${y + 1}`;
        sel.appendChild(opt);
      }
    }
    const guess = guessPeriod();
    $("#ob-semester").value = guess.semester;
    $("#ob-ay").value = guess.academicYear;
  }

  function completeOnboarding() {
    data.settings.period = {
      semester: $("#ob-semester").value,
      academicYear: $("#ob-ay").value,
    };
    const budget = parseFloat($("#ob-budget").value);
    data.budgetCents = Number.isFinite(budget) && budget > 0 ? Math.round(budget * 100) : 0;
    commit();
    switchTab("dashboard");
    renderAll();
    toast(`Budgeting for ${periodLabel(data.settings.period)}`);
  }

  function updatePeriodFromSettings() {
    data.settings.period = {
      semester: $("#set-semester").value,
      academicYear: $("#set-ay").value,
    };
    commit();
    renderPeriod();
    toast("Budgeting period updated");
  }

  /* ---------- the single budget ---------- */

  function setBudgetFromInput() {
    const v = parseFloat($("#budget-input").value);
    data.budgetCents = Number.isFinite(v) && v > 0 ? Math.round(v * 100) : 0;
    commit();
    renderAll();
    toast(data.budgetCents > 0 ? `Monthly budget set to ${fmtMoney(data.budgetCents)}` : "Monthly budget cleared");
  }

  function renderBudget(spent) {
    const budget = data.budgetCents;
    const input = $("#budget-input");
    // don't fight the user while they're typing in the field
    if (document.activeElement !== input) {
      input.value = budget > 0 ? (budget / 100).toFixed(budget % 100 === 0 ? 0 : 2) : "";
    }

    const fill = $("#budget-meter-fill");
    const caption = $("#budget-caption");
    const over = budget > 0 && spent > budget;
    const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;

    fill.style.width = pct + "%";
    fill.style.background = over ? "var(--status-critical)" : "var(--accent)";

    // the hero figure: the one number worth reading from across the room
    const heroLabel = $("#budget-hero-label");
    const heroValue = $("#budget-hero-value");
    heroValue.classList.toggle("over", over);
    if (budget <= 0) {
      heroLabel.textContent = "Spent this month";
      heroValue.textContent = fmtMoney(spent);
    } else if (over) {
      heroLabel.textContent = "Over budget by";
      heroValue.textContent = fmtMoney(spent - budget);
    } else {
      heroLabel.textContent = "Left to spend";
      heroValue.textContent = fmtMoney(budget - spent);
    }

    if (budget <= 0) {
      caption.textContent = spent > 0
        ? `${fmtMoney(spent)} spent this month — set a budget to track it.`
        : "No budget set yet. Enter one above.";
      return;
    }

    // over budget is stated in words + icon, never colour alone
    caption.innerHTML = "";
    if (over) {
      const span = document.createElement("span");
      span.className = "over";
      span.innerHTML = `${Icons.svg("alert", 13)} ${fmtMoney(spent)} of ${fmtMoney(budget)} — over by ${fmtMoney(spent - budget)}`;
      caption.appendChild(span);
    } else {
      caption.textContent =
        `${fmtMoney(spent)} of ${fmtMoney(budget)} used (${Math.round(pct)}%) · ${fmtMoney(budget - spent)} left for ${monthLabel(ui.month)}`;
    }
  }

  /* ---------- dashboard ---------- */

  function renderDashboard() {
    $("#dash-month-label").textContent = monthLabel(ui.month);

    const monthExpenses = expensesInMonth(ui.month);
    const total = sumCents(monthExpenses);

    renderBudget(total);

    // avg/day: divide by days elapsed if current month, else days in month
    const [y, m] = ui.month.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const isCurrent = ui.month === monthKey(new Date());
    const daysElapsed = isCurrent ? new Date().getDate() : daysInMonth;
    const avgPerDay = daysElapsed > 0 ? Math.round(total / daysElapsed) : 0;

    // top category
    const byCat = {};
    for (const e of monthExpenses) byCat[e.category] = (byCat[e.category] || 0) + e.amountCents;
    const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];

    // biggest single expense of the month
    const biggest = monthExpenses.reduce((max, e) => (!max || e.amountCents > max.amountCents ? e : max), null);

    // "left to spend" is the hero tile's job now, so it isn't repeated here
    const tiles = [
      { icon: "receipt", tint: "blue", label: "Spent this month", value: fmtMoney(total), hint: `${monthExpenses.length} expense${monthExpenses.length === 1 ? "" : "s"}` },
      topCat
        ? { icon: "tag", tint: "violet", label: "Top category", value: catById(topCat[0]).name, hint: fmtMoney(topCat[1]) }
        : { icon: "tag", tint: "violet", label: "Top category", value: "—", hint: "no expenses yet" },
      { icon: "calendar", tint: "orange", label: "Average per day", value: fmtMoney(avgPerDay), hint: isCurrent ? `over ${daysElapsed} day${daysElapsed === 1 ? "" : "s"} so far` : "full month" },
      biggest
        ? { icon: "wallet", tint: "green", label: "Biggest expense", value: fmtMoney(biggest.amountCents), hint: biggest.note || catById(biggest.category).name }
        : { icon: "wallet", tint: "green", label: "Biggest expense", value: "—", hint: "no expenses yet" },
    ];

    const row = $("#kpi-row");
    row.innerHTML = "";
    for (const t of tiles) {
      const tile = document.createElement("div");
      tile.className = "stat-tile";
      const icon = document.createElement("div");
      icon.className = `stat-icon tint-${t.tint}`;
      icon.innerHTML = Icons.svg(t.icon, 15);
      tile.appendChild(icon);
      const label = document.createElement("div");
      label.className = "stat-label";
      label.textContent = t.label;
      const value = document.createElement("div");
      value.className = "stat-value";
      value.textContent = t.value;
      const hint = document.createElement("div");
      hint.className = "stat-hint" + (t.hintClass ? " " + t.hintClass : "");
      hint.textContent = t.hint;
      tile.append(label, value, hint);
      row.appendChild(tile);
    }

    // category bar chart (sorted high → low; each category keeps its fixed color)
    $("#cat-chart-subtitle").textContent = monthLabel(ui.month);
    const items = Storage.CATEGORIES
      .map((c) => ({ label: c.name, value: byCat[c.id] || 0, color: catColor(c.id), valueText: fmtMoney(byCat[c.id] || 0) }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
    Charts.categoryBars($("#category-chart"), items);

    // 6-month trend ending at the selected month (single series → accent hue)
    const trend = [];
    for (let i = 5; i >= 0; i--) {
      const key = shiftMonth(ui.month, -i);
      const t = sumCents(expensesInMonth(key));
      trend.push({ label: shortMonthLabel(key), value: t / 100, valueText: fmtMoney(t) });
    }
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
    Charts.monthlyColumns($("#trend-chart"), trend, accent);

    // recent expenses (latest 5 overall, any month)
    const recent = [...data.expenses]
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
      .slice(0, 5);
    renderExpenseRows($("#recent-expenses"), recent, false);
  }

  /* ---------- expense list ---------- */

  function renderExpenses() {
    $("#exp-month-label").textContent = monthLabel(ui.month);

    let list = expensesInMonth(ui.month);
    if (ui.categoryFilter) list = list.filter((e) => e.category === ui.categoryFilter);
    if (ui.search) {
      const q = ui.search.toLowerCase();
      list = list.filter((e) =>
        e.note.toLowerCase().includes(q) ||
        catById(e.category).name.toLowerCase().includes(q)
      );
    }

    const sorters = {
      "date-desc":   (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
      "date-asc":    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
      "amount-desc": (a, b) => b.amountCents - a.amountCents,
      "amount-asc":  (a, b) => a.amountCents - b.amountCents,
    };
    list.sort(sorters[ui.sort] || sorters["date-desc"]);

    $("#expense-list-summary").textContent =
      `${list.length} expense${list.length === 1 ? "" : "s"} · total ${fmtMoney(sumCents(list))}`;

    renderExpenseRows($("#expense-list"), list, true);
  }

  function renderExpenseRows(container, list, withActions) {
    container.innerHTML = "";
    if (!list.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML = `<div class="empty-icon">${Icons.svg("inbox", 24)}</div>No expenses here yet. Click “Add expense” to record one.`;
      container.appendChild(empty);
      return;
    }

    for (const e of list) {
      const row = document.createElement("div");
      row.className = "expense-row";

      const dot = document.createElement("span");
      dot.className = "cat-dot";
      dot.style.background = catColor(e.category);

      const main = document.createElement("div");
      main.className = "expense-main";
      const note = document.createElement("div");
      note.className = "expense-note";
      note.textContent = e.note || catById(e.category).name;
      const meta = document.createElement("div");
      meta.className = "expense-meta";
      const dateText = new Date(e.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
      meta.textContent = `${catById(e.category).name} · ${dateText}`;
      main.append(note, meta);

      const amount = document.createElement("div");
      amount.className = "expense-amount";
      amount.textContent = fmtMoney(e.amountCents);

      row.append(dot, main, amount);

      if (withActions) {
        const actions = document.createElement("div");
        actions.className = "expense-actions";
        const editBtn = document.createElement("button");
        editBtn.className = "icon-btn";
        editBtn.title = "Edit";
        editBtn.innerHTML = Icons.svg("pencil", 15);
        editBtn.addEventListener("click", () => openModal(e));
        const delBtn = document.createElement("button");
        delBtn.className = "icon-btn danger";
        delBtn.title = "Delete";
        delBtn.innerHTML = Icons.svg("trash", 15);
        delBtn.addEventListener("click", () => deleteExpense(e));
        actions.append(editBtn, delBtn);
        row.appendChild(actions);
      }

      container.appendChild(row);
    }
  }

  function deleteExpense(e) {
    const label = e.note || catById(e.category).name;
    if (!confirm(`Delete "${label}" (${fmtMoney(e.amountCents)})?`)) return;
    data.expenses = data.expenses.filter((x) => x.id !== e.id);
    commit();
    renderAll();
    toast("Expense deleted");
  }

  /* ---------- savings goals ---------- */

  function goalSaved(goal) {
    return goal.entries.reduce((acc, e) => acc + e.amountCents, 0);
  }

  /* Whole months from today until the deadline (at least 1). */
  function monthsUntil(dateStr) {
    const now = new Date();
    const [y, m] = dateStr.split("-").map(Number);
    return Math.max(1, (y - now.getFullYear()) * 12 + (m - 1 - now.getMonth()));
  }

  function renderSavings() {
    const goals = data.goals;
    const totalSaved = goals.reduce((acc, g) => acc + goalSaved(g), 0);
    const totalTarget = goals.reduce((acc, g) => acc + g.targetCents, 0);

    $("#savings-summary").textContent = goals.length
      ? `${fmtMoney(totalSaved)} saved of ${fmtMoney(totalTarget)} across ${goals.length} goal${goals.length === 1 ? "" : "s"}`
      : "";

    const container = $("#goals-list");
    container.innerHTML = "";

    if (!goals.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML = `<div class="empty-icon">${Icons.svg("target", 24)}</div>No savings goals yet. Create one above — even a small weekly deposit adds up.`;
      container.appendChild(empty);
      return;
    }

    for (const goal of goals) {
      const saved = goalSaved(goal);
      const pct = Math.min(100, (saved / goal.targetCents) * 100);
      const done = saved >= goal.targetCents;
      const remaining = goal.targetCents - saved;

      const row = document.createElement("div");
      row.className = "goal-row";

      // header: name + optional deadline chip + delete
      const head = document.createElement("div");
      head.className = "goal-head";
      const name = document.createElement("div");
      name.className = "goal-name";
      const goalIcon = document.createElement("span");
      goalIcon.className = "goal-icon" + (done ? " done" : "");
      goalIcon.innerHTML = Icons.svg(done ? "trophy" : "target", 15);
      name.append(goalIcon, document.createTextNode(goal.name));
      if (goal.deadline) {
        const chip = document.createElement("span");
        chip.className = "goal-deadline";
        chip.textContent = "by " + new Date(goal.deadline + "T00:00:00")
          .toLocaleDateString(undefined, { month: "short", year: "numeric" });
        name.appendChild(chip);
      }
      const delBtn = document.createElement("button");
      delBtn.className = "icon-btn danger";
      delBtn.title = "Delete goal";
      delBtn.innerHTML = Icons.svg("trash", 15);
      delBtn.addEventListener("click", () => {
        if (!confirm(`Delete the goal "${goal.name}"${saved > 0 ? ` and its ${fmtMoney(saved)} history` : ""}?`)) return;
        data.goals = data.goals.filter((g) => g.id !== goal.id);
        commit();
        renderSavings();
        toast("Goal deleted");
      });
      head.append(name, delBtn);

      // meter: accent hue toward the target; status-good when reached
      const meter = document.createElement("div");
      meter.className = "meter";
      const fill = document.createElement("div");
      fill.className = "meter-fill";
      fill.style.width = pct + "%";
      fill.style.background = done ? "var(--status-good)" : "var(--accent)";
      meter.appendChild(fill);

      const caption = document.createElement("div");
      caption.className = "meter-caption";
      if (done) {
        const span = document.createElement("span");
        span.className = "reached";
        span.innerHTML = `${Icons.svg("check", 13)} Goal reached — ${fmtMoney(saved)} saved`;
        caption.appendChild(span);
      } else {
        let text = `${fmtMoney(saved)} of ${fmtMoney(goal.targetCents)} (${Math.round(pct)}%) · ${fmtMoney(remaining)} to go`;
        if (goal.deadline) {
          const perMonth = Math.ceil(remaining / monthsUntil(goal.deadline) / 100) * 100;
          text += ` · save ~${fmtMoney(perMonth)}/month to make it`;
        }
        caption.textContent = text;
      }

      // quick deposit / withdraw
      const actions = document.createElement("div");
      actions.className = "goal-actions";
      const amountInput = document.createElement("input");
      amountInput.type = "number";
      amountInput.className = "input";
      amountInput.step = "0.01";
      amountInput.min = "0.01";
      amountInput.placeholder = "Amount";
      amountInput.setAttribute("aria-label", `Amount for ${goal.name}`);

      const move = (sign) => {
        const v = parseFloat(amountInput.value);
        if (!Number.isFinite(v) || v <= 0) return toast("Enter an amount first");
        const cents = Math.round(v * 100) * sign;
        if (sign < 0 && -cents > saved) return toast("You can't withdraw more than you've saved");
        goal.entries.push({ id: Storage.uid(), amountCents: cents, date: todayISO() });
        commit();
        renderSavings();
        toast(sign > 0 ? `${fmtMoney(cents)} added to “${goal.name}”` : "Withdrawal recorded");
      };

      const depositBtn = document.createElement("button");
      depositBtn.className = "btn btn-primary";
      depositBtn.type = "button";
      depositBtn.innerHTML = `${Icons.svg("plus", 14)}Deposit`;
      depositBtn.addEventListener("click", () => move(1));

      const withdrawBtn = document.createElement("button");
      withdrawBtn.className = "btn";
      withdrawBtn.type = "button";
      withdrawBtn.innerHTML = `${Icons.svg("minus", 14)}Withdraw`;
      withdrawBtn.addEventListener("click", () => move(-1));

      actions.append(amountInput, depositBtn, withdrawBtn);

      row.append(head, meter, caption, actions);
      container.appendChild(row);
    }
  }

  function submitGoalForm(evt) {
    evt.preventDefault();
    const name = $("#g-name").value.trim();
    const target = parseFloat($("#g-target").value);
    const deadline = $("#g-deadline").value;

    const error = $("#goal-form-error");
    const fail = (msg) => { error.textContent = msg; error.hidden = false; };
    error.hidden = true;

    if (!name) return fail("Give your goal a name.");
    if (!Number.isFinite(target) || target <= 0) return fail("Enter a target amount greater than zero.");
    if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return fail("Pick a valid date.");
    if (deadline && deadline <= todayISO()) return fail("The target date should be in the future.");

    data.goals.push({
      id: Storage.uid(),
      name: name.slice(0, 60),
      targetCents: Math.round(target * 100),
      deadline: deadline || "",
      entries: [],
    });
    commit();
    $("#goal-form").reset();
    renderSavings();
    toast("Goal created");
  }

  /* ---------- settings ---------- */

  function renderSettings() {
    const p = data.settings.period || guessPeriod();
    const aySel = $("#set-ay");
    // a restored backup may carry a year outside the generated range
    if (![...aySel.options].some((o) => o.value === p.academicYear)) {
      const opt = document.createElement("option");
      opt.value = p.academicYear;
      opt.textContent = p.academicYear.replace("-", "–");
      aySel.appendChild(opt);
    }
    $("#set-semester").value = p.semester;
    aySel.value = p.academicYear;
    renderArchives();
  }

  /* ---------- period history / archive ---------- */

  function startNewPeriod() {
    const hasData = data.expenses.length || data.goals.length || data.budgetCents > 0;
    const label = data.settings.period ? periodLabel(data.settings.period) : "this period";
    const msg = hasData
      ? `Close out ${label}? Its expenses, budget, and savings goals move to History, and you'll set up a fresh period.`
      : `Close out ${label} and set up a fresh period?`;
    if (!confirm(msg)) return;

    if (hasData && data.settings.period) {
      data.archives.push({
        id: Storage.uid(),
        period: data.settings.period,
        archivedAt: todayISO(),
        budgetCents: data.budgetCents,
        expenses: data.expenses,
        goals: data.goals,
      });
    }

    data.expenses = [];
    data.budgetCents = 0;
    data.goals = [];
    data.settings.period = null; // brings the onboarding screen back
    commit();

    ui.month = monthKey(new Date());
    ui.search = "";
    ui.categoryFilter = "";
    renderAll();
    toast("Period archived — set up the new one");
  }

  function renderArchives() {
    const container = $("#archive-list");
    container.innerHTML = "";

    const archives = [...data.archives].sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));
    if (!archives.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML = `<div class="empty-icon">${Icons.svg("database", 24)}</div>No past periods yet. When you start a new budgeting period, the old one is kept here.`;
      container.appendChild(empty);
      return;
    }

    archives.forEach((a, idx) => {
      const total = sumCents(a.expenses);
      const row = document.createElement("div");
      row.className = "archive-row";

      const head = document.createElement("button");
      head.type = "button";
      head.className = "archive-head";
      head.setAttribute("aria-expanded", idx === 0 ? "true" : "false");
      const headText = document.createElement("div");
      headText.className = "archive-head-text";
      const title = document.createElement("div");
      title.className = "archive-title";
      title.textContent = periodLabel(a.period);
      const meta = document.createElement("div");
      meta.className = "archive-meta";
      const archivedDate = new Date(a.archivedAt + "T00:00:00")
        .toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
      const budgetText = a.budgetCents > 0 ? ` · budget ${fmtMoney(a.budgetCents)}/mo` : "";
      meta.textContent = `${a.expenses.length} expense${a.expenses.length === 1 ? "" : "s"} · ${fmtMoney(total)} spent${budgetText} · closed ${archivedDate}`;
      headText.append(title, meta);
      const chevron = document.createElement("span");
      chevron.className = "archive-chevron";
      chevron.innerHTML = Icons.svg("chevron-right", 15);
      head.append(headText, chevron);

      const body = document.createElement("div");
      body.className = "archive-body";
      body.hidden = idx !== 0; // most recent period starts expanded

      // per-category totals (labels only — nothing was allocated to them)
      const byCat = {};
      for (const e of a.expenses) byCat[e.category] = (byCat[e.category] || 0) + e.amountCents;
      const catList = document.createElement("div");
      catList.className = "archive-cats";
      for (const c of Storage.CATEGORIES) {
        const spent = byCat[c.id] || 0;
        if (!spent) continue;
        const line = document.createElement("div");
        line.className = "archive-cat";
        const dot = document.createElement("span");
        dot.className = "cat-dot";
        dot.style.background = catColor(c.id);
        const name = document.createElement("span");
        name.className = "archive-cat-name";
        name.textContent = c.name;
        const amount = document.createElement("span");
        amount.className = "archive-cat-amount";
        amount.textContent = fmtMoney(spent);
        line.append(dot, name, amount);
        catList.appendChild(line);
      }
      if (catList.children.length) {
        body.appendChild(sectionTitle("Spending by category"));
        body.appendChild(catList);
      }

      // savings goals summary
      if (a.goals.length) {
        body.appendChild(sectionTitle("Savings goals"));
        const goalsList = document.createElement("div");
        goalsList.className = "archive-cats";
        for (const g of a.goals) {
          const saved = g.entries.reduce((acc, e) => acc + e.amountCents, 0);
          const line = document.createElement("div");
          line.className = "archive-cat";
          const icon = document.createElement("span");
          icon.className = "archive-goal-icon" + (saved >= g.targetCents ? " done" : "");
          icon.innerHTML = Icons.svg(saved >= g.targetCents ? "trophy" : "target", 13);
          const name = document.createElement("span");
          name.className = "archive-cat-name";
          name.textContent = g.name;
          const amount = document.createElement("span");
          amount.className = "archive-cat-amount";
          amount.textContent = `${fmtMoney(saved)} of ${fmtMoney(g.targetCents)}`;
          line.append(icon, name, amount);
          goalsList.appendChild(line);
        }
        body.appendChild(goalsList);
      }

      // full expense list (read-only, scrolls if long)
      if (a.expenses.length) {
        body.appendChild(sectionTitle("All expenses"));
        const listWrap = document.createElement("div");
        listWrap.className = "archive-expenses";
        const sorted = [...a.expenses].sort((x, y) => y.date.localeCompare(x.date) || y.id.localeCompare(x.id));
        renderExpenseRows(listWrap, sorted, false);
        body.appendChild(listWrap);
      }

      // remove this archive
      const footer = document.createElement("div");
      footer.className = "archive-footer";
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn btn-danger";
      delBtn.innerHTML = `${Icons.svg("trash", 14)}Delete this period`;
      delBtn.addEventListener("click", () => {
        if (!confirm(`Permanently delete the archived period "${periodLabel(a.period)}"? This cannot be undone.`)) return;
        data.archives = data.archives.filter((x) => x.id !== a.id);
        commit();
        renderArchives();
        toast("Archived period deleted");
      });
      footer.appendChild(delBtn);
      body.appendChild(footer);

      head.addEventListener("click", () => {
        body.hidden = !body.hidden;
        head.setAttribute("aria-expanded", String(!body.hidden));
      });

      row.append(head, body);
      container.appendChild(row);
    });

    function sectionTitle(text) {
      const el = document.createElement("div");
      el.className = "archive-section-title";
      el.textContent = text;
      return el;
    }
  }

  /* =============================================================
     Add / edit modal
     ============================================================= */

  function openModal(expense) {
    $("#modal-title").textContent = expense ? "Edit expense" : "Add expense";
    $("#f-id").value = expense ? expense.id : "";
    $("#f-amount").value = expense ? (expense.amountCents / 100).toFixed(2) : "";
    $("#f-category").value = expense ? expense.category : "food";
    $("#f-date").value = expense ? expense.date : todayISO();
    $("#f-note").value = expense ? expense.note : "";
    $("#form-error").hidden = true;
    $("#modal-backdrop").hidden = false;
    $("#f-amount").focus();
  }

  function closeModal() {
    $("#modal-backdrop").hidden = true;
  }

  function submitForm(evt) {
    evt.preventDefault();
    const amount = parseFloat($("#f-amount").value);
    const category = $("#f-category").value;
    const date = $("#f-date").value;

    const error = $("#form-error");
    const fail = (msg) => { error.textContent = msg; error.hidden = false; };

    if (!Number.isFinite(amount) || amount <= 0) return fail("Enter an amount greater than zero.");
    if (amount > 1000000) return fail("That amount looks too large.");
    if (!Storage.CATEGORIES.some((c) => c.id === category)) return fail("Pick a category.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("Pick a valid date.");

    const record = {
      id: $("#f-id").value || Storage.uid(),
      amountCents: Math.round(amount * 100),
      category,
      date,
      note: $("#f-note").value.trim(),
    };

    const existingIdx = data.expenses.findIndex((e) => e.id === record.id);
    if (existingIdx >= 0) {
      data.expenses[existingIdx] = record;
    } else {
      data.expenses.push(record);
    }

    commit();
    closeModal();
    // jump the visible month to the expense so the user sees it appear
    ui.month = record.date.slice(0, 7);
    renderAll();
    toast(existingIdx >= 0 ? "Expense updated" : "Expense added");
  }

  /* =============================================================
     Spatial depth

     Depth is used as a hierarchy, not as an effect: the header
     drops a deeper shadow once content slides under it, and the
     hero tile carries a specular highlight that follows the
     pointer while leaning a couple of degrees toward it. Skipped
     entirely for touch pointers and reduced-motion users.
     ============================================================= */

  function initSpatial() {
    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        document.body.classList.toggle("scrolled", window.scrollY > 4);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const hero = document.querySelector(".bento-hero");
    if (!hero) return;

    let frame = null;
    hero.addEventListener("pointermove", (evt) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        const r = hero.getBoundingClientRect();
        const px = (evt.clientX - r.left) / r.width;
        const py = (evt.clientY - r.top) / r.height;
        hero.classList.add("is-tracking");
        hero.style.setProperty("--mx", (px * 100).toFixed(1) + "%");
        hero.style.setProperty("--my", (py * 100).toFixed(1) + "%");
        hero.style.setProperty("--ry", ((px - 0.5) * 3).toFixed(2) + "deg");
        hero.style.setProperty("--rx", ((0.5 - py) * 2.4).toFixed(2) + "deg");
      });
    });

    hero.addEventListener("pointerleave", () => {
      hero.classList.remove("is-tracking");
      hero.style.removeProperty("--rx");   // back to the resting pose
      hero.style.removeProperty("--ry");
      hero.style.removeProperty("--mx");
      hero.style.removeProperty("--my");
    });
  }

  /* =============================================================
     Wiring
     ============================================================= */

  function switchTab(tab) {
    ui.tab = tab;
    document.querySelectorAll(".tab").forEach((btn) => {
      const active = btn.dataset.tab === tab;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.hidden = panel.id !== `tab-${tab}`;
      panel.classList.toggle("active", panel.id === `tab-${tab}`);
    });
  }

  function changeMonth(delta) {
    ui.month = shiftMonth(ui.month, delta);
    renderAll();
  }

  function populateCategorySelects() {
    for (const sel of [$("#f-category"), $("#category-filter")]) {
      for (const c of Storage.CATEGORIES) {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.name;
        sel.appendChild(opt);
      }
    }
  }

  function init() {
    // "?demo" in the URL shows sample data when there's nothing saved yet —
    // handy for trying the app (nothing is written until you make a change).
    if (new URLSearchParams(location.search).has("demo") && !data.expenses.length) {
      data = Storage.sampleData();
    }

    applyTheme();
    Icons.mount(document);
    populateCategorySelects();
    populateAcademicYearSelects();

    // onboarding + period settings
    $("#ob-start").addEventListener("click", completeOnboarding);
    $("#set-semester").addEventListener("change", updatePeriodFromSettings);
    $("#set-ay").addEventListener("change", updatePeriodFromSettings);

    // tabs (deep-linkable with "?tab=expenses|savings|settings")
    document.querySelectorAll(".tab").forEach((btn) =>
      btn.addEventListener("click", () => switchTab(btn.dataset.tab)));
    const urlTab = new URLSearchParams(location.search).get("tab");
    if (["dashboard", "expenses", "savings", "settings"].includes(urlTab)) switchTab(urlTab);

    // month navigation (dashboard and expenses share ui.month)
    $("#dash-prev-month").addEventListener("click", () => changeMonth(-1));
    $("#dash-next-month").addEventListener("click", () => changeMonth(1));
    $("#exp-prev-month").addEventListener("click", () => changeMonth(-1));
    $("#exp-next-month").addEventListener("click", () => changeMonth(1));

    // header
    $("#theme-toggle").addEventListener("click", toggleTheme);
    $("#add-expense-btn").addEventListener("click", () => openModal(null));

    // the single budget
    $("#budget-input").addEventListener("change", setBudgetFromInput);

    // modal
    $("#expense-form").addEventListener("submit", submitForm);
    $("#modal-cancel").addEventListener("click", closeModal);
    $("#modal-backdrop").addEventListener("click", (e) => {
      if (e.target === $("#modal-backdrop")) closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !$("#modal-backdrop").hidden) closeModal();
    });

    // filters
    $("#search-input").addEventListener("input", (e) => { ui.search = e.target.value.trim(); renderExpenses(); });
    $("#category-filter").addEventListener("change", (e) => { ui.categoryFilter = e.target.value; renderExpenses(); });
    $("#sort-select").addEventListener("change", (e) => { ui.sort = e.target.value; renderExpenses(); });

    // savings
    $("#goal-form").addEventListener("submit", submitGoalForm);

    // settings
    $("#new-period-btn").addEventListener("click", startNewPeriod);

    initSpatial();

    // follow OS theme changes while preference is "auto"
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (data.settings.theme === "auto") { applyTheme(); renderAll(); }
    });

    renderAll();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
