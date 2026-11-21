
// FLOWUP DATA

let data = JSON.parse(localStorage.getItem("flowupData") || "{}");

const defaults = {
    xp: 0,
    tasks: [],
    goals: [],
    habits: [],
    notes: [],
    theme: "baby",
    focusSessions: 0,
    vision: [],
    challenge: null,
    reflections: [],
    smartLists: [],
    milestones: [],
    profile: { name: "", color: "#79b9e8" }
};

Object.keys(defaults).forEach(key => {
    if (data[key] === undefined) data[key] = defaults[key];
});

data.xpHistory = data.xpHistory || {};

const today = getToday();

data.goals = data.goals.map(g => ({
    ...g,
    date: g.date || today,
    xpGiven: !!g.xpGiven
}));

data.habits = data.habits.map(h => ({
    ...h,
    completed: h.date === today ? !!h.completed : false,
    date: today
}));

let timerSeconds = 25 * 60;
let timerInterval = null;
let audioContext = null;
let activeSound = null;
let noiseNode = null;
let soundGain = null;

const $ = id => document.getElementById(id);


// DATE FUNCTIONS

function getToday() {
    const d = new Date();

    return d.getFullYear() + "-" +
        String(d.getMonth() + 1).padStart(2, "0") + "-" +
        String(d.getDate()).padStart(2, "0");
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[c]));
}

function saveData() {
    localStorage.setItem("flowupData", JSON.stringify(data));
    updateEverything();
}

function awardXP(points) {
    data.xp += points;

    data.xpHistory[today] =
        (data.xpHistory[today] || 0) + points;

    saveData();
}


// PAGE NAVIGATION

function showPage(page) {

    document.querySelectorAll(".page").forEach(p => {
        p.classList.toggle("active", p.id === page);
    });

    document.querySelectorAll(".nav-link").forEach(b => {
        b.classList.toggle("active", b.dataset.page === page);
    });

    const button = document.querySelector(
        '.nav-link[data-page="' + page + '"]'
    );

    $("page-heading").textContent =
        button ? button.textContent.trim() : "Dashboard";
}

document.querySelectorAll(".nav-link").forEach(button => {
    button.addEventListener("click", () => {
        showPage(button.dataset.page);
    });
});

document.querySelectorAll("[data-open-page]").forEach(button => {
    button.addEventListener("click", () => {
        showPage(button.dataset.openPage);
    });
});

$("today-date").textContent = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
});

$("task-date").value = today;


// MY TASKS

$("task-form").addEventListener("submit", function(e) {

    e.preventDefault();

    data.tasks.push({
        id: Date.now(),
        title: $("task-input").value.trim(),
        date: $("task-date").value,
        time: $("task-time").value,
        priority: $("task-priority").value,
        category: $("task-category").value,
        completed: false,
        xpGiven: false
    });

    this.reset();
    $("task-date").value = today;

    saveData();
});


function renderTasks() {

    const list = $("task-list");

    const search = $("task-search").value.toLowerCase();
    const status = $("task-filter").value;
    const priority = $("priority-filter").value;

    list.innerHTML = "";

    const filtered = data.tasks.filter(task => {

        const matchesSearch =
            (task.title || "").toLowerCase().includes(search);

        const matchesStatus =
            status === "All" ||
            (status === "Active" && !task.completed) ||
            (status === "Completed" && task.completed);

        const matchesPriority =
            priority === "All" || task.priority === priority;

        return matchesSearch && matchesStatus && matchesPriority;
    });

    if (filtered.length === 0) {
        list.innerHTML =
            '<p class="empty-message">No tasks found. Add a new task to get started.</p>';
    }

    filtered.forEach(task => {

        const item = document.createElement("div");

        item.className = "task-item" +
            (task.completed ? " completed" : "");

        item.innerHTML = `
            <div class="task-main">
                <strong>${escapeHTML(task.title)}</strong>
                <p>
                    ${escapeHTML(task.category)} ·
                    ${escapeHTML(task.date)} ·
                    ${escapeHTML(task.time || "No time")}
                </p>
            </div>

            <div class="task-actions">

                <span class="priority ${escapeHTML(task.priority)}">
                    ${escapeHTML(task.priority)}
                </span>

                <input type="checkbox"
                    aria-label="Complete task"
                    ${task.completed ? "checked" : ""}>

                <button class="delete-btn">
                    <i class="fa-solid fa-trash"></i>
                </button>

            </div>
        `;

        item.querySelector("input").addEventListener("change", e => {
            completeTask(task.id, e.target.checked);
        });

        item.querySelector(".delete-btn").addEventListener("click", () => {

            data.tasks = data.tasks.filter(t => t.id !== task.id);

            saveData();
        });

        list.appendChild(item);
    });

    $("task-total").textContent = data.tasks.length;

    $("task-completed").textContent =
        data.tasks.filter(t => t.completed).length;

    $("task-remaining").textContent =
        data.tasks.filter(t => !t.completed).length;
}


function completeTask(id, checked) {

    const task = data.tasks.find(t => t.id === id);

    if (!task || task.completed === checked) return;

    task.completed = checked;

    if (checked && !task.xpGiven) {

        let points = 10;

        if (task.priority === "Medium") points = 25;
        if (task.priority === "High") points = 50;

        task.xpGiven = true;

        data.xp += points;

        data.xpHistory[today] =
            (data.xpHistory[today] || 0) + points;
    }

    saveData();
}


function renderDashboardTasks() {

    const list = $("dashboard-task-list");

    const items = data.tasks.filter(t => !t.completed).slice(0, 5);

    if (!items.length) {
        list.innerHTML =
            '<p class="empty-message">You are all caught up. Add a task whenever you need one.</p>';
        return;
    }

    list.innerHTML = items.map(t => `
        <div class="glance-item">
            <i class="fa-regular fa-circle"></i>
            <div>
                <strong>${escapeHTML(t.title)}</strong>
                <p>${escapeHTML(t.date)} · ${escapeHTML(t.priority)} priority</p>
            </div>
        </div>
    `).join("");
}

$("task-search").addEventListener("input", renderTasks);
$("task-filter").addEventListener("change", renderTasks);
$("priority-filter").addEventListener("change", renderTasks);


// DAILY GOALS

const goalExamples = [

    ["Drink 2 glasses of water", "Easy", 10,
        "Take a short break and drink water."],

    ["Organize your desk", "Easy", 10,
        "Make your workspace neat."],

    ["Plan tomorrow's tasks", "Easy", 20,
        "Prepare a simple plan."],

    ["Read 10 pages", "Easy", 15,
        "Spend some time reading."],

    ["Take a short walk", "Easy", 15,
        "Get some fresh air."],

    ["Review school notes", "Medium", 30,
        "Review what you learned."],

    ["Read for 30 minutes", "Medium", 25,
        "Spend time reading."],

    ["Finish 3 important tasks", "Medium", 40,
        "Complete three planned tasks."],

    ["Practice a new skill", "Medium", 35,
        "Learn something new."],

    ["Complete all homework", "Hard", 50,
        "Finish your planned homework."],

    ["Complete a challenging assignment", "Hard", 80,
        "Work through a difficult assignment."],

    ["Make progress on a big project", "Hard", 100,
        "Complete one meaningful project step."]
];


function renderGoals() {

    $("goal-examples").innerHTML = goalExamples.map((g, i) => `
        <div class="goal-card">
            <h4>${g[0]}</h4>
            <p>${g[3]}</p>
            <small>${g[1]} · ${g[2]} XP</small>
            <button class="secondary-btn" data-add-goal="${i}">
                Add goal
            </button>
        </div>
    `).join("");

    document.querySelectorAll("[data-add-goal]").forEach(button => {

        button.addEventListener("click", () => {

            const g = goalExamples[Number(button.dataset.addGoal)];

            if (data.goals.some(x => x.name === g[0] && x.date === today)) {
                alert("This goal is already on today's list.");
                return;
            }

            data.goals.push({
                id: Date.now(),
                name: g[0],
                difficulty: g[1],
                xp: g[2],
                date: today,
                completed: false,
                xpGiven: false
            });

            saveData();
        });
    });

    const goals = data.goals.filter(g => g.date === today);

    $("goal-list").innerHTML = goals.length
        ? goals.map(g => `
            <div class="habit-item ${g.completed ? "done" : ""}">
                <label>
                    <input type="checkbox"
                        data-goal="${g.id}"
                        ${g.completed ? "checked" : ""}>
                    <span>${escapeHTML(g.name)} · ${g.xp} XP</span>
                </label>

                <button class="delete-btn" data-delete-goal="${g.id}">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `).join("")
        : '<p class="empty-message">Choose a suggested goal to get started.</p>';

    document.querySelectorAll("[data-goal]").forEach(checkbox => {

        checkbox.addEventListener("change", () => {

            const goal = data.goals.find(
                g => g.id === Number(checkbox.dataset.goal)
            );

            if (!goal) return;

            goal.completed = checkbox.checked;

            if (checkbox.checked && !goal.xpGiven) {
                goal.xpGiven = true;
                data.xp += goal.xp;
                data.xpHistory[today] =
                    (data.xpHistory[today] || 0) + goal.xp;
            }

            saveData();
        });
    });

    document.querySelectorAll("[data-delete-goal]").forEach(button => {

        button.addEventListener("click", () => {

            data.goals = data.goals.filter(
                g => g.id !== Number(button.dataset.deleteGoal)
            );

            saveData();
        });
    });
}


// HABIT TRACKER

$("habit-form").addEventListener("submit", e => {

    e.preventDefault();

    data.habits.push({
        id: Date.now(),
        name: $("habit-input").value.trim(),
        date: today,
        completed: false
    });

    e.target.reset();

    saveData();
});


function renderHabits() {

    const done = data.habits.filter(h => h.completed).length;

    $("habit-count").textContent =
        done + "/" + data.habits.length;

    $("habit-list").innerHTML = data.habits.length
        ? data.habits.map(h => `
            <div class="habit-item ${h.completed ? "done" : ""}">
                <label>
                    <input type="checkbox"
                        data-habit="${h.id}"
                        ${h.completed ? "checked" : ""}>
                    <span>${escapeHTML(h.name)}</span>
                </label>

                <button class="delete-btn" data-remove-habit="${h.id}">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `).join("")
        : '<p class="empty-message">Add a habit you want to practice regularly.</p>';

    document.querySelectorAll("[data-habit]").forEach(checkbox => {

        checkbox.addEventListener("change", () => {

            const habit = data.habits.find(
                h => h.id === Number(checkbox.dataset.habit)
            );

            if (!habit) return;

            habit.completed = checkbox.checked;

            if (checkbox.checked) {
                awardXP(5);
            } else {
                saveData();
            }
        });
    });

    document.querySelectorAll("[data-remove-habit]").forEach(button => {

        button.addEventListener("click", () => {

            data.habits = data.habits.filter(
                h => h.id !== Number(button.dataset.removeHabit)
            );

            saveData();
        });
    });
}


// QUICK NOTES

$("note-form").addEventListener("submit", e => {

    e.preventDefault();

    data.notes.unshift({
        id: Date.now(),
        title: $("note-title").value.trim(),
        text: $("note-text").value.trim()
    });

    e.target.reset();

    saveData();
});


function renderNotes() {

    $("notes-list").innerHTML = data.notes.length
        ? data.notes.map(n => `
            <div class="note-card">
                <h4>${escapeHTML(n.title)}</h4>
                <p>${escapeHTML(n.text)}</p>
                <button class="text-btn" data-delete-note="${n.id}">
                    Delete
                </button>
            </div>
        `).join("")
        : '<p class="empty-message">Your saved notes will appear here.</p>';

    document.querySelectorAll("[data-delete-note]").forEach(button => {

        button.addEventListener("click", () => {

            data.notes = data.notes.filter(
                n => n.id !== Number(button.dataset.deleteNote)
            );

            saveData();
        });
    });
}


// FOCUS TIMER

function displayTimer() {

    $("timer-display").textContent =
        String(Math.floor(timerSeconds / 60)).padStart(2, "0") +
        ":" +
        String(timerSeconds % 60).padStart(2, "0");
}


document.querySelectorAll(".timer-option").forEach(button => {

    button.addEventListener("click", () => {

        clearInterval(timerInterval);
        timerInterval = null;

        timerSeconds = Number(button.dataset.minutes) * 60;

        displayTimer();

        $("timer-status").textContent = "Ready when you are";
        $("timer-start").textContent = "Start";

        document.querySelectorAll(".timer-option").forEach(b => {
            b.classList.toggle("selected", b === button);
        });
    });
});


$("timer-start").addEventListener("click", () => {

    if (timerInterval) {

        clearInterval(timerInterval);
        timerInterval = null;

        $("timer-start").textContent = "Resume";
        $("timer-status").textContent = "Paused";

        return;
    }

    $("timer-start").textContent = "Pause";
    $("timer-status").textContent = "Stay focused. You've got this.";

    timerInterval = setInterval(() => {

        timerSeconds--;

        displayTimer();

        if (timerSeconds <= 0) {

            clearInterval(timerInterval);
            timerInterval = null;

            $("timer-start").textContent = "Start";
            $("timer-status").textContent = "Focus session complete!";

            data.focusSessions++;

            awardXP(20);
        }

    }, 1000);
});


$("timer-reset").addEventListener("click", () => {

    clearInterval(timerInterval);
    timerInterval = null;

    timerSeconds =
        Number(document.querySelector(".timer-option.selected").dataset.minutes) * 60;

    displayTimer();

    $("timer-start").textContent = "Start";
    $("timer-status").textContent = "Ready when you are";
});


// VISION BOARD

$("vision-form").addEventListener("submit", e => {

    e.preventDefault();

    data.vision.push({
        id: Date.now(),
        title: $("vision-title").value.trim(),
        detail: $("vision-detail").value.trim(),
        image: $("vision-image").value.trim()
    });

    e.target.reset();

    saveData();
});


function renderVision() {

    $("vision-list").innerHTML = data.vision.length
        ? data.vision.map(v => `
            <div class="vision-card">

                ${v.image && /^https?:\/\//i.test(v.image)
                    ? `<img src="${escapeHTML(v.image)}" alt="">`
                    : ""}

                <h3>${escapeHTML(v.title)}</h3>
                <p>${escapeHTML(v.detail)}</p>

                <button class="text-btn" data-delete-vision="${v.id}">
                    Remove
                </button>

            </div>
        `).join("")
        : '<p class="empty-message">Add a goal or idea that inspires you.</p>';

    document.querySelectorAll("[data-delete-vision]").forEach(button => {

        button.addEventListener("click", () => {

            data.vision = data.vision.filter(
                v => v.id !== Number(button.dataset.deleteVision)
            );

            saveData();
        });
    });
}


// FOCUS SOUNDS

async function playSound(type) {

    stopSound();

    const AudioCtx = window.AudioContext || window.webkitAudioContext;

    if (!AudioCtx) {
        $("sound-status").textContent =
            "Audio is not supported in this browser.";
        return;
    }

    audioContext = new AudioCtx();

    await audioContext.resume();

    soundGain = audioContext.createGain();
    soundGain.gain.value = 0.08;
    soundGain.connect(audioContext.destination);

    const length = audioContext.sampleRate * 2;

    const buffer = audioContext.createBuffer(
        1,
        length,
        audioContext.sampleRate
    );

    const channel = buffer.getChannelData(0);

    let last = 0;

    for (let i = 0; i < length; i++) {

        const white = Math.random() * 2 - 1;

        last = type === "ocean"
            ? last * 0.96 + white * 0.04
            : white;

        channel[i] = type === "rain"
            ? white * 0.35
            : type === "ocean"
                ? last * 2
                : white * 0.25;
    }

    noiseNode = audioContext.createBufferSource();
    noiseNode.buffer = buffer;
    noiseNode.loop = true;

    const filter = audioContext.createBiquadFilter();

    filter.type = type === "ocean"
        ? "lowpass"
        : type === "rain"
            ? "highpass"
            : "lowpass";

    filter.frequency.value = type === "ocean"
        ? 450
        : type === "rain"
            ? 1800
            : 900;

    noiseNode.connect(filter);
    filter.connect(soundGain);

    noiseNode.start();

    activeSound = type;

    $("sound-status").textContent = "Playing: " + type;

    document.querySelectorAll(".sound-button").forEach(button => {
        button.textContent =
            button.dataset.sound === type ? "Playing..." : "Play sound";
    });
}


function stopSound() {

    if (noiseNode) {
        try {
            noiseNode.stop();
        } catch (e) {}

        noiseNode = null;
    }

    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }

    activeSound = null;

    if ($("sound-status")) {
        $("sound-status").textContent = "No sound playing.";
    }

    document.querySelectorAll(".sound-button").forEach(button => {
        button.textContent = "Play sound";
    });
}


document.querySelectorAll(".sound-button").forEach(button => {

    button.addEventListener("click", () => {

        if (activeSound === button.dataset.sound) {
            stopSound();
        } else {
            playSound(button.dataset.sound);
        }
    });
});

$("sound-stop").addEventListener("click", stopSound);


// 30 DAY CHALLENGE

$("challenge-form").addEventListener("submit", e => {

    e.preventDefault();

    if (data.challenge && !confirm("Replace your current challenge?")) {
        return;
    }

    data.challenge = {
        name: $("challenge-name").value.trim(),
        start: today,
        done: []
    };

    e.target.reset();

    saveData();
});


function renderChallenge() {

    const area = $("challenge-area");

    if (!data.challenge) {
        area.innerHTML =
            '<p class="empty-message">Create a 30-day challenge to begin.</p>';
        return;
    }

    const done = data.challenge.done.length;

    area.innerHTML = `
        <div class="challenge-progress">
            <h3>${escapeHTML(data.challenge.name)}</h3>
            <p>${done}/30 days completed</p>

            <div class="progress-bg">
                <div style="width:${done / 30 * 100}%"></div>
            </div>
        </div>

        <div class="challenge-days">
            ${Array.from({length: 30}, (_, i) => `
                <button class="challenge-day ${data.challenge.done.includes(i) ? "done" : ""}"
                    data-challenge-day="${i}">
                    ${i + 1}
                </button>
            `).join("")}
        </div>

        <p class="small-note">
            Select a day to mark it complete.
        </p>
    `;

    document.querySelectorAll("[data-challenge-day]").forEach(button => {

        button.addEventListener("click", () => {

            const day = Number(button.dataset.challengeDay);

            if (data.challenge.done.includes(day)) {

                data.challenge.done =
                    data.challenge.done.filter(x => x !== day);

            } else {

                data.challenge.done.push(day);

                awardXP(10);
                return;
            }

            saveData();
        });
    });
}


// WEEKLY REFLECTION

$("reflection-form").addEventListener("submit", e => {

    e.preventDefault();

    data.reflections.unshift({
        id: Date.now(),
        date: today,
        good: $("reflection-good").value,
        hard: $("reflection-hard").value,
        next: $("reflection-next").value
    });

    e.target.reset();

    saveData();
});


function renderReflections() {

    $("reflection-list").innerHTML = data.reflections.length
        ? data.reflections.map(r => `
            <div class="reflection-item">
                <strong>${escapeHTML(r.date)}</strong>

                <p><b>Went well:</b> ${escapeHTML(r.good)}</p>
                <p><b>Challenge:</b> ${escapeHTML(r.hard)}</p>
                <p><b>Next week:</b> ${escapeHTML(r.next)}</p>

                <button class="text-btn" data-delete-reflection="${r.id}">
                    Delete
                </button>
            </div>
        `).join("")
        : '<p class="empty-message">Your reflections will be saved here.</p>';

    document.querySelectorAll("[data-delete-reflection]").forEach(button => {

        button.addEventListener("click", () => {

            data.reflections = data.reflections.filter(
                r => r.id !== Number(button.dataset.deleteReflection)
            );

            saveData();
        });
    });
}


// SMART LISTS

$("smart-list-form").addEventListener("submit", e => {

    e.preventDefault();

    data.smartLists.push({
        id: Date.now(),
        name: $("smart-list-name").value.trim(),
        items: []
    });

    e.target.reset();

    saveData();
});


function renderSmartLists() {

    $("smart-lists").innerHTML = data.smartLists.length
        ? data.smartLists.map(list => `
            <div class="smart-list">

                <div class="smart-list-head">
                    <strong>${escapeHTML(list.name)}</strong>

                    <button class="delete-btn" data-delete-list="${list.id}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>

                <div class="smart-list-items">
                    ${list.items.map((item, i) => `
                        <label>
                            <input type="checkbox"
                                data-list-check="${list.id}:${i}"
                                ${item.done ? "checked" : ""}>
                            <span>${escapeHTML(item.text)}</span>
                        </label>
                    `).join("")}
                </div>

                <form class="smart-add" data-list-form="${list.id}">
                    <input name="item" placeholder="Add an item..." required>
                    <button class="secondary-btn">Add</button>
                </form>

            </div>
        `).join("")
        : '<p class="empty-message">Create your first custom list.</p>';

    document.querySelectorAll("[data-delete-list]").forEach(button => {

        button.addEventListener("click", () => {

            data.smartLists = data.smartLists.filter(
                l => l.id !== Number(button.dataset.deleteList)
            );

            saveData();
        });
    });

    document.querySelectorAll("[data-list-form]").forEach(form => {

        form.addEventListener("submit", e => {

            e.preventDefault();

            const list = data.smartLists.find(
                l => l.id === Number(form.dataset.listForm)
            );

            const input = form.querySelector("input");

            if (list && input.value.trim()) {
                list.items.push({
                    text: input.value.trim(),
                    done: false
                });
            }

            saveData();
        });
    });

    document.querySelectorAll("[data-list-check]").forEach(checkbox => {

        checkbox.addEventListener("change", () => {

            const [id, index] = checkbox.dataset.listCheck.split(":");

            const list = data.smartLists.find(
                l => l.id === Number(id)
            );

            if (list && list.items[index]) {
                list.items[index].done = checkbox.checked;
            }

            saveData();
        });
    });
}


// LIFE MILESTONES

$("milestone-form").addEventListener("submit", e => {

    e.preventDefault();

    data.milestones.push({
        id: Date.now(),
        title: $("milestone-title").value.trim(),
        date: $("milestone-date").value,
        detail: $("milestone-detail").value.trim()
    });

    e.target.reset();

    saveData();
});


function renderMilestones() {

    $("milestone-list").innerHTML = data.milestones.length
        ? data.milestones.slice().sort((a, b) =>
            (a.date || "9999").localeCompare(b.date || "9999")
        ).map(m => `
            <div class="milestone-item">
                <strong>${escapeHTML(m.title)}</strong>
                <p>${escapeHTML(m.date || "Date not set")} · ${escapeHTML(m.detail)}</p>

                <button class="text-btn" data-delete-milestone="${m.id}">
                    Remove
                </button>
            </div>
        `).join("")
        : '<p class="empty-message">Your milestones will appear here.</p>';

    document.querySelectorAll("[data-delete-milestone]").forEach(button => {

        button.addEventListener("click", () => {

            data.milestones = data.milestones.filter(
                m => m.id !== Number(button.dataset.deleteMilestone)
            );

            saveData();
        });
    });
}


// PROFILE STUDIO

function renderProfile() {

    $("profile-name").value = data.profile.name || "";
    $("profile-color").value = data.profile.color || "#79b9e8";

    $("profile-preview-name").textContent =
        data.profile.name || "FlowUp member";

    $("profile-preview-xp").textContent =
        data.xp + " XP earned";

    $("avatar-preview").textContent =
        (data.profile.name || "F").charAt(0).toUpperCase();

    $("avatar-preview").style.background =
        data.profile.color || "#79b9e8";
}


$("profile-save").addEventListener("click", () => {

    data.profile = {
        name: $("profile-name").value.trim(),
        color: $("profile-color").value
    };

    saveData();
});


// DARK MODE

function applyTheme() {

    document.body.classList.toggle(
        "dark",
        data.theme === "dark"
    );

    $("theme-toggle").innerHTML =
        data.theme === "dark"
            ? '<i class="fa-solid fa-sun"></i> Light mode'
            : '<i class="fa-solid fa-moon"></i> Dark mode';
}


$("theme-toggle").addEventListener("click", () => {

    data.theme = data.theme === "dark" ? "baby" : "dark";

    applyTheme();

    localStorage.setItem("flowupData", JSON.stringify(data));
});


// ACHIEVEMENTS

function renderAchievements() {

    const completed = data.tasks.filter(t => t.completed).length;
    const goals = data.goals.filter(g => g.completed).length;

    $("achievement-xp").textContent = data.xp;
    $("achievement-tasks").textContent = completed;
    $("achievement-goals").textContent = goals;
    $("achievement-focus").textContent = data.focusSessions;

    const badges = [
        ["First step", completed >= 1, "Complete your first task."],
        ["Task builder", completed >= 10, "Complete 10 tasks."],
        ["Goal getter", goals >= 5, "Complete 5 daily goals."],
        ["Focus starter", data.focusSessions >= 1, "Finish a focus session."],
        ["XP collector", data.xp >= 100, "Earn 100 XP."]
    ];

    $("badge-list").innerHTML = badges.map(b => `
        <div class="badge-card">
            <i class="fa-solid ${b[1] ? "fa-medal" : "fa-lock"}"></i>
            <h4>${b[0]}</h4>
            <p>${b[1] ? "Unlocked" : "Locked"} · ${b[2]}</p>
        </div>
    `).join("");
}


// UPDATE EVERYTHING

function updateEverything() {

    $("top-xp").textContent = data.xp;

    const completed = data.tasks.filter(t => t.completed).length;
    const total = data.tasks.length;

    $("dash-total").textContent = total;
    $("dash-completed").textContent = completed;

    const goals = data.goals.filter(g => g.date === today);
    const goalDone = goals.filter(g => g.completed).length;

    $("dash-goals").textContent =
        goalDone + "/" + goals.length;

    $("dash-habits").textContent =
        data.habits.filter(h => h.completed).length +
        "/" + data.habits.length;

    const percent = total
        ? Math.round(completed / total * 100)
        : 0;

    $("task-progress").style.width = percent + "%";
    $("task-progress-text").textContent = percent + "%";

    renderTasks();
    renderDashboardTasks();
    renderGoals();
    renderHabits();
    renderNotes();
    renderVision();
    renderChallenge();
    renderReflections();
    renderSmartLists();
    renderMilestones();
    renderAchievements();
    renderProfile();
}


// INITIALIZE

applyTheme();
displayTimer();
updateEverything();
