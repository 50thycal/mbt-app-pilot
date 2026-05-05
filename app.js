const STATES = [
  {
    id: "focused",
    label: "Focused",
    message: "You've got clear, directed attention.",
    actions: [
      "Stay with what you're doing — set a 25-minute timer to lock it in.",
      "Note one thing that helped you get here.",
      "Pick the next concrete step before the focus fades."
    ]
  },
  {
    id: "wandering",
    label: "Wandering",
    message: "Your attention is drifting.",
    actions: [
      "Pick one task and start a 2-minute timer.",
      "Write down what you intended to do, then begin.",
      "Stand up, stretch, and return with one clear next step."
    ]
  },
  {
    id: "looping",
    label: "Looping",
    message: "You're likely stuck in a thought loop.",
    actions: [
      "Write the thought down once, then stop engaging with it.",
      "Change your environment — different room, outside, or new view.",
      "Interrupt physically: stand up and walk for 60 seconds."
    ]
  },
  {
    id: "overstimulated",
    label: "Overstimulated",
    message: "Too much input — you're scattered.",
    actions: [
      "Reduce input: silence, step away from screens for 60 seconds.",
      "Close every app or tab except the one that matters.",
      "Breathe slowly for 30 seconds — longer out than in."
    ]
  },
  {
    id: "triggered",
    label: "Emotionally Triggered",
    message: "A strong emotional reaction is online.",
    actions: [
      "Name the emotion out loud or on paper.",
      "Pause before reacting — wait 60 seconds before any reply.",
      "Take 3 slow breaths before deciding what's next."
    ]
  },
  {
    id: "clear",
    label: "Clear / Aware",
    message: "Calm, observing, present.",
    actions: [
      "Stay with this for a moment — don't rush past it.",
      "Note what helped you arrive here.",
      "Pick something meaningful to do from this state."
    ]
  }
];

const STORAGE_KEY = "csl_checkins_v1";

const session = {
  state: null,
  actionIndex: 0,
  feedback: null,
  startedAt: null
};

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return Array.from(document.querySelectorAll(sel)); }

function show(name) {
  $$(".screen").forEach(s => {
    s.classList.toggle("hidden", s.dataset.screen !== name);
  });
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
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
  session.state = STATES.find(s => s.id === id);
  session.actionIndex = 0;
  session.feedback = null;
  session.startedAt = Date.now();
  renderAction();
  show("action");
}

function renderAction() {
  const s = session.state;
  $("#action-state-name").textContent = s.label;
  $("#action-message").textContent = s.message;
  $("#action-text").textContent = s.actions[session.actionIndex];
  const hasMore = s.actions.length > 1;
  $("#another-btn").style.display = hasMore ? "" : "none";
}

function cycleAction() {
  const total = session.state.actions.length;
  session.actionIndex = (session.actionIndex + 1) % total;
  renderAction();
}

function recordFeedback(value) {
  session.feedback = value;
  show("reflection");
  $("#reflection-text").value = "";
  $("#reflection-text").focus();
}

function saveCheckin(reflection) {
  const entry = {
    timestamp: new Date().toISOString(),
    state: session.state.id,
    stateLabel: session.state.label,
    action: session.state.actions[session.actionIndex],
    feedback: session.feedback,
    reflection: reflection || ""
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
    // Storage may be unavailable (private mode, etc.) — fail quietly.
  }
}

function reset() {
  session.state = null;
  session.actionIndex = 0;
  session.feedback = null;
  session.startedAt = null;
  show("checkin");
}

function bind() {
  $("#another-btn").addEventListener("click", cycleAction);
  $("#tried-btn").addEventListener("click", () => show("feedback"));
  $("#back-btn").addEventListener("click", reset);

  $$(".feedback-btn").forEach(btn => {
    btn.addEventListener("click", () => recordFeedback(btn.dataset.feedback));
  });

  $("#save-btn").addEventListener("click", () => {
    saveCheckin($("#reflection-text").value.trim());
    show("done");
  });
  $("#skip-btn").addEventListener("click", () => {
    saveCheckin("");
    show("done");
  });

  $("#again-btn").addEventListener("click", reset);
}

renderStates();
bind();
show("checkin");
