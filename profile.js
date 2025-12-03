const STORAGE_DB_KEY = "usersDB_v1";
const STORAGE_ACTIVE_USER_KEY = "activeUserId_v1";
const STORAGE_LAST_SAVED_KEY = "profileLastSaved_v1";

const el = (id) => document.getElementById(id);

const state = {
  baseUsers: [],
  users: [],
  activeUserId: null,
};

const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());

const safeText = (v) => (v == null || v === "" ? "—" : String(v));
const initials = (name) => {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const a = parts[0]?.[0] || "";
  const b = parts[1]?.[0] || "";
  return (a + b).toUpperCase() || "U";
};

const toast = (msg, mode = "ok") => {
  const t = el("toast");
  t.textContent = msg;
  t.classList.remove("show", "ok", "bad");
  t.classList.add("show", mode === "bad" ? "bad" : "ok");
  window.clearTimeout(toast._timer);
  toast._timer = window.setTimeout(() => t.classList.remove("show"), 2200);
};

const readLocalDB = () => {
  try {
    const raw = localStorage.getItem(STORAGE_DB_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.users)) return null;
    return parsed.users;
  } catch {
    return null;
  }
};

const writeLocalDB = (users) => {
  localStorage.setItem(STORAGE_DB_KEY, JSON.stringify({ users }));
};

const getActiveUserId = () => localStorage.getItem(STORAGE_ACTIVE_USER_KEY);
const setActiveUserId = (id) =>
  localStorage.setItem(STORAGE_ACTIVE_USER_KEY, id);

const setLastSaved = () => {
  const now = new Date();
  localStorage.setItem(STORAGE_LAST_SAVED_KEY, now.toISOString());
  renderLastSaved();
};

const renderLastSaved = () => {
  const raw = localStorage.getItem(STORAGE_LAST_SAVED_KEY);
  if (!raw) {
    el("lastSaved").textContent = "";
    return;
  }
  const d = new Date(raw);
  const stamp = isNaN(d.getTime()) ? "" : d.toLocaleString();
  el("lastSaved").textContent = stamp ? `Last saved: ${stamp}` : "";
};

const mergeUsers = (baseUsers, localUsers) => {
  if (!Array.isArray(localUsers) || localUsers.length === 0)
    return baseUsers.slice();
  const byId = new Map(baseUsers.map((u) => [u.id, u]));
  for (const u of localUsers) {
    if (u && u.id) byId.set(u.id, { ...byId.get(u.id), ...u });
  }
  return Array.from(byId.values());
};

const getUserById = (id) => state.users.find((u) => u.id === id) || null;

const setWhoAmI = (user) => {
  el("whoami").textContent = `Signed in as ${safeText(user.role)} · ${safeText(
    user.name
  )}`;
};

const fillForm = (user) => {
  el("name").value = user.name || "";
  el("email").value = user.email || "";
  el("phone").value = user.phone || "";
  el("gymName").value = user.gymName || "";
  el("gymAddress").value = user.gymAddress || "";
  el("membershipPlan").value = user.membershipPlan || "Standard";
  el("emergencyContact").value = user.emergencyContact || "";
  el("bio").value = user.bio || "";
};

const readForm = () => ({
  name: el("name").value.trim(),
  email: el("email").value.trim(),
  phone: el("phone").value.trim(),
  gymName: el("gymName").value.trim(),
  gymAddress: el("gymAddress").value.trim(),
  membershipPlan: el("membershipPlan").value,
  emergencyContact: el("emergencyContact").value.trim(),
  bio: el("bio").value.trim(),
});

const renderSummary = (user) => {
  el("roleLabel").textContent = safeText(user.role);
  el("summaryName").textContent = safeText(user.name);
  el("summaryEmail").textContent = safeText(user.email);
  el("summaryGym").textContent = user.gymName
    ? `${user.gymName}${user.gymAddress ? " · " + user.gymAddress : ""}`
    : safeText(user.gymAddress);
  el("summaryPlan").textContent = safeText(user.membershipPlan);
  el("summaryPhone").textContent = safeText(user.phone);
  el("summaryEmergency").textContent = safeText(user.emergencyContact);
  el("avatar").textContent = initials(user.name);
  setWhoAmI(user);
};

const setActiveUser = (id) => {
  const user = getUserById(id);
  if (!user) return;
  state.activeUserId = id;
  setActiveUserId(id);
  fillForm(user);
  renderSummary(user);
};

const validate = (data) => {
  if (!data.name) return "Name is required";
  if (!data.email) return "Email is required";
  if (!isValidEmail(data.email)) return "Email is not valid";
  if (!data.gymName) return "Gym name is required";
  return null;
};

const saveProfile = () => {
  const user = getUserById(state.activeUserId);
  if (!user) return;

  const data = readForm();
  const err = validate(data);
  if (err) {
    toast(err, "bad");
    return;
  }

  const updated = { ...user, ...data };
  state.users = state.users.map((u) => (u.id === updated.id ? updated : u));
  writeLocalDB(state.users);
  setLastSaved();
  renderSummary(updated);
  toast("Saved");
};

const resetAll = () => {
  localStorage.removeItem(STORAGE_DB_KEY);
  localStorage.removeItem(STORAGE_LAST_SAVED_KEY);
  state.users = state.baseUsers.slice();
  writeLocalDB(state.users);
  renderLastSaved();
  setActiveUser(state.activeUserId || state.users[0]?.id);
  toast("Reset done");
};

const loadUsers = async () => {
  const res = await fetch("users.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load users.json");
  const data = await res.json();
  if (!data || !Array.isArray(data.users))
    throw new Error("Invalid users.json");
  return data.users;
};

const boot = async () => {
  renderLastSaved();

  try {
    state.baseUsers = await loadUsers();
  } catch {
    state.baseUsers = [];
  }

  const localUsers = readLocalDB();
  state.users = mergeUsers(state.baseUsers, localUsers);

  if (state.users.length === 0) {
    el("whoami").textContent = "No users found";
    return;
  }

  const savedActive = getActiveUserId();
  const initialId = getUserById(savedActive) ? savedActive : state.users[0].id;

  const btn = (id, userId) => {
    el(id).addEventListener("click", () => setActiveUser(userId));
  };

  btn("useAdmin", "admin-1");
  btn("useTrainer", "trainer-1");
  btn("useClient", "client-1");

  el("profileForm").addEventListener("submit", (e) => {
    e.preventDefault();
    saveProfile();
  });

  el("resetBtn").addEventListener("click", resetAll);

  setActiveUser(initialId);
};

boot();
