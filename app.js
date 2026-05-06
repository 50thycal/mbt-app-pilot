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
  try { list = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch (_) {}
  list.push(entry);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch (_) {}
}

function complete(feedback) {
  saveCheckin(feedback);
  show("done");
}

function reset() {
  current = null;
  show("checkin");
}

// ---------- Push reminders ----------

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

async function getRegistration() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch (err) {
    console.error('SW register failed', err);
    return null;
  }
}

async function currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration('/');
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

function setRemindersUI({ status, action, hint, showTest }) {
  $("#reminders-status").textContent = status;
  const toggle = $("#reminders-toggle");
  if (action) {
    toggle.textContent = action.label;
    toggle.disabled = !!action.disabled;
    toggle.dataset.mode = action.mode;
    toggle.classList.toggle('hidden', false);
  } else {
    toggle.classList.add('hidden');
  }
  const testBtn = $("#reminders-test");
  testBtn.classList.toggle('hidden', !showTest);
  testBtn.disabled = false;
  testBtn.textContent = 'Send test reminder';
  const hintEl = $("#reminders-hint");
  if (hint) {
    hintEl.textContent = hint;
    hintEl.classList.remove('hidden');
  } else {
    hintEl.classList.add('hidden');
  }
}

async function refreshRemindersUI() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    setRemindersUI({
      status: 'Reminders not supported on this browser.',
      action: null
    });
    return;
  }

  if (!isStandalone()) {
    setRemindersUI({
      status: 'Reminders need the home-screen app.',
      action: null,
      hint: 'On iPhone: tap Share → Add to Home Screen, then open it from there.'
    });
    return;
  }

  if (Notification.permission === 'denied') {
    setRemindersUI({
      status: 'Notifications are blocked.',
      action: null,
      hint: 'Enable in iOS Settings → Notifications → Awareness.'
    });
    return;
  }

  const sub = await currentSubscription();
  if (sub) {
    setRemindersUI({
      status: 'Reminders on.',
      action: { label: 'Turn off', mode: 'off' },
      showTest: true
    });
  } else {
    setRemindersUI({
      status: 'Reminders off.',
      action: { label: 'Turn on gentle reminders', mode: 'on' }
    });
  }
}

async function enableReminders() {
  try {
    const reg = await getRegistration();
    if (!reg) throw new Error('Service worker unavailable');
    await navigator.serviceWorker.ready;

    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      await refreshRemindersUI();
      return;
    }

    const res = await fetch('/api/vapid');
    if (!res.ok) throw new Error('Could not load VAPID key');
    const { publicKey } = await res.json();
    if (!publicKey) throw new Error('Server has no VAPID key configured');

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });

    const r = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub)
    });
    if (!r.ok) throw new Error('Server rejected subscription');

    await refreshRemindersUI();
  } catch (err) {
    console.error(err);
    setRemindersUI({
      status: 'Could not turn on reminders.',
      action: { label: 'Try again', mode: 'on' },
      hint: err.message
    });
  }
}

async function sendTestReminder() {
  const btn = $("#reminders-test");
  const hintEl = $("#reminders-hint");
  btn.disabled = true;
  btn.textContent = 'Sending…';
  hintEl.classList.add('hidden');
  try {
    const sub = await currentSubscription();
    if (!sub) throw new Error('No active subscription');
    const r = await fetch('/api/test-ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    btn.textContent = 'Sent — check your lock screen';
    setTimeout(() => { btn.textContent = 'Send test reminder'; btn.disabled = false; }, 4000);
  } catch (err) {
    console.error(err);
    btn.textContent = 'Send test reminder';
    btn.disabled = false;
    hintEl.textContent = 'Could not send: ' + err.message;
    hintEl.classList.remove('hidden');
  }
}

async function disableReminders() {
  try {
    const sub = await currentSubscription();
    if (sub) {
      await fetch('/api/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint })
      });
      await sub.unsubscribe();
    }
    await refreshRemindersUI();
  } catch (err) {
    console.error(err);
  }
}

function bind() {
  $$(".feedback-btn").forEach(btn => {
    btn.addEventListener("click", () => complete(btn.dataset.feedback));
  });
  $("#skip-btn").addEventListener("click", () => complete(null));
  $("#continue-btn").addEventListener("click", () => complete(null));
  $("#again-btn").addEventListener("click", reset);

  $("#reminders-toggle").addEventListener("click", (e) => {
    const mode = e.currentTarget.dataset.mode;
    if (mode === 'on') enableReminders();
    else if (mode === 'off') disableReminders();
  });

  $("#reminders-test").addEventListener("click", sendTestReminder);
}

renderStates();
bind();
show("checkin");
refreshRemindersUI();
