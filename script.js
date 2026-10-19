/* =====================================================
   To Do List Harian
   Profil (foto, nama, jabatan) diedit lewat tombol "Edit profil".
   ===================================================== */
const STORAGE_KEY = "todo-harian-v1";
const PROFILE_KEY = "todo-profil-v1";
const STRIKE_DELAY = 450; // ms jeda coretan sebelum tugas pindah ke Done
const DEFAULT_PROFILE = { nama: "Nama Kamu", jabatan: "Video Editor", foto: null };

/* ---------- Elemen ---------- */
const $ = (id) => document.getElementById(id);
const form = $("taskForm");
const taskText = $("taskText");
const formError = $("formError");
const todoList = $("todoList");
const doneList = $("doneList");
const todoEmpty = $("todoEmpty");
const doneEmpty = $("doneEmpty");
const filtersBox = $("filters");

const dateBtn = $("dateBtn");
const calendar = $("calendar");
const calDays = $("calDays");
const timeSelect = $("timeSelect");

const dialog = $("profileDialog");
const profileForm = $("profileForm");
const inputNama = $("inputNama");
const inputJabatan = $("inputJabatan");
const photoInput = $("photoInput");
const profileError = $("profileError");

/* ---------- Penyimpanan ---------- */
function loadJSON(key, fallback) {
  try {
    const data = JSON.parse(localStorage.getItem(key));
    return data ?? fallback;
  } catch (e) {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("Data tidak bisa disimpan:", e);
  }
}

/* ---------- State ---------- */
let tasks = loadJSON(STORAGE_KEY, []);
if (!Array.isArray(tasks)) tasks = [];
let profile = { ...DEFAULT_PROFILE, ...loadJSON(PROFILE_KEY, {}) };
let draftFoto = null;
let filter = "all";   // "all" | "overdue" | "d:YYYY-MM-DD"

/* ---------- Format tanggal (Bahasa Indonesia) ---------- */
const fmtShortDate = new Intl.DateTimeFormat("id-ID", {
  weekday: "short", day: "numeric", month: "short", year: "numeric"
});
const fmtLongDate = new Intl.DateTimeFormat("id-ID", {
  weekday: "long", day: "numeric", month: "long", year: "numeric"
});
const fmtDayMonth = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" });
const fmtMonthYear = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" });
const fmtTime = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit", minute: "2-digit", hour12: false
});

const pad = (n) => String(n).padStart(2, "0");
const toDayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayKey = (iso) => toDayKey(new Date(iso));
const formatTime = (d) => fmtTime.format(d).replace(":", ".");

function relativeDay(key) {
  const offsets = { "-1": "Kemarin", "0": "Hari ini", "1": "Besok" };
  for (const [off, label] of Object.entries(offsets)) {
    const d = new Date();
    d.setDate(d.getDate() + Number(off));
    if (toDayKey(d) === key) return label;
  }
  return null;
}

function dayLabel(key) {
  return relativeDay(key) || fmtShortDate.format(new Date(`${key}T00:00:00`));
}

/* ---------- Helper DOM ---------- */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/* =====================================================
   PROFIL
   ===================================================== */
function initials(nama) {
  return nama.trim().split(/\s+/).slice(0, 2)
    .map((w) => w[0]).join("").toUpperCase() || "?";
}

function setAvatar(node, nama, foto) {
  node.replaceChildren();
  if (foto) {
    const img = document.createElement("img");
    img.src = foto;
    img.alt = "";
    node.append(img);
  } else {
    node.textContent = initials(nama);
  }
}

function renderProfile() {
  $("profileName").textContent = profile.nama;
  $("profileRole").textContent = profile.jabatan || "Tambahkan jabatan";
  setAvatar($("avatar"), profile.nama, profile.foto);
}

// Potong jadi persegi dan kecilkan supaya hemat tempat di localStorage
function resizeImage(file, size = 240) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      canvas.getContext("2d").drawImage(
        img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size
      );
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Gambar tidak bisa dibaca"));
    };
    img.src = url;
  });
}

function refreshDialogAvatar() {
  setAvatar($("avatarLarge"), inputNama.value, draftFoto);
  $("removePhoto").hidden = !draftFoto;
}

function openProfileDialog() {
  inputNama.value = profile.nama;
  inputJabatan.value = profile.jabatan;
  draftFoto = profile.foto;
  profileError.hidden = true;
  refreshDialogAvatar();
  dialog.showModal();
  inputNama.focus();
}

$("profileBtn").addEventListener("click", openProfileDialog);
$("cancelProfile").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
inputNama.addEventListener("input", refreshDialogAvatar);

$("changePhoto").addEventListener("click", () => photoInput.click());
$("removePhoto").addEventListener("click", () => {
  draftFoto = null;
  refreshDialogAvatar();
});

photoInput.addEventListener("change", async () => {
  const file = photoInput.files[0];
  photoInput.value = "";
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    profileError.textContent = "File harus berupa gambar (JPG, PNG, atau WebP).";
    profileError.hidden = false;
    return;
  }
  try {
    draftFoto = await resizeImage(file);
    profileError.hidden = true;
    refreshDialogAvatar();
  } catch (err) {
    profileError.textContent = "Gambar tidak bisa dibaca. Coba pilih file lain.";
    profileError.hidden = false;
  }
});

profileForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const nama = inputNama.value.trim();
  if (!nama) {
    profileError.textContent = "Nama belum diisi.";
    profileError.hidden = false;
    inputNama.focus();
    return;
  }
  profile = { nama, jabatan: inputJabatan.value.trim(), foto: draftFoto };
  saveJSON(PROFILE_KEY, profile);
  renderProfile();
  dialog.close();
});

/* =====================================================
   TUGAS
   ===================================================== */
// Terlambat = belum selesai dan deadline sudah lewat
function isOverdue(task) {
  return !task.done && !!task.deadline && new Date(task.deadline) < new Date();
}

// Tanggal acuan tugas: tanggal deadline (atau tanggal dibuat untuk data lama)
const taskDay = (task) => dayKey(task.deadline || task.createdAt);
const deadlineMs = (task) => (task.deadline ? Date.parse(task.deadline) : Infinity);

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

function visibleTodos(allTodo) {
  return allTodo
    .filter((t) => {
      if (filter === "overdue") return isOverdue(t);
      if (filter.startsWith("d:")) return taskDay(t) === filter.slice(2);
      return true;
    })
    .sort((a, b) =>
      (isOverdue(b) - isOverdue(a)) ||
      (deadlineMs(a) - deadlineMs(b)) ||
      (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
    );
}

function buildTask(task) {
  const li = el("li", "task");
  li.dataset.id = task.id;
  if (task.done) li.classList.add("is-done");
  if (isOverdue(task)) li.classList.add("is-overdue");

  // Checkbox
  const label = el("label", "check");
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = task.done;
  input.setAttribute("aria-label", task.done ? "Kembalikan ke To Do" : "Tandai selesai");
  input.addEventListener("change", () => toggleTask(task.id, input.checked, li));
  label.append(input, el("span", "box"));

  // Isi
  const body = el("div", "body");
  body.append(el("p", "text", task.text));

  const meta = el("div", "meta");
  const priorityName = { low: "Low", medium: "Medium", high: "High" }[task.priority];
  meta.append(el("span", `badge badge-${task.priority}`, priorityName));

  if (task.deadline) {
    const due = new Date(task.deadline);
    meta.append(el("span", "", `Deadline ${fmtShortDate.format(due)}, ${formatTime(due)}`));
  }

  const created = new Date(task.createdAt);
  meta.append(el("span", "", `Dibuat ${fmtShortDate.format(created)}, ${formatTime(created)}`));

  if (isOverdue(task)) meta.append(el("span", "badge badge-late", "Terlambat"));
  if (task.done && task.doneAt) {
    const d = new Date(task.doneAt);
    meta.append(el("span", "", `Selesai ${fmtShortDate.format(d)}, ${formatTime(d)}`));
  }
  body.append(meta);

  // Tombol delete
  const del = el("button", "del", "Delete");
  del.type = "button";
  del.setAttribute("aria-label", `Hapus tugas: ${task.text}`);
  del.addEventListener("click", () => deleteTask(task.id));

  li.append(label, body, del);
  return li;
}

function makeChip(label, value, count) {
  const chip = el("button", "chip" + (value === "overdue" ? " chip-late" : ""), label);
  chip.type = "button";
  chip.setAttribute("aria-pressed", String(filter === value));
  if (count !== undefined) chip.append(el("span", "count", count));
  chip.addEventListener("click", () => {
    filter = value;
    render();
  });
  return chip;
}

function render() {
  const allTodo = tasks.filter((t) => !t.done);
  const dones = tasks.filter((t) => t.done)
    .sort((a, b) => new Date(b.doneAt) - new Date(a.doneAt));

  // Chip tanggal diambil dari tanggal deadline tugas yang masih di To Do
  const days = [...new Set(allTodo.map(taskDay))].sort().slice(0, 10);
  if (filter.startsWith("d:") && !days.includes(filter.slice(2))) filter = "all";

  const lateCount = allTodo.filter(isOverdue).length;
  const chips = [makeChip("Semua", "all"), makeChip("Terlambat", "overdue", lateCount)];
  if (days.length) {
    chips.push(el("span", "sep"));
    days.forEach((d) => chips.push(makeChip(dayLabel(d), `d:${d}`)));
  }
  filtersBox.replaceChildren(...chips);

  const todos = visibleTodos(allTodo);
  todoList.replaceChildren(...todos.map(buildTask));
  doneList.replaceChildren(...dones.map(buildTask));

  $("todoCount").textContent = allTodo.length;
  $("doneCount").textContent = dones.length;

  todoEmpty.textContent = allTodo.length && !todos.length
    ? "Tidak ada tugas yang cocok dengan filter ini."
    : "Belum ada tugas. Tulis tugas pertamamu di atas.";
  todoEmpty.hidden = todos.length > 0;
  doneEmpty.hidden = dones.length > 0;
}

/* ---------- Aksi ---------- */
function addTask(e) {
  e.preventDefault();
  const text = taskText.value.trim();

  if (!text) {
    formError.textContent = "Tugas belum ditulis. Isi dulu sebelum submit.";
    formError.hidden = false;
    taskText.focus();
    return;
  }
  formError.hidden = true;

  tasks.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    text,
    priority: form.querySelector('input[name="priority"]:checked').value,
    createdAt: new Date().toISOString(),   // hari & tanggal saat submit
    deadline: new Date(`${selectedDay}T${timeSelect.value}:00`).toISOString(),
    done: false,
    doneAt: null
  });

  saveJSON(STORAGE_KEY, tasks);
  taskText.value = "";
  render();
  taskText.focus();
}

function toggleTask(id, checked, li) {
  const apply = () => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    task.done = checked;
    task.doneAt = checked ? new Date().toISOString() : null;
    saveJSON(STORAGE_KEY, tasks);
    render();
  };

  if (checked) {
    li.classList.add("striking");   // tampilkan coretan dulu
    setTimeout(apply, STRIKE_DELAY);
  } else {
    apply();
  }
}

function deleteTask(id) {
  tasks = tasks.filter((t) => t.id !== id);
  saveJSON(STORAGE_KEY, tasks);
  render();
}

function deleteAll() {
  if (tasks.length === 0) return;
  if (confirm("Hapus semua to do list? Tindakan ini tidak bisa dibatalkan.")) {
    tasks = [];
    saveJSON(STORAGE_KEY, tasks);
    render();
  }
}

/* =====================================================
   TANGGAL & JAM DEADLINE
   ===================================================== */
let selectedDay = toDayKey(new Date());
let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth();

function updateDateLabel() {
  const d = new Date(`${selectedDay}T00:00:00`);
  const rel = relativeDay(selectedDay);
  $("dateLabel").textContent = rel
    ? `${rel} (${fmtDayMonth.format(d)})`
    : fmtShortDate.format(d);
}

function renderCalendar() {
  $("calTitle").textContent = fmtMonthYear.format(new Date(viewYear, viewMonth, 1));
  const offset = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;   // Senin = kolom pertama
  const total = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayKey = toDayKey(new Date());
  const cells = [];

  for (let i = 0; i < offset; i++) cells.push(el("span"));

  for (let d = 1; d <= total; d++) {
    const key = `${viewYear}-${pad(viewMonth + 1)}-${pad(d)}`;
    const btn = el("button", "cal-day", d);
    btn.type = "button";
    btn.setAttribute("aria-label", fmtLongDate.format(new Date(`${key}T00:00:00`)));
    btn.setAttribute("aria-pressed", String(key === selectedDay));
    if (key === todayKey) btn.classList.add("is-today");
    if (key === selectedDay) btn.classList.add("is-selected");
    btn.addEventListener("click", () => selectDay(key));
    cells.push(btn);
  }
  calDays.replaceChildren(...cells);
}

function openCalendar() {
  const d = new Date(`${selectedDay}T00:00:00`);
  viewYear = d.getFullYear();
  viewMonth = d.getMonth();
  renderCalendar();
  calendar.hidden = false;
  dateBtn.setAttribute("aria-expanded", "true");
  const target = calDays.querySelector(".is-selected");
  if (target) target.focus();
}

function closeCalendar(returnFocus = false) {
  calendar.hidden = true;
  dateBtn.setAttribute("aria-expanded", "false");
  if (returnFocus) dateBtn.focus();
}

function selectDay(key) {
  selectedDay = key;
  updateDateLabel();
  closeCalendar(true);
}

function shiftMonth(step) {
  viewMonth += step;
  if (viewMonth < 0) { viewMonth = 11; viewYear--; }
  if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  renderCalendar();
}

function initWhen() {
  // Pilihan jam tiap 30 menit
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const opt = el("option", "", `${pad(h)}.${pad(m)}`);
      opt.value = `${pad(h)}:${pad(m)}`;
      timeSelect.append(opt);
    }
  }
  timeSelect.value = "17:00";
  updateDateLabel();

  dateBtn.addEventListener("click", () => (calendar.hidden ? openCalendar() : closeCalendar()));
  $("calPrev").addEventListener("click", () => shiftMonth(-1));
  $("calNext").addEventListener("click", () => shiftMonth(1));
  calendar.querySelectorAll("[data-quick]").forEach((b) => {
    b.addEventListener("click", () => {
      const d = new Date();
      d.setDate(d.getDate() + Number(b.dataset.quick));
      selectDay(toDayKey(d));
    });
  });

  document.addEventListener("click", (e) => {
    if (!calendar.hidden && !e.target.closest(".date-wrap")) closeCalendar();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !calendar.hidden) closeCalendar(true);
  });
}

/* ---------- Event & mulai ---------- */
form.addEventListener("submit", addTask);
$("deleteAll").addEventListener("click", deleteAll);

renderProfile();
initWhen();
render();

setInterval(render, 60000);   // perbarui status "Terlambat"
