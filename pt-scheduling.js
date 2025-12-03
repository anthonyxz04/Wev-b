const STORAGE_ACTIVE_USER_KEY = "activeUserId_v1";
const STORAGE_USERS_DB_KEY = "usersDB_v1";
const STORAGE_SCHED_DB_KEY = "scheduleDB_v1";

const el = (id) => document.getElementById(id);

const state = {
  users: [],
  activeUserId: null,
  data: null,
  bookings: [],
  modal: {
    open: false,
    payload: null,
  },
};

const toast = (id, msg, mode = "ok") => {
  const t = el(id);
  t.textContent = msg;
  t.classList.remove("show", "ok", "bad");
  t.classList.add("show", mode === "bad" ? "bad" : "ok");
  window.clearTimeout(t._timer);
  t._timer = window.setTimeout(() => t.classList.remove("show"), 2200);
};

const readJSON = async (file) => {
  const res = await fetch(file, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load " + file);
  return res.json();
};

const readUsers = async () => {
  const base = await readJSON("users.json");
  const baseUsers = Array.isArray(base.users) ? base.users : [];
  let localUsers = null;
  try {
    const raw = localStorage.getItem(STORAGE_USERS_DB_KEY);
    localUsers = raw ? JSON.parse(raw)?.users : null;
  } catch {
    localUsers = null;
  }
  if (!Array.isArray(localUsers) || localUsers.length === 0)
    return baseUsers.slice();
  const byId = new Map(baseUsers.map((u) => [u.id, u]));
  for (const u of localUsers)
    if (u?.id) byId.set(u.id, { ...byId.get(u.id), ...u });
  return Array.from(byId.values());
};

const getActiveUserId = () => localStorage.getItem(STORAGE_ACTIVE_USER_KEY);
const setActiveUserId = (id) =>
  localStorage.setItem(STORAGE_ACTIVE_USER_KEY, id);

const writeScheduleDB = (bookings) => {
  localStorage.setItem(STORAGE_SCHED_DB_KEY, JSON.stringify({ bookings }));
};

const readScheduleDB = () => {
  try {
    const raw = localStorage.getItem(STORAGE_SCHED_DB_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.bookings)) return null;
    return parsed.bookings;
  } catch {
    return null;
  }
};

const uniq = (arr) => Array.from(new Set(arr));
const safe = (v) => (v == null || v === "" ? "—" : String(v));

const findUser = (id) => state.users.find((u) => u.id === id) || null;
const findGym = (id) => state.data.gyms.find((g) => g.id === id) || null;
const findTrainer = (id) =>
  state.data.trainers.find((t) => t.id === id) || null;

const isTrainerUser = (u) => String(u?.role || "").toLowerCase() === "trainer";
const isAdminUser = (u) => String(u?.role || "").toLowerCase() === "admin";
const isClientUser = (u) => String(u?.role || "").toLowerCase() === "client";

const whoami = () => {
  const u = findUser(state.activeUserId);
  el("whoami").textContent = u
    ? `Signed in as ${safe(u.role)} · ${safe(u.name)}`
    : "Signed out";
};

const option = (value, label) => {
  const o = document.createElement("option");
  o.value = value;
  o.textContent = label;
  return o;
};

const setSelectOptions = (selectEl, items, getValue, getLabel) => {
  selectEl.innerHTML = "";
  for (const it of items)
    selectEl.appendChild(option(getValue(it), getLabel(it)));
};

const bookingKey = (b) =>
  `${b.gymId}|${b.trainerId}|${b.day}|${b.time}|${b.type}`;

const isSlotBooked = (slot) =>
  state.bookings.some((b) => bookingKey(b) === bookingKey(slot));
const getSlotBooking = (slot) =>
  state.bookings.find((b) => bookingKey(b) === bookingKey(slot)) || null;

const canBook = () => {
  const u = findUser(state.activeUserId);
  return isAdminUser(u) || isClientUser(u);
};

const canCancel = (slot) => {
  const u = findUser(state.activeUserId);
  if (!u) return false;
  if (isAdminUser(u)) return true;
  const b = getSlotBooking(slot);
  if (!b) return false;
  if (isClientUser(u)) return b.clientId === u.id;
  return false;
};

const buildTrainerListForGym = (gymId) => {
  const trainers = state.data.trainers.filter((t) => t.gymIds.includes(gymId));
  return trainers;
};

const currentFilters = () => ({
  gymId: el("gymSelect").value,
  trainerId: el("trainerSelect").value,
  day: el("daySelect").value,
  type: el("typeSelect").value,
  q: el("searchInput").value.trim().toLowerCase(),
});

const slotMatchesSearch = (slot, q) => {
  if (!q) return true;
  const g = findGym(slot.gymId);
  const t = findTrainer(slot.trainerId);
  const hay = [g?.name, g?.address, t?.name, slot.day, slot.time, slot.type]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
};

const renderSlots = () => {
  const grid = el("slotsGrid");
  grid.innerHTML = "";

  const f = currentFilters();
  const gym = findGym(f.gymId);
  const trainer = findTrainer(f.trainerId);

  el("slotsMeta").textContent = `${safe(gym?.name)} · ${safe(
    trainer?.name
  )} · ${safe(f.day)} · ${safe(f.type)}`;

  const u = findUser(state.activeUserId);
  const hint = !u
    ? ""
    : canBook()
    ? "Click a free slot to book."
    : "Trainers can view slots, but cannot book as clients.";
  el("scheduleHint").textContent = hint;

  const slots = state.data.timeSlots
    .map((time) => ({
      gymId: f.gymId,
      trainerId: f.trainerId,
      day: f.day,
      time,
      type: f.type,
    }))
    .filter((s) => slotMatchesSearch(s, f.q));

  if (slots.length === 0) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "No slots match your search.";
    grid.appendChild(empty);
    return;
  }

  for (const slot of slots) {
    const b = getSlotBooking(slot);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "slot-card";

    const booked = Boolean(b);
    const mine = booked && b.clientId === state.activeUserId;

    if (booked) card.classList.add("booked");
    else card.classList.add("free");

    if (mine) card.classList.add("mine");

    const top = document.createElement("div");
    top.className = "slot-time";
    top.textContent = slot.time;

    const sub = document.createElement("div");
    sub.className = "slot-sub";
    sub.textContent = booked ? (mine ? "My booking" : "Booked") : "Free";

    const meta = document.createElement("div");
    meta.className = "slot-meta";
    meta.textContent = booked
      ? `Client: ${safe(findUser(b.clientId)?.name)}`
      : "Tap to book";

    if (!canBook() && !booked) {
      meta.textContent = "View only";
      card.disabled = true;
      card.classList.add("disabled");
    }

    card.appendChild(top);
    card.appendChild(sub);
    card.appendChild(meta);

    card.addEventListener("click", () => openModal(slot));
    grid.appendChild(card);
  }
};

const renderBookings = () => {
  const wrap = el("bookingsList");
  wrap.innerHTML = "";

  const u = findUser(state.activeUserId);
  const mine = state.bookings
    .filter((b) => (isAdminUser(u) ? true : b.clientId === state.activeUserId))
    .slice()
    .sort((a, b) => `${a.day} ${a.time}`.localeCompare(`${b.day} ${b.time}`));

  if (mine.length === 0) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = isAdminUser(u)
      ? "No bookings yet."
      : "You have no bookings.";
    wrap.appendChild(empty);
    return;
  }

  for (const b of mine) {
    const g = findGym(b.gymId);
    const t = findTrainer(b.trainerId);
    const c = findUser(b.clientId);

    const row = document.createElement("div");
    row.className = "booking-row";

    const a = document.createElement("div");
    a.className = "booking-a";
    a.textContent = `${b.day} · ${b.time}`;

    const d = document.createElement("div");
    d.className = "booking-d";
    d.textContent = `${safe(g?.name)} · ${safe(t?.name)} · ${b.type}${
      c ? " · " + safe(c.name) : ""
    }`;

    row.appendChild(a);
    row.appendChild(d);
    wrap.appendChild(row);
  }
};

const openModal = (slot) => {
  state.modal.open = true;
  state.modal.payload = slot;

  const gym = findGym(slot.gymId);
  const trainer = findTrainer(slot.trainerId);

  el("cGym").textContent = safe(gym?.name);
  el("cTrainer").textContent = safe(trainer?.name);
  el("cDay").textContent = safe(slot.day);
  el("cTime").textContent = safe(slot.time);
  el("cType").textContent = safe(slot.type);

  const b = getSlotBooking(slot);
  const clientName = b
    ? safe(findUser(b.clientId)?.name)
    : safe(findUser(state.activeUserId)?.name);
  el("cClient").textContent = clientName;

  el("modalSub").textContent = b
    ? "This slot is currently booked."
    : "This slot is free.";
  el("cancelBooking").style.display =
    canCancel(slot) && b ? "inline-flex" : "none";
  el("confirmBooking").style.display = !b && canBook() ? "inline-flex" : "none";

  el("modalBackdrop").classList.add("show");
  el("modalBackdrop").setAttribute("aria-hidden", "false");
};

const closeModal = () => {
  state.modal.open = false;
  state.modal.payload = null;
  el("modalBackdrop").classList.remove("show");
  el("modalBackdrop").setAttribute("aria-hidden", "true");
};

const confirmBooking = () => {
  const slot = state.modal.payload;
  if (!slot) return;

  if (isSlotBooked(slot)) {
    toast("modalToast", "Already booked", "bad");
    return;
  }

  if (!canBook()) {
    toast("modalToast", "You cannot book slots with this role", "bad");
    return;
  }

  const u = findUser(state.activeUserId);
  const id = "b-" + Math.random().toString(16).slice(2, 10);

  const booking = {
    id,
    gymId: slot.gymId,
    trainerId: slot.trainerId,
    day: slot.day,
    time: slot.time,
    type: slot.type,
    clientId: u.id,
  };

  state.bookings.push(booking);
  writeScheduleDB(state.bookings);

  toast("modalToast", "Booked", "ok");
  toast("toast", "Booked", "ok");
  renderSlots();
  renderBookings();
  window.setTimeout(closeModal, 500);
};

const cancelBooking = () => {
  const slot = state.modal.payload;
  if (!slot) return;

  const b = getSlotBooking(slot);
  if (!b) {
    toast("modalToast", "Slot is free", "bad");
    return;
  }

  if (!canCancel(slot)) {
    toast("modalToast", "You cannot cancel this booking", "bad");
    return;
  }

  state.bookings = state.bookings.filter((x) => x.id !== b.id);
  writeScheduleDB(state.bookings);

  toast("modalToast", "Canceled", "ok");
  toast("toast", "Canceled", "ok");
  renderSlots();
  renderBookings();
  window.setTimeout(closeModal, 500);
};

const clearMyBookings = () => {
  const u = findUser(state.activeUserId);
  if (!u) return;

  if (isAdminUser(u)) {
    state.bookings = [];
  } else {
    state.bookings = state.bookings.filter((b) => b.clientId !== u.id);
  }

  writeScheduleDB(state.bookings);
  toast("toast", "Cleared", "ok");
  renderSlots();
  renderBookings();
};

const syncTrainerSelect = () => {
  const gymId = el("gymSelect").value;
  const trainers = buildTrainerListForGym(gymId);
  setSelectOptions(
    el("trainerSelect"),
    trainers,
    (t) => t.id,
    (t) => t.name
  );

  const selected = el("trainerSelect").value;
  const stillValid = trainers.some((t) => t.id === selected);
  if (!stillValid && trainers[0]) el("trainerSelect").value = trainers[0].id;
};

const applyRoleDefaults = () => {
  const u = findUser(state.activeUserId);
  if (!u) return;

  if (isTrainerUser(u)) {
    const trainerMatch =
      state.data.trainers.find((t) => t.name === u.name) ||
      state.data.trainers[0];
    if (trainerMatch) {
      const gymId = trainerMatch.gymIds[0];
      el("gymSelect").value = gymId;
      syncTrainerSelect();
      el("trainerSelect").value = trainerMatch.id;
    }
  }
};

const bindUI = () => {
  el("gymSelect").addEventListener("change", () => {
    syncTrainerSelect();
    renderSlots();
  });

  el("trainerSelect").addEventListener("change", renderSlots);
  el("daySelect").addEventListener("change", renderSlots);
  el("typeSelect").addEventListener("change", renderSlots);

  el("searchInput").addEventListener("input", () => {
    window.clearTimeout(bindUI._t);
    bindUI._t = window.setTimeout(renderSlots, 120);
  });

  el("closeModal").addEventListener("click", closeModal);
  el("modalBackdrop").addEventListener("click", (e) => {
    if (e.target === el("modalBackdrop")) closeModal();
  });

  el("confirmBooking").addEventListener("click", confirmBooking);
  el("cancelBooking").addEventListener("click", cancelBooking);
  el("clearMine").addEventListener("click", clearMyBookings);

  el("useAdmin").addEventListener("click", () => setUser("admin-1"));
  el("useTrainer").addEventListener("click", () => setUser("trainer-1"));
  el("useClient").addEventListener("click", () => setUser("client-1"));
};

const setUser = (id) => {
  const u = findUser(id);
  if (!u) return;
  state.activeUserId = id;
  setActiveUserId(id);
  whoami();
  applyRoleDefaults();
  renderSlots();
  renderBookings();
};

const boot = async () => {
  state.users = await readUsers();

  const data = await readJSON("pt-scheduling.json");
  state.data = data;

  setSelectOptions(
    el("gymSelect"),
    data.gyms,
    (g) => g.id,
    (g) => `${g.name} · ${g.address}`
  );

  setSelectOptions(
    el("daySelect"),
    data.days,
    (d) => d,
    (d) => d
  );

  syncTrainerSelect();

  const localBookings = readScheduleDB();
  state.bookings =
    Array.isArray(localBookings) && localBookings.length
      ? localBookings
      : Array.isArray(data.seededBookings)
      ? data.seededBookings.slice()
      : [];

  writeScheduleDB(state.bookings);

  bindUI();

  const saved = getActiveUserId();
  const initial = findUser(saved)?.id || "client-1";
  setUser(initial);
};

boot();
