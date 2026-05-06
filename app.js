const STATES = [
  {
    id: "focused",
    label: "Focused",
    message: "Clear, directed attention.",
    action: null
  },
  {
    id: "wandering",
    label: "Wandering",
    message: "Notice where your attention drifted.",
    action: "Take one conscious breath."
  },
  {
    id: "looping",
    label: "Looping",
    message: "You may be stuck in repetitive thought.",
    action: "Observe the thought without continuing it."
  },
  {
    id: "reacting",
    label: "Reacting",
    message: "Emotion may be driving attention right now.",
    action: "Pause before continuing."
  },
  {
    id: "overstimulated",
    label: "Overstimulated",
    message: "Your attention may be overloaded.",
    action: "Reduce input for 30 seconds."
  },
  {
    id: "present",
    label: "Aware / Present",
    message: "Good. Stay with this moment a little longer.",
    action: null
  }
];

const STORAGE_KEY = "awareness_checkins_v1";

let current = null;

function $(s) { return document.querySelector(s); }
function $$(s) { return Array.from(document.querySelectorAll(s)); }

function show(name) {
  $$(".screen").forEach(el => {
    el.classList.toggle("hidden", el.dataset.screen !== name);
  });
  window.scrollTo(0, 0);
}

function renderStates() {
  const container = $("#states");
  container.innerHTML = "";
  STATES.forEach(s => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "state-btn";
    btn.textContent = s.label;
    btn.addEventListener("click", () => selectState(s.id));
    container.appendChild(btn);
  });
}

function selectState(id) {
  current = STATES.find(s => s.id === id);
  $("#aware-state").textContent = current.label;
  $("#aware-message").textContent = current.message;

  const actionEl = $("#aware-action");
  const feedbackBlock = $("#feedback-block");
  const continueBtn = $("#continue-btn");

  if (current.action) {
    actionEl.textContent = current.action;
    actionEl.classList.remove("hidden");
    feedbackBlock.classList.remove("hidden");
    continueBtn.classList.add("hidden");
  } else {
    actionEl.classList.add("hidden");
    feedbackBlock.classList.add("hidden");
    continueBtn.classList.remove("hidden");
  }

  show("awareness");
}

function saveCheckin(feedback) {
  const entry = {
    timestamp: new Date().toISOString(),
    state: current.id,
    stateLabel: current.label,
    intervention: current.action || null,
    feedback: feedback || null
  };
  let list = [];
  try {
    list = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch (_) {
    list = [];
  }
  list.push(entry);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (_) {
    // Storage may be unavailable — fail quietly.
  }
}

function complete(feedback) {
  saveCheckin(feedback);
  show("done");
}

function reset() {
  current = null;
  show("checkin");
}

function bind() {
  $$(".feedback-btn").forEach(btn => {
    btn.addEventListener("click", () => complete(btn.dataset.feedback));
  });
  $("#skip-btn").addEventListener("click", () => complete(null));
  $("#continue-btn").addEventListener("click", () => complete(null));
  $("#again-btn").addEventListener("click", reset);
}

renderStates();
bind();
show("checkin");
