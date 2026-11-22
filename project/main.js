/* =========================================
   FLOWUP - MAIN JAVASCRIPT
   ========================================= */

const $ = id => document.getElementById(id);
const KEY = "flowupData";

const defaults = {
  xp: 0,
  tasks: [],
  goals: [],
  habits: [],
  notes: [],
  vision: [],
  future: [],
  focusSessions: 0,
  challenge: null,
  reflections: [],
  smartLists: [],
  activity: {},
  theme: "light",
  unlockedThemes: ["Lavender"],
  profile: { name: "", color: "#8585dc" }
};

let data = {};
try {
  data = { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
} catch {
  data = { ...defaults };
}

Object.keys(defaults).forEach(key => {
  if (data[key] === undefined || data[key] === null) {
    data[key] = structuredClone(defaults[key]);
  }
});

if (!Array.isArray(data.smartLists)) {
  data.smartLists = Object.entries(data.smartLists || {}).map(([name, items]) => ({
    name,
    items: Array.isArray(items) ? items : []
  }));
}

if (!Array.isArray(data.unlockedThemes)) data.unlockedThemes = ["Lavender"];
if (!data.profile) data.profile = { name: "", color: "#8585dc" };

let currentFilter = "all";
let timerSeconds = 25 * 60;
let timerInterval = null;
let activeAudio = null;
let audioContext = null;
let activeAudioNodes = [];
let customAudioURL = null;
let toastTimeout = null;

function save() {
  localStorage.setItem(KEY, JSON.stringify(data));
}

function toast(message) {
  const el = $("toast");
  if (!el) return;

  el.textContent = message;
  el.classList.add("show");

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.classList.remove("show"), 2500);
}

function today() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function markActivity() {
  const d = today();
  data.activity[d] = (data.activity[d] || 0) + 1;
  save();
}

function addXP(amount) {
  data.xp = Math.max(0, (Number(data.xp) || 0) + amount);
  save();
  renderHeader();
  renderAchievements();
  renderProfile();
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

/* NAVIGATION */

function openPage(id) {
  document.querySelectorAll(".page").forEach(page => {
    page.classList.toggle("active", page.id === id);
  });

  document.querySelectorAll(".nav-link[data-page]").forEach(button => {
    button.classList.toggle("active", button.dataset.page === id);
  });

  const active = document.querySelector(`.nav-link[data-page="${id}"]`);
  if ($("page-heading")) {
    $("page-heading").textContent = active
      ? active.textContent.trim().replace("NEW", "").trim()
      : "Dashboard";
  }

  $("sidebar")?.classList.remove("open");

  if (id === "dashboard") renderDashboard();
  if (id === "tasks") renderTasks();
  if (id === "goals") renderGoals();
  if (id === "sounds") updateTimer();
  if (id === "challenge") renderChallenge();
  if (id === "reflection") renderReflections();
  if (id === "smartlists") renderSmartLists();
  if (id === "achievements") renderAchievements();
  if (id === "profile") renderProfile();

  window.scrollTo({ top: 0, behavior: "smooth" });
}
window.openPage = openPage;

function renderHeader() {
  const xp = Number(data.xp) || 0;

  if ($("top-xp")) $("top-xp").textContent = xp + " XP";
  if ($("stat-xp")) $("stat-xp").textContent = xp;

  const initial = (data.profile.name || "F").trim().charAt(0).toUpperCase();

  if ($("top-avatar")) {
    $("top-avatar").textContent = initial;
    $("top-avatar").style.background = data.profile.color || "var(--primary)";
  }

  if ($("profile-avatar")) {
    $("profile-avatar").textContent = initial;
    $("profile-avatar").style.background = data.profile.color || "var(--primary)";
  }

  if ($("current-date")) {
    $("current-date").textContent = new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  }

  if ($("welcome-message") && data.profile.name) {
    $("welcome-message").textContent =
      `Welcome back, ${data.profile.name}. Make today a good one!`;
  }
}

/* TASKS */

function renderTasks() {
  const list = $("task-list");
  if (!list) return;

  const filtered = data.tasks.filter(task => {
    if (currentFilter === "active") return !task.done;
    if (currentFilter === "completed") return !!task.done;
    return true;
  });

  list.innerHTML = "";

  if (!filtered.length) {
    list.innerHTML = `
      <div class="empty-message">
        <i class="fa-regular fa-circle-check"></i>
        <p>${currentFilter === "completed"
          ? "No completed tasks yet. Your progress will appear here."
          : currentFilter === "active"
            ? "You have no tasks waiting. Enjoy the clear space!"
            : "Your task list is empty. Add your first task above."}</p>
      </div>`;
  }

  filtered.forEach(task => {
    const row = document.createElement("div");
    row.className = "task-item" + (task.done ? " completed" : "");

    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "task-check";
    check.checked = !!task.done;
    check.setAttribute("aria-label", "Complete task");

    const main = document.createElement("div");
    main.className = "task-main";

    const title = document.createElement("strong");
    title.textContent = task.text || task.title || "Untitled task";

    const meta = document.createElement("p");
    const dateText = task.date ? task.date : "No date";
    meta.textContent = `${dateText} · ${task.priority || "Normal"} priority`;

    main.append(title, meta);

    const priority = document.createElement("span");
    priority.className = "priority " + (task.priority || "Normal");
    priority.textContent = task.priority || "Normal";

    const date = document.createElement("small");
    date.className = "muted";
    date.textContent = task.date || "";

    const del = document.createElement("button");
    del.className = "delete-btn";
    del.innerHTML = '<i class="fa-solid fa-trash"></i>';
    del.title = "Delete task";

    check.addEventListener("change", () => {
      task.done = check.checked;

      if (task.done) {
        addXP(10);
        markActivity();
        toast("+10 XP · Task completed!");
      }

      save();
      renderTasks();
      renderDashboard();
    });

    del.addEventListener("click", () => {
      data.tasks = data.tasks.filter(item => item.id !== task.id);
      save();
      renderTasks();
      renderDashboard();
      toast("Task removed.");
    });

    row.append(check, main, priority, date, del);
    list.append(row);
  });

  const total = data.tasks.length;
  const completed = data.tasks.filter(task => task.done).length;

  if ($("task-total")) $("task-total").textContent = total;
  if ($("task-completed")) $("task-completed").textContent = completed;
  if ($("task-remaining")) $("task-remaining").textContent = total - completed;
}

$("task-form")?.addEventListener("submit", event => {
  event.preventDefault();

  const text = $("task-input").value.trim();
  if (!text) return;

  data.tasks.unshift({
    id: Date.now(),
    text,
    priority: $("task-priority").value,
    date: $("task-date").value,
    done: false
  });

  $("task-form").reset();
  save();
  renderTasks();
  renderDashboard();
  toast("Your new task has been added!");
});

document.querySelectorAll(".filter-btn").forEach(button => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;

    document.querySelectorAll(".filter-btn").forEach(item => {
      item.classList.toggle("active", item === button);
    });

    renderTasks();
  });
});

/* DAILY GOALS */

function renderGoals() {
  const list = $("goal-list");
  if (!list) return;

  list.innerHTML = "";

  if (!data.goals.length) {
    list.innerHTML = `
      <div class="empty-message">
        <i class="fa-solid fa-bullseye"></i>
        <p>Your goals will appear here. Choose one of the suggestions or add your own.</p>
      </div>`;
  }

  data.goals.forEach(goal => {
    const row = document.createElement("div");
    row.className = "goal-item" + (goal.done ? " completed" : "");

    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = !!goal.done;
    check.setAttribute("aria-label", "Complete goal");

    const text = document.createElement("span");
    text.textContent = goal.text;

    const del = document.createElement("button");
    del.className = "icon-btn";
    del.innerHTML = '<i class="fa-solid fa-trash"></i>';
    del.title = "Delete goal";

    check.addEventListener("change", () => {
      goal.done = check.checked;

      if (goal.done) {
        addXP(5);
        markActivity();
        toast("+5 XP · Goal completed!");
      }

      save();
      renderGoals();
      renderDashboard();
    });

    del.addEventListener("click", () => {
      data.goals = data.goals.filter(item => item.id !== goal.id);
      save();
      renderGoals();
      renderDashboard();
    });

    row.append(check, text, del);
    list.append(row);
  });

  const done = data.goals.filter(goal => goal.done).length;
  const total = data.goals.length;
  const pct = total ? Math.round(done / total * 100) : 0;

  if ($("goal-progress-text")) $("goal-progress-text").textContent = pct + "%";
  if ($("goal-progress-bar")) $("goal-progress-bar").style.width = pct + "%";
}

$("goal-form")?.addEventListener("submit", event => {
  event.preventDefault();

  const text = $("goal-input").value.trim();
  if (!text) return;

  if (data.goals.some(goal => goal.text.toLowerCase() === text.toLowerCase() && !goal.done)) {
    toast("This goal is already on your list.");
    return;
  }

  data.goals.push({ id: Date.now(), text, done: false });
  $("goal-form").reset();
  save();
  renderGoals();
  renderDashboard();
  toast("Daily goal added!");
});

document.querySelectorAll(".suggestion").forEach(button => {
  button.addEventListener("click", () => {
    const text = button.dataset.goal;
    if (!text) return;

    if (data.goals.some(goal => goal.text === text && !goal.done)) {
      toast("This goal is already on your list.");
      return;
    }

    data.goals.push({ id: Date.now(), text, done: false });
    save();
    renderGoals();
    renderDashboard();
    toast("Goal added to your daily list!");
  });
});

/* DASHBOARD */

function renderDashboard() {
  const doneTasks = data.tasks.filter(task => task.done).length;
  const doneGoals = data.goals.filter(goal => goal.done).length;

  if ($("stat-tasks")) $("stat-tasks").textContent = doneTasks;
  if ($("stat-goals")) $("stat-goals").textContent = `${doneGoals}/${data.goals.length}`;
  if ($("stat-focus")) $("stat-focus").textContent = data.focusSessions || 0;
  if ($("stat-xp")) $("(" + "stat-xp" + ")");

  const taskWrap = $("dashboard-tasks");

  if (taskWrap) {
    taskWrap.innerHTML = "";
    const items = data.tasks.filter(task => !task.done).slice(0, 5);

    if (!items.length) {
      taskWrap.innerHTML = '<p class="empty-message">You are all caught up. Add a task whenever you need one.</p>';
    }

    items.forEach(task => {
      const item = document.createElement("div");
      item.className = "compact-item";
      item.textContent = task.text;
      taskWrap.append(item);
    });
  }

  const goalWrap = $("dashboard-goals");

  if (goalWrap) {
    goalWrap.innerHTML = "";
    const items = data.goals.slice(0, 5);

    if (!items.length) {
      goalWrap.innerHTML = '<p class="empty-message">Add a goal to see your daily progress here.</p>';
    }

    items.forEach(goal => {
      const item = document.createElement("div");
      item.className = "compact-item";
      item.textContent = (goal.done ? "✓ " : "") + goal.text;
      goalWrap.append(item);
    });
  }

  const total = data.tasks.length + data.goals.length;
  const completed = doneTasks + doneGoals;
  const pct = total ? Math.round(completed / total * 100) : 0;

  if ($("dashboard-progress-bar")) {
    $("dashboard-progress-bar").style.width = pct + "%";
  }

  if ($("dashboard-progress-text")) {
    $("dashboard-progress-text").textContent = pct + "% complete";
  }

  renderHeader();
}

/* HABITS */

function renderHabits() {
  const list = $("habit-list");
  if (!list) return;

  list.innerHTML = "";

  if (!data.habits.length) {
    list.innerHTML = '<p class="empty-message">Your habits will appear here.</p>';
    return;
  }

  data.habits.forEach(habit => {
    const row = document.createElement("div");
    row.className = "goal-item" + (habit.done ? " completed" : "");

    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = !!habit.done;

    const text = document.createElement("span");
    text.textContent = habit.text;

    const del = document.createElement("button");
    del.className = "icon-btn";
    del.innerHTML = '<i class="fa-solid fa-trash"></i>';

    check.addEventListener("change", () => {
      habit.done = check.checked;
      if (habit.done) {
        addXP(3);
        markActivity();
      }
      save();
      renderHabits();
    });

    del.addEventListener("click", () => {
      data.habits = data.habits.filter(item => item.id !== habit.id);
      save();
      renderHabits();
    });

    row.append(check, text, del);
    list.append(row);
  });
}

$("habit-form")?.addEventListener("submit", event => {
  event.preventDefault();
  const text = $("habit-input").value.trim();
  if (!text) return;

  data.habits.push({ id: Date.now(), text, done: false });
  $("habit-form").reset();
  save();
  renderHabits();
  toast("Habit added!");
});

/* QUICK NOTES */

function renderNotes() {
  const list = $("note-list");
  if (!list) return;

  list.innerHTML = "";

  if (!data.notes.length) {
    list.innerHTML = '<p class="empty-message">Your saved notes will appear here.</p>';
    return;
  }

  data.notes.forEach(note => {
    const card = document.createElement("div");
    card.className = "note-card";

    const text = document.createElement("span");
    text.textContent = note.text;

    const del = document.createElement("button");
    del.className = "icon-btn";
    del.innerHTML = '<i class="fa-solid fa-trash"></i>';

    del.addEventListener("click", () => {
      data.notes = data.notes.filter(item => item.id !== note.id);
      save();
      renderNotes();
    });

    card.append(text, del);
    list.append(card);
  });
}

$("note-form")?.addEventListener("submit", event => {
  event.preventDefault();
  const text = $("note-input").value.trim();
  if (!text) return;

  data.notes.unshift({ id: Date.now(), text });
  $("note-form").reset();
  save();
  renderNotes();
  toast("Note saved!");
});

/* VISION BOARD
   Existing feature: example cards, multiple image upload,
   personal boards, photo gallery and board details.
*/

let visionUploadFiles = [];
let currentVision = null;
let currentVisionPhoto = 0;

function openVisionStudio() {
  $("vision-home")?.classList.add("hidden");
  $("vision-editor")?.classList.remove("hidden");
  $("vision-view")?.classList.add("hidden");

  if ($("vision-editor-form")) $("vision-editor-form").reset();
  visionUploadFiles = [];

  if ($("vision-upload-preview")) $("vision-upload-preview").innerHTML = "";
  if ($("vision-upload-count")) $("vision-upload-count").textContent = "No photos selected yet";
  if ($("vision-preview-title")) $("vision-preview-title").textContent = "Your vision title";
  if ($("vision-preview-description")) $("vision-preview-description").textContent = "Your photos will come together in one place.";
  $("vision-preview-image")?.classList.add("hidden");
  $("vision-preview-placeholder")?.classList.remove("hidden");

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function closeVisionEditor() {
  $("vision-editor")?.classList.add("hidden");
  $("vision-home")?.classList.remove("hidden");
  $("vision-view")?.classList.add("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

$("open-vision-studio")?.addEventListener("click", openVisionStudio);
$("vision-back")?.addEventListener("click", closeVisionEditor);
$("vision-cancel")?.addEventListener("click", closeVisionEditor);
$("vision-view-back")?.addEventListener("click", closeVisionEditor);

$("vision-editor-title")?.addEventListener("input", event => {
  if ($("vision-preview-title")) {
    $("vision-preview-title").textContent = event.target.value || "Your vision title";
  }
});

$("vision-editor-description")?.addEventListener("input", event => {
  if ($("vision-preview-description")) {
    $("vision-preview-description").textContent =
      event.target.value || "Your photos will come together in one place.";
  }
});

$("vision-editor-upload")?.addEventListener("change", event => {
  const files = Array.from(event.target.files || []).slice(0, 25);
  visionUploadFiles = files;

  const preview = $("vision-upload-preview");
  if (!preview) return;

  preview.innerHTML = "";

  files.forEach(file => {
    if (!file.type.startsWith("image/")) return;

    const url = URL.createObjectURL(file);
    const img = document.createElement("img");
    img.src = url;
    img.alt = file.name;
    preview.append(img);
  });

  if ($("vision-upload-count")) {
    $("vision-upload-count").textContent =
      files.length ? `${files.length} photo${files.length === 1 ? "" : "s"} selected` : "No photos selected yet";
  }

  if (files[0]) {
    const url = URL.createObjectURL(files[0]);
    const img = $("vision-preview-image");
    if (img) {
      img.src = url;
      img.classList.remove("hidden");
    }
    $("vision-preview-placeholder")?.classList.add("hidden");
  }
});

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

$("vision-editor-form")?.addEventListener("submit", async event => {
  event.preventDefault();

  const title = $("vision-editor-title").value.trim();
  const description = $("vision-editor-description").value.trim();

  if (!title) {
    toast("Give your vision board a title first.");
    return;
  }

  if (!visionUploadFiles.length) {
    toast("Choose at least one photo for your board.");
    return;
  }

  try {
    const images = await Promise.all(visionUploadFiles.map(fileToDataURL));

    data.vision.unshift({
      id: Date.now(),
      title,
      description,
      images,
      image: images[0],
      steps: [
        "Break the vision into small steps",
        "Choose one action to begin",
        "Review your progress"
      ],
      created: today()
    });

    save();
    renderCustomVisions();
    closeVisionEditor();
    toast("Your vision board has been created!");
  } catch {
    toast("One of the photos could not be uploaded. Try again.");
  }
});

function showVisionDetail(vision) {
  currentVision = vision;
  currentVisionPhoto = 0;

  $("vision-home")?.classList.add("hidden");
  $("vision-editor")?.classList.add("hidden");
  $("vision-view")?.classList.remove("hidden");

  if ($("vision-view-category")) {
    $("vision-view-category").textContent = vision.created ? "MY VISION BOARD" : "INSPIRATION";
  }

  if ($("vision-view-title")) $("vision-view-title").textContent = vision.title || "My Vision";
  if ($("vision-view-description")) $("vision-view-description").textContent = vision.description || "";
  if ($("vision-view-full-description")) {
    $("vision-view-full-description").textContent =
      vision.description || "A collection of things that inspire you.";
  }

  const steps = $("vision-view-steps");
  if (steps) {
    steps.innerHTML = "";
    (vision.steps || []).forEach((step, index) => {
      const item = document.createElement("div");
      item.className = "goal-item";
      const number = document.createElement("strong");
      number.textContent = String(index + 1).padStart(2, "0");
      const text = document.createElement("span");
      text.textContent = step;
      item.append(number, text);
      steps.append(item);
    });
  }

  renderVisionGallery();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function getVisionImages(vision) {
  if (Array.isArray(vision.images) && vision.images.length) return vision.images;
  if (vision.image) return [vision.image];
  return [];
}

function renderVisionGallery() {
  if (!currentVision) return;

  const images = getVisionImages(currentVision);
  const main = $("vision-main-image");
  const thumbs = $("vision-thumbnails");

  if (main && images.length) {
    main.src = images[currentVisionPhoto] || images[0];
  }

  if ($("vision-photo-counter")) {
    $("vision-photo-counter").textContent =
      `${currentVisionPhoto + 1} / ${Math.max(images.length, 1)}`;
  }

  if (thumbs) {
    thumbs.innerHTML = "";

    images.forEach((src, index) => {
      const img = document.createElement("img");
      img.src = src;
      img.alt = `Vision photo ${index + 1}`;
      img.style.outline = index === currentVisionPhoto ? "3px solid var(--primary)" : "none";
      img.addEventListener("click", () => {
        currentVisionPhoto = index;
        renderVisionGallery();
      });
      thumbs.append(img);
    });
  }
}

$("vision-photo-prev")?.addEventListener("click", () => {
  if (!currentVision) return;
  const images = getVisionImages(currentVision);
  if (!images.length) return;
  currentVisionPhoto = (currentVisionPhoto - 1 + images.length) % images.length;
  renderVisionGallery();
});

$("vision-photo-next")?.addEventListener("click", () => {
  if (!currentVision) return;
  const images = getVisionImages(currentVision);
  if (!images.length) return;
  currentVisionPhoto = (currentVisionPhoto + 1) % images.length;
  renderVisionGallery();
});

document.querySelectorAll("#vision .vision-card[data-title]").forEach(card => {
  card.addEventListener("click", () => {
    showVisionDetail({
      title: card.dataset.title,
      description: card.dataset.description,
      steps: (card.dataset.steps || "").split("|")
    });
  });
});

function renderCustomVisions() {
  const wrap = $("my-visions");
  if (!wrap) return;

  wrap.innerHTML = "";

  if (!data.vision.length) {
    wrap.innerHTML = '<p class="empty-message">Your personal boards will appear here after you create one.</p>';
    return;
  }

  data.vision.forEach(vision => {
    const card = document.createElement("article");
    card.className = "vision-card";

    const img = document.createElement("img");
    img.src = getVisionImages(vision)[0] || "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=900";
    img.alt = vision.title;

    const overlay = document.createElement("div");
    overlay.className = "vision-overlay";

    const tag = document.createElement("span");
    tag.textContent = "MY VISION";

    const title = document.createElement("h3");
    title.textContent = vision.title;

    const desc = document.createElement("p");
    desc.textContent = vision.description || "Your personal inspiration board.";

    const open = document.createElement("button");
    open.className = "vision-open";
    open.textContent = "Open board →";
    open.addEventListener("click", event => {
      event.stopPropagation();
      showVisionDetail(vision);
    });

    const remove = document.createElement("button");
    remove.className = "vision-open";
    remove.textContent = "Remove board";
    remove.addEventListener("click", event => {
      event.stopPropagation();
      if (!confirm("Remove this vision board?")) return;
      data.vision = data.vision.filter(item => item.id !== vision.id);
      save();
      renderCustomVisions();
      toast("Board removed.");
    });

    overlay.append(tag, title, desc, open, remove);
    card.append(img, overlay);
    card.addEventListener("click", () => showVisionDetail(vision));
    wrap.append(card);
  });
}

/* FUTURE ME */

function renderFuture() {
  const list = $("future-list");
  if (!list) return;

  list.innerHTML = "";

  if (!data.future.length) {
    list.innerHTML = '<p class="empty-message">Your letters to the future will appear here.</p>';
    return;
  }

  data.future.forEach(letter => {
    const card = document.createElement("article");
    card.className = "future-item";

    const title = document.createElement("h3");
    title.textContent = letter.title;

    const date = document.createElement("p");
    date.className = "muted";
    date.textContent = `Unlock date: ${letter.date}`;

    card.append(title, date);

    if (letter.date <= today()) {
      const reveal = document.createElement("button");
      reveal.className = "secondary-btn";
      reveal.textContent = "Open letter";

      reveal.addEventListener("click", () => {
        if (card.querySelector(".letter-message")) return;
        const message = document.createElement("p");
        message.className = "letter-message";
        message.style.whiteSpace = "pre-wrap";
        message.style.marginTop = "14px";
        message.textContent = letter.message;
        card.append(message);
      });

      card.append(reveal);
    } else {
      const locked = document.createElement("small");
      locked.className = "muted";
      locked.textContent = "🔒 This letter is waiting for its day.";
      card.append(locked);
    }

    const del = document.createElement("button");
    del.className = "icon-btn";
    del.innerHTML = '<i class="fa-solid fa-trash"></i>';
    del.addEventListener("click", () => {
      data.future = data.future.filter(item => item.id !== letter.id);
      save();
      renderFuture();
    });

    card.append(del);
    list.append(card);
  });
}

$("future-date")?.setAttribute("min", today());

$("future-form")?.addEventListener("submit", event => {
  event.preventDefault();

  const date = $("future-date").value;
  if (date < today()) {
    toast("Choose today or a future date.");
    return;
  }

  data.future.unshift({
    id: Date.now(),
    title: $("future-title").value.trim(),
    date,
    message: $("future-message").value.trim()
  });

  $("future-form").reset();
  $("future-date").min = today();
  save();
  renderFuture();
  toast("Your letter has been sealed.");
});

/* FOCUS SOUNDS
   Built-in ambient sounds are generated in the browser.
*/

function stopSound() {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio = null;
  }

  activeAudioNodes.forEach(node => {
    try { node.stop?.(); } catch {}
    try { node.disconnect?.(); } catch {}
  });

  activeAudioNodes = [];

  document.querySelectorAll(".sound-btn").forEach(button => {
    button.textContent = "Play sound";
    button.classList.remove("playing");
  });
}

function getAudioContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) throw new Error("Audio is not supported in this browser.");
  if (!audioContext) audioContext = new AudioCtx();
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

function createNoise(ctx, type = "pink") {
  const length = ctx.sampleRate * 4;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const output = buffer.getChannelData(0);

  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    if (type === "brown") {
      last = (last + 0.02 * white) / 1.02;
      output[i] = last * 3.5;
    } else {
      output[i] = white * 0.45;
    }
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
}

function playAmbientSound(name, button) {
  stopSound();

  try {
    const ctx = getAudioContext();
    const master = ctx.createGain();
    master.gain.value = 0.17;
    master.connect(ctx.destination);

    const noise = createNoise(ctx, name === "ocean" || name === "wind" ? "brown" : "pink");
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    filter.type = "lowpass";
    filter.frequency.value = name === "rain" ? 1200 :
      name === "forest" ? 1800 :
      name === "ocean" ? 500 :
      name === "fire" ? 750 :
      name === "night" ? 600 :
      name === "wind" ? 400 : 900;

    gain.gain.value = name === "white" ? 0.28 : 0.8;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    noise.start();

    activeAudioNodes.push(noise, filter, gain, master);

    if (name === "ocean" || name === "wind") {
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = name === "ocean" ? 0.12 : 0.07;
      lfoGain.gain.value = 0.10;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      lfo.start();
      activeAudioNodes.push(lfo, lfoGain);
    }

    if (name === "forest" || name === "night") {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = name === "forest" ? 1300 : 520;
      oscGain.gain.value = 0.018;
      osc.connect(oscGain);
      oscGain.connect(master);
      osc.start();
      activeAudioNodes.push(osc, oscGain);
    }

    button.textContent = "Stop sound";
    button.classList.add("playing");
    toast("Now playing: " + name.charAt(0).toUpperCase() + name.slice(1));
  } catch {
    toast("Audio could not start in this browser.");
  }
}

document.querySelectorAll(".sound-btn").forEach(button => {
  button.addEventListener("click", () => {
    if (button.classList.contains("playing")) {
      stopSound();
      return;
    }
    playAmbientSound(button.dataset.sound, button);
  });
});

$("sound-upload")?.addEventListener("change", event => {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith("audio/")) {
    toast("Please choose an audio file.");
    return;
  }

  stopSound();

  const audio = $("custom-audio");
  if (customAudioURL) URL.revokeObjectURL(customAudioURL);

  customAudioURL = URL.createObjectURL(file);
  audio.src = customAudioURL;
  audio.classList.remove("hidden");
  $("remove-custom-sound")?.classList.remove("hidden");

  audio.play().catch(() => {
    toast("Your audio is ready. Press play to listen.");
  });
});

$("remove-custom-sound")?.addEventListener("click", () => {
  const audio = $("custom-audio");
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
  audio.classList.add("hidden");
  $("remove-custom-sound").classList.add("hidden");
  $("sound-upload").value = "";

  if (customAudioURL) URL.revokeObjectURL(customAudioURL);
  customAudioURL = null;
  toast("Custom sound removed.");
});

/* POMODORO TIMER */

function updateTimer() {
  if (!$("timer-display")) return;

  const minutes = Math.floor(timerSeconds / 60);
  const seconds = timerSeconds % 60;

  $("timer-display").textContent =
    `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

$("timer-start")?.addEventListener("click", () => {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
    $("timer-start").textContent = "Resume";
    return;
  }

  $("timer-start").textContent = "Pause";

  timerInterval = setInterval(() => {
    timerSeconds--;
    updateTimer();

    if (timerSeconds <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      timerSeconds = 25 * 60;
      updateTimer();

      data.focusSessions = (data.focusSessions || 0) + 1;
      addXP(20);
      markActivity();
      renderDashboard();

      $("timer-start").textContent = "Start";
      toast("Focus session complete! +20 XP");
    }
  }, 1000);
});

$("timer-reset")?.addEventListener("click", () => {
  clearInterval(timerInterval);
  timerInterval = null;
  timerSeconds = 25 * 60;
  updateTimer();
  if ($("timer-start")) $("timer-start").textContent = "Start";
});

/* 30 DAY CHALLENGE */

function renderChallenge() {
  const challenge = data.challenge;

  if ($("challenge-title")) {
    $("challenge-title").textContent = challenge?.title || "Start a new challenge";
  }

  if ($("challenge-description")) {
    $("challenge-description").textContent = challenge
      ? "Your 30-day journey is in progress."
      : "Choose one small goal to practice for 30 days.";
  }

  if ($("challenge-input")) $("challenge-input").disabled = !!challenge;

  const form = $("challenge-form");
  if (form) form.querySelector("button").disabled = !!challenge;

  $("challenge-reset")?.classList.toggle("hidden", !challenge);

  const count = challenge?.days?.filter(Boolean).length || 0;

  if ($("challenge-count")) $("challenge-count").textContent = `${count} / 30 days`;
  if ($("challenge-bar")) $("challenge-bar").style.width = (count / 30 * 100) + "%";

  const days = $("challenge-days");

  if (days) {
    days.innerHTML = "";

    for (let i = 0; i < 30; i++) {
      const button = document.createElement("button");
      button.className = "challenge-day" + (challenge?.days?.[i] ? " done" : "");
      button.textContent = i + 1;
      button.title = `Day ${i + 1}`;
      button.disabled = !challenge || !!challenge.days[i] || count !== i;

      button.addEventListener("click", () => {
        challenge.days[i] = true;
        addXP(8);
        markActivity();
        save();
        renderChallenge();
      });

      days.append(button);
    }
  }

  renderHeatmap();
}

$("challenge-form")?.addEventListener("submit", event => {
  event.preventDefault();

  const title = $("challenge-input").value.trim();
  if (!title) return;

  data.challenge = { title, days: Array(30).fill(false) };
  $("challenge-form").reset();
  save();
  renderChallenge();
  toast("Your challenge has started!");
});

$("challenge-reset")?.addEventListener("click", () => {
  if (!confirm("Reset your 30-day challenge?")) return;
  data.challenge = null;
  save();
  renderChallenge();
});

function renderHeatmap() {
  const wrap = $("activity-heatmap");
  if (!wrap) return;

  wrap.innerHTML = "";

  const totalDays = 180;
  let active = 0;
  let best = 0;
  let streak = 0;

  for (let i = totalDays - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString().slice(0, 10);

    const amount = data.activity[key] || 0;
    const cell = document.createElement("span");
    cell.className = "heat-level-" + Math.min(4, amount);
    cell.title = `${key}: ${amount} activities`;
    wrap.append(cell);

    if (amount) active++;
    best = Math.max(best, amount);
  }

  for (let i = 0; i < totalDays; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString().slice(0, 10);

    if (data.activity[key]) streak++;
    else break;
  }

  if ($("heatmap-total")) {
    $("heatmap-total").textContent =
      Object.values(data.activity).reduce((sum, value) => sum + value, 0) + " activities";
  }

  if ($("heatmap-active-days")) $("heatmap-active-days").textContent = active;
  if ($("heatmap-best-day")) $("heatmap-best-day").textContent = best || "—";
  if ($("heatmap-streak")) $("heatmap-streak").textContent = streak;
  if ($("heatmap-months")) $("heatmap-months").textContent = "Last 6 months";
}

/* REFLECTIONS */

$("reflection-form")?.addEventListener("submit", event => {
  event.preventDefault();

  data.reflections.unshift({
    id: Date.now(),
    date: today(),
    good: $("reflection-good").value,
    hard: $("reflection-hard").value,
    next: $("reflection-next").value
  });

  $("reflection-form").reset();
  save();
  renderReflections();
  markActivity();
  toast("Reflection saved.");
});

function renderReflections() {
  const list = $("reflection-list");
  if (!list) return;

  list.innerHTML = "";

  if (!data.reflections.length) {
    list.innerHTML = '<p class="empty-message">Your saved reflections will appear here.</p>';
    return;
  }

  data.reflections.forEach(reflection => {
    const card = document.createElement("div");
    card.className = "panel reflection-item";

    const heading = document.createElement("h3");
    heading.textContent = new Date(reflection.date + "T12:00:00").toLocaleDateString(
      undefined,
      { year: "numeric", month: "long", day: "numeric" }
    );

    card.append(heading);

    [
      ["What went well", reflection.good],
      ["What challenged you", reflection.hard],
      ["Next week", reflection.next]
    ].forEach(([label, value]) => {
      if (!value) return;
      const p = document.createElement("p");
      p.textContent = label + ": " + value;
      card.append(p);
    });

    list.append(card);
  });
}

/* SMART LISTS */

const templates = {
  "Study Checklist": [
    "Review notes", "Finish assignments", "Prepare questions", "Take a short break"
  ],
  "Weekly Reset": [
    "Plan the week", "Tidy my workspace", "Check upcoming dates", "Prepare essentials"
  ],
  "Shopping List": [
    "Add groceries", "Add home essentials", "Check what I already have"
  ],
  "Books to Read": [
    "Choose a book", "Read a few pages", "Write a short note"
  ],
  "Movie Watchlist": [
    "Add a movie", "Pick a movie night", "Rate what I watched"
  ],
  "Ideas & Projects": [
    "Write the idea", "List first steps", "Choose a start date"
  ]
};

function renderSmartLists() {
  const wrap = $("smartlist-container");
  if (!wrap) return;

  wrap.innerHTML = "";

  if (!data.smartLists.length) {
    wrap.innerHTML = '<p class="empty-message">No lists yet. Choose a template or create your own list.</p>';
    return;
  }

  data.smartLists.forEach(list => {
    const card = document.createElement("div");
    card.className = "smartlist-card";

    const header = document.createElement("div");
    header.className = "panel-heading";

    const heading = document.createElement("h3");
    heading.textContent = list.name;

    const count = document.createElement("span");
    count.className = "muted";
    count.textContent = `${list.items.filter(item => item.done).length}/${list.items.length}`;

    header.append(heading, count);
    card.append(header);

    list.items.forEach(item => {
      const row = document.createElement("div");
      row.className = "goal-item" + (item.done ? " completed" : "");

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = !!item.done;

      const text = document.createElement("span");
      text.textContent = item.text;

      const remove = document.createElement("button");
      remove.className = "icon-btn";
      remove.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      remove.title = "Remove item";

      checkbox.addEventListener("change", () => {
        item.done = checkbox.checked;
        save();
        renderSmartLists();
      });

      remove.addEventListener("click", () => {
        list.items = list.items.filter(current => current !== item);
        save();
        renderSmartLists();
      });

      row.append(checkbox, text, remove);
      card.append(row);
    });

    const form = document.createElement("form");
    form.className = "inline-form";

    const input = document.createElement("input");
    input.placeholder = "Add an item...";
    input.required = true;

    const button = document.createElement("button");
    button.className = "secondary-btn";
    button.textContent = "Add";

    form.append(input, button);

    form.addEventListener("submit", event => {
      event.preventDefault();
      const value = input.value.trim();
      if (!value) return;

      list.items.push({ text: value, done: false });
      save();
      renderSmartLists();
    });

    const deleteList = document.createElement("button");
    deleteList.className = "text-btn";
    deleteList.textContent = "Delete list";
    deleteList.addEventListener("click", () => {
      if (!confirm(`Delete "${list.name}"?`)) return;
      data.smartLists = data.smartLists.filter(item => item !== list);
      save();
      renderSmartLists();
    });

    card.append(form, deleteList);
    wrap.append(card);
  });
}

$("smartlist-form")?.addEventListener("submit", event => {
  event.preventDefault();

  const name = $("smartlist-name").value.trim();
  if (!name) return;

  if (data.smartLists.some(list => list.name.toLowerCase() === name.toLowerCase())) {
    toast("A list with this name already exists.");
    return;
  }

  data.smartLists.push({ name, items: [] });
  $("smartlist-form").reset();
  save();
  renderSmartLists();
  toast("Your list has been created!");
});

document.querySelectorAll(".template-card").forEach(button => {
  button.addEventListener("click", () => {
    const name = button.dataset.template;

    if (data.smartLists.some(list => list.name === name)) {
      toast("This template has already been added.");
      return;
    }

    data.smartLists.push({
      name,
      items: (templates[name] || []).map(text => ({ text, done: false }))
    });

    save();
    renderSmartLists();
    toast(name + " created!");
  });
});

/* ACHIEVEMENTS */

const achievements = [
  ["First Step", "Complete your first task", () => data.tasks.some(task => task.done), "fa-flag-checkered"],
  ["Getting Things Done", "Complete 10 tasks", () => data.tasks.filter(task => task.done).length >= 10, "fa-list-check"],
  ["Goal Getter", "Complete 5 daily goals", () => data.goals.filter(goal => goal.done).length >= 5, "fa-bullseye"],
  ["Focus Friend", "Finish 3 focus sessions", () => (data.focusSessions || 0) >= 3, "fa-hourglass-half"],
  ["Consistency", "Complete a 30-day challenge", () => !!data.challenge && data.challenge.days.every(Boolean), "fa-fire"],
  ["Vision Builder", "Create a personal vision board", () => data.vision.length > 0, "fa-images"],
  ["XP Collector", "Earn 500 XP", () => (data.xp || 0) >= 500, "fa-star"],
  ["Big Progress", "Earn 1500 XP", () => (data.xp || 0) >= 1500, "fa-trophy"],
  ["Planner Pro", "Create 10 daily goals", () => data.goals.length >= 10, "fa-calendar-check"]
];

function renderAchievements() {
  if ($("achievement-xp")) $("achievement-xp").textContent = data.xp || 0;
  if ($("achievement-tasks")) {
    $("achievement-tasks").textContent = data.tasks.filter(task => task.done).length;
  }
  if ($("achievement-focus")) $("achievement-focus").textContent = data.focusSessions || 0;

  const unlocked = achievements.filter(item => item[2]()).length;
  if ($("achievement-count")) $("achievement-count").textContent = unlocked;

  const list = $("achievement-list");

  if (list) {
    list.innerHTML = "";

    achievements.forEach(achievement => {
      const isUnlocked = achievement[2]();

      const card = document.createElement("div");
      card.className = "achievement-card";

      const icon = document.createElement("i");
      icon.className = "fa-solid " + achievement[3];

      const title = document.createElement("strong");
      title.textContent = achievement[0];

      const description = document.createElement("p");
      description.textContent = achievement[1];

      const status = document.createElement("small");
      status.textContent = isUnlocked ? "✓ Unlocked" : "🔒 Locked";
      status.style.color = isUnlocked ? "#65a986" : "var(--muted)";

      card.append(icon, title, description, status);
      list.append(card);
    });
  }

  renderThemeStore();
}

/* THEME SHOP */

const themes = [
  {
    name: "Lavender", cost: 0, primary: "#8585dc", light: "#eeeeff",
    background: "#f5f6fc", surface: "#ffffff", description: "The original soft lavender look."
  },
  {
    name: "Rose", cost: 300, primary: "#dc8eae", light: "#ffedf4",
    background: "#fcf4f7", surface: "#ffffff", description: "A soft pink and rose atmosphere."
  },
  {
    name: "Mint", cost: 700, primary: "#70b797", light: "#e8f7ef",
    background: "#f2faf6", surface: "#ffffff", description: "Fresh, calm and nature inspired."
  },
  {
    name: "Ocean", cost: 1200, primary: "#68a9cc", light: "#e9f5fc",
    background: "#f1f8fc", surface: "#ffffff", description: "A cool blue workspace."
  },
  {
    name: "Peach", cost: 1800, primary: "#df9d75", light: "#fff0e6",
    background: "#fff7f1", surface: "#ffffff", description: "Warm peach tones and soft light."
  },
  {
    name: "Midnight", cost: 2500, primary: "#9b91df", light: "#34304f",
    background: "#191827", surface: "#25233a", description: "A deep dark theme for night sessions."
  },
  {
    name: "Sage Garden", cost: 3200, primary: "#8ba77d", light: "#edf4e9",
    background: "#f4f7f0", surface: "#ffffff", description: "A gentle botanical colour palette."
  },
  {
    name: "Dreamy Sky", cost: 4500, primary: "#82a8e7", light: "#eaf1ff",
    background: "#f3f7ff", surface: "#ffffff", description: "Airy blue tones with a dreamy feel."
  }
];

function applyTheme(theme) {
  const root = document.documentElement;

  root.style.setProperty("--primary", theme.primary);
  root.style.setProperty("--primary-light", theme.light);
  root.style.setProperty("--bg", theme.background);
  root.style.setProperty("--surface", theme.surface);
  root.style.setProperty("--primary-dark", theme.primary);

  data.themeName = theme.name;
  data.profile.color = theme.primary;

  document.body.classList.toggle("dark", theme.name === "Midnight");
  save();
  renderHeader();
  renderProfile();
}

function renderThemeStore() {
  const store = $("theme-store");
  if (!store) return;

  store.innerHTML = "";

  themes.forEach(theme => {
    const unlocked = data.unlockedThemes.includes(theme.name);
    const selected = data.themeName === theme.name ||
      (!data.themeName && theme.name === "Lavender");

    const card = document.createElement("div");
    card.className = "theme-card";

    const mockup = document.createElement("div");
    mockup.className = "theme-mockup";
    mockup.style.background = theme.background;

    const sidebar = document.createElement("div");
    sidebar.className = "theme-mock-sidebar";
    sidebar.style.background = theme.primary;

    const content = document.createElement("div");
    content.className = "theme-mock-content";

    for (let i = 0; i < 3; i++) {
      const line = document.createElement("span");
      line.style.background = i === 0 ? theme.primary : theme.light;
      content.append(line);
    }

    mockup.append(sidebar, content);

    const title = document.createElement("strong");
    title.textContent = theme.name;

    const description = document.createElement("p");
    description.textContent = theme.description;

    const cost = document.createElement("p");
    cost.className = "theme-cost";
    cost.textContent = theme.cost === 0 ? "FREE" : theme.cost.toLocaleString() + " XP";

    const button = document.createElement("button");
    button.className = selected ? "primary-btn" : "secondary-btn";

    if (selected) {
      button.textContent = "Currently selected";
      button.disabled = true;
    } else if (unlocked) {
      button.textContent = "Use theme";
    } else {
      button.textContent = "Unlock theme";
    }

    button.addEventListener("click", () => {
      if (!unlocked) {
        if ((data.xp || 0) < theme.cost) {
          toast(`You need ${(theme.cost - data.xp).toLocaleString()} more XP.`);
          return;
        }

        data.xp -= theme.cost;
        data.unlockedThemes.push(theme.name);
        toast(theme.name + " theme unlocked!");
      }

      applyTheme(theme);
      renderThemeStore();
      toast(theme.name + " theme applied!");
    });

    card.append(mockup, title, description, cost, button);
    store.append(card);
  });

  if ($("shop-xp")) $("shop-xp").textContent = (data.xp || 0) + " XP";
}

function loadSavedTheme() {
  const theme = themes.find(item => item.name === data.themeName) || themes[0];
  applyTheme(theme);

  if (data.theme === "dark" && theme.name !== "Midnight") {
    document.body.classList.add("dark");
  }
}

/* PROFILE STUDIO */

function renderProfile() {
  if ($("profile-name")) $("profile-name").value = data.profile.name || "";
  if ($("profile-color")) $("profile-color").value = data.profile.color || "#8585dc";

  const initial = (data.profile.name || "F").trim().charAt(0).toUpperCase();

  if ($("profile-avatar")) {
    $("profile-avatar").textContent = initial;
    $("profile-avatar").style.background = data.profile.color || "var(--primary)";
  }

  if ($("profile-preview-name")) {
    $("profile-preview-name").textContent = data.profile.name || "FlowUp member";
  }

  if ($("profile-preview-xp")) {
    $("profile-preview-xp").textContent = (data.xp || 0) + " XP earned";
  }

  if ($("profile-stats")) {
    $("profile-stats").innerHTML = `
      <div><strong>${data.xp || 0}</strong><span>Total XP</span></div>
      <div><strong>${data.tasks.filter(task => task.done).length}</strong><span>Tasks done</span></div>
      <div><strong>${data.focusSessions || 0}</strong><span>Focus sessions</span></div>`;
  }
}

$("profile-form")?.addEventListener("submit", event => {
  event.preventDefault();

  data.profile.name = $("profile-name").value.trim();
  data.profile.color = $("profile-color").value;

  save();
  renderProfile();
  renderHeader();
  toast("Your profile has been saved!");
});

$("profile-color")?.addEventListener("input", event => {
  const color = event.target.value;
  if ($("profile-avatar")) $("profile-avatar").style.background = color;
  if ($("top-avatar")) $("top-avatar").style.background = color;
});

document.querySelectorAll(".color-choice").forEach(button => {
  button.addEventListener("click", () => {
    const color = button.dataset.color;
    $("profile-color").value = color;
    $("profile-color").dispatchEvent(new Event("input"));
  });
});

/* GENERAL SETTINGS */

$("theme-toggle")?.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  data.theme = document.body.classList.contains("dark") ? "dark" : "light";
  save();
});

$("mobile-menu")?.addEventListener("click", () => {
  $("sidebar")?.classList.toggle("open");
});

document.querySelectorAll(".nav-link[data-page]").forEach(button => {
  button.addEventListener("click", () => openPage(button.dataset.page));
});

/* INITIALIZE */

function init() {
  if (data.themeName) {
    const selected = themes.find(theme => theme.name === data.themeName);
    if (selected) {
      document.documentElement.style.setProperty("--primary", selected.primary);
      document.documentElement.style.setProperty("--primary-light", selected.light);
      document.documentElement.style.setProperty("--bg", selected.background);
      document.documentElement.style.setProperty("--surface", selected.surface);
      document.documentElement.style.setProperty("--primary-dark", selected.primary);
    }
  }

  if (data.theme === "dark" || data.themeName === "Midnight") {
    document.body.classList.add("dark");
  }

  renderHeader();
  renderTasks();
  renderGoals();
  renderDashboard();
  renderHabits();
  renderNotes();
  renderCustomVisions();
  renderFuture();
  renderChallenge();
  renderReflections();
  renderSmartLists();
  renderAchievements();
  renderProfile();
  updateTimer();
}

init();