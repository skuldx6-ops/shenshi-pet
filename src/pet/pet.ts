import { emit, listen } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { LogicalSize, PhysicalPosition, availableMonitors, getCurrentWindow } from "@tauri-apps/api/window";
import { enable as enableAutostart, isEnabled as isAutostartEnabled } from "@tauri-apps/plugin-autostart";
import petImage from "../assets/pet-idle.png";
import eyeAnimation from "../assets/animations/eye.webp";
import drinkAnimation from "../assets/animations/drink.webp";
import lunchAnimation from "../assets/animations/lunch.webp";
import checkinAnimation from "../assets/animations/daka.webp";
import customAnimation from "../assets/animations/custom.webp";
import { collectDue, loadSettings, saveSettings, updateFocus } from "../reminders/schedule";
import type { ReminderEvent, ReminderKind } from "../reminders/schedule";
import { reminderDurationMs } from "../reminders/durations";
import { closestEdge, peekX, revealX } from "./edge";
import type { EdgeSide, Rect } from "./edge";
import { MAX_VISIBLE_REMINDERS, positionBubbleNearPet, positionMenuNearPet, resizeBubbleForReminders } from "../shared/windows";

const ACTIVE_KEY = "shenshi-pet-active-reminder";
const AUTOSTART_ONCE_KEY = "shenshi-pet-autostart-initialized-v1";
const animations: Record<ReminderKind, string> = {
  eye: eyeAnimation,
  drink: drinkAnimation,
  lunch: lunchAnimation,
  checkin: checkinAnimation,
  custom: customAnimation,
};

export function startPet(root: HTMLElement): void {
  const pet = getCurrentWindow();
  let settings = loadSettings();
  const visible: ReminderEvent[] = [];
  const pending: ReminderEvent[] = [];
  const closeTimers = new Map<string, ReturnType<typeof setTimeout>>();
  let bubbleSync: Promise<void> = Promise.resolve();
  let playingKind: ReminderKind | null = null;
  let lastMenuCloseAt = 0;
  let pointerStart: { x: number; y: number } | null = null;
  let dragged = false;
  let isPeeking = false;
  let autoMoving = false;
  let peekSide: EdgeSide = "left";
  let peekScreen: Rect | null = null;
  let motionToken = 0;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  root.innerHTML = `
    <main class="pet-stage">
      <button class="pet-character" aria-label="申时桌宠：点击打开菜单，拖动可移动" title="点击打开菜单 · 拖动可移动">
        <img src="${petImage}" alt="蓝色闹钟桌宠" draggable="false" />
      </button>
      <span class="focus-badge" hidden>专注中</span>
    </main>`;

  const character = root.querySelector<HTMLButtonElement>(".pet-character")!;
  const characterImage = character.querySelector<HTMLImageElement>("img")!;
  const focusBadge = root.querySelector<HTMLElement>(".focus-badge")!;

  function render(): void {
    focusBadge.hidden = !settings.focusMode;
    root.classList.toggle("is-focused", settings.focusMode);
    root.classList.toggle("is-reminding", visible.length > 0);
    root.classList.toggle("is-peeking", isPeeking);
  }

  function schedulePeek(): void {
    if (idleTimer) clearTimeout(idleTimer);
    if (visible.length) return;
    idleTimer = setTimeout(() => { void enterPeek().catch((error) => {
      console.warn("Could not enter edge standby", error);
      isPeeking = false;
      autoMoving = false;
      root.classList.remove("is-walking");
      render();
    }); }, 120_000);
  }

  async function enterPeek(): Promise<void> {
    if (isPeeking || visible.length || dragged) return;
    if (!await pet.isVisible()) return;
    const menu = await WebviewWindow.getByLabel("menu");
    if (menu && await menu.isVisible()) { schedulePeek(); return; }
    const [position, size, monitors] = await Promise.all([pet.outerPosition(), pet.outerSize(), availableMonitors()]);
    const screen = monitors.find(({ position: origin, size: bounds }) =>
      position.x + size.width / 2 >= origin.x && position.x + size.width / 2 < origin.x + bounds.width &&
      position.y + size.height / 2 >= origin.y && position.y + size.height / 2 < origin.y + bounds.height
    ) ?? monitors[0];
    if (!screen) return;
    const petRect = { x: position.x, y: position.y, width: size.width, height: size.height };
    const screenRect = { x: screen.position.x, y: screen.position.y, width: screen.size.width, height: screen.size.height };
    peekScreen = screenRect;
    peekSide = closestEdge(petRect, screenRect);
    const targetX = peekX(petRect, screenRect, peekSide);
    const token = ++motionToken;
    isPeeking = true;
    autoMoving = true;
    root.classList.add("is-walking");
    render();
    for (let step = 1; step <= 12 && token === motionToken; step += 1) {
      const x = Math.round(position.x + (targetX - position.x) * step / 12);
      await pet.setPosition(new PhysicalPosition(x, position.y));
      await new Promise((resolve) => setTimeout(resolve, 45));
    }
    root.classList.remove("is-walking");
    if (token === motionToken) setTimeout(() => { if (token === motionToken) autoMoving = false; }, 200);
  }

  async function revealFromEdge(): Promise<void> {
    if (!isPeeking) return;
    const token = ++motionToken;
    isPeeking = false;
    autoMoving = true;
    root.classList.remove("is-walking");
    render();
    const [position, size] = await Promise.all([pet.outerPosition(), pet.outerSize()]);
    if (!peekScreen) { autoMoving = false; return; }
    const x = revealX(
      { x: position.x, y: position.y, width: size.width, height: size.height },
      peekScreen,
      peekSide,
    );
    await pet.setPosition(new PhysicalPosition(x, position.y));
    settings.petPosition = { x, y: position.y };
    saveSettings(settings);
    if (visible.length) await positionBubbleNearPet();
    setTimeout(() => { if (token === motionToken) autoMoving = false; }, 200);
    schedulePeek();
  }

  function updateCharacter(): void {
    const kind = visible[visible.length - 1]?.kind ?? null;
    if (kind !== playingKind) {
      playingKind = kind;
      characterImage.src = kind ? animations[kind] : petImage;
      characterImage.alt = kind ? `${kind} 提醒动作` : "蓝色闹钟桌宠";
    }
    render();
  }

  function syncBubble(): void {
    const snapshot = [...visible];
    if (snapshot.length) localStorage.setItem(ACTIVE_KEY, JSON.stringify(snapshot));
    else localStorage.removeItem(ACTIVE_KEY);
    bubbleSync = bubbleSync.then(async () => {
      const bubble = await WebviewWindow.getByLabel("bubble");
      if (!bubble) return;
      if (!snapshot.length) {
        await bubble.hide();
        return;
      }
      await resizeBubbleForReminders(snapshot.length);
      await positionBubbleNearPet();
      await bubble.show();
      await emit("reminders-show", snapshot);
    }).catch((error) => { console.error("Could not display reminder bubble", error); });
  }

  function fillVisible(): void {
    while (visible.length < MAX_VISIBLE_REMINDERS && pending.length) {
      const next = pending.shift()!;
      const reminder = { ...next, expiresAt: Date.now() + reminderDurationMs[next.kind] };
      visible.push(reminder);
      closeTimers.set(reminder.id, setTimeout(() => removeReminder(reminder.id), reminderDurationMs[reminder.kind]));
    }
    updateCharacter();
    syncBubble();
    schedulePeek();
  }

  function removeReminder(id: string): void {
    const index = visible.findIndex((reminder) => reminder.id === id);
    if (index < 0) return;
    clearTimeout(closeTimers.get(id));
    closeTimers.delete(id);
    visible.splice(index, 1);
    fillVisible();
  }

  function addReminders(reminders: ReminderEvent[]): void {
    if (!reminders.length) return;
    pending.push(...reminders);
    if (isPeeking) void revealFromEdge().catch((error) => {
      console.warn("Could not reveal pet for reminder", error);
      autoMoving = false;
    }).then(fillVisible);
    else fillVisible();
  }

  function tick(): void {
    const before = settings;
    const result = collectDue(settings);
    settings = result.settings;
    if (
      result.due.length ||
      before.nextEyeAt !== settings.nextEyeAt ||
      before.nextDrinkAt !== settings.nextDrinkAt
    ) saveSettings(settings);
    addReminders(result.due);
  }

  function toggleFocus(): void {
    settings = updateFocus(settings, !settings.focusMode);
    saveSettings(settings);
    render();
    void emit("settings-changed");
  }

  async function toggleMenu(forceOpen = false): Promise<void> {
    const menu = await WebviewWindow.getByLabel("menu");
    if (!menu) return;
    if (!forceOpen && await menu.isVisible()) {
      await menu.hide();
      return;
    }
    await menu.setSize(new LogicalSize(188, 330));
    await positionMenuNearPet(188);
    await emit("menu-refresh");
    await menu.show();
    await menu.setFocus();
  }

  async function initializeAutostartOnce(): Promise<void> {
    if (!import.meta.env.PROD || localStorage.getItem(AUTOSTART_ONCE_KEY)) return;
    try {
      if (!(await isAutostartEnabled())) await enableAutostart();
      localStorage.setItem(AUTOSTART_ONCE_KEY, "done");
    } catch (error) {
      console.warn("Could not enable login startup", error);
    }
  }

  function testReminder(kind: ReminderKind): void {
    const titles: Record<ReminderKind, string> = {
      eye: "护眼休息",
      drink: "H₂O Time",
      lunch: "午饭时间到啦",
      checkin: "叮～打卡",
      custom: "自定义提醒",
    };
    addReminders([{
      id: `preview:${crypto.randomUUID()}`,
      kind,
      title: titles[kind],
      body: {
        eye: "给瞳孔放个短假，让世界重回清晰。",
        drink: "吨吨吨！干杯！",
        lunch: "需求可以再改，干饭不能迟到。",
        checkin: "打卡，是对贫穷最起码的尊重。",
        custom: "这是一条提醒预览。",
      }[kind],
      at: Date.now(),
    }]);
  }

  character.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    pointerStart = { x: event.screenX, y: event.screenY };
    dragged = false;
  });
  character.addEventListener("pointermove", (event) => {
    if (!pointerStart || dragged || !(event.buttons & 1)) return;
    const delta = Math.hypot(event.screenX - pointerStart.x, event.screenY - pointerStart.y);
    if (delta > 5) {
      dragged = true;
      motionToken += 1;
      isPeeking = false;
      autoMoving = false;
      root.classList.remove("is-walking");
      render();
      void pet.startDragging();
    }
  });
  character.addEventListener("pointerup", () => {
    if (!dragged && Date.now() - lastMenuCloseAt > 250) void revealFromEdge().catch((error) => {
      console.warn("Could not reveal pet for menu", error);
      autoMoving = false;
    }).then(() => toggleMenu());
    pointerStart = null;
    dragged = false;
    schedulePeek();
  });
  character.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    void toggleMenu(true);
  });

  void listen<string>("reminder-closed", ({ payload }) => removeReminder(payload));
  void listen("settings-changed", () => {
    settings = loadSettings();
    render();
  });
  void listen("tray-toggle-focus", toggleFocus);
  void listen("menu-hide-pet", () => { void pet.hide(); });
  void listen("menu-closed", () => { lastMenuCloseAt = Date.now(); });
  void listen<ReminderKind>("preview-reminder", ({ payload }) => testReminder(payload));
  void pet.onMoved(({ payload }) => {
    if (autoMoving || isPeeking) return;
    settings.petPosition = { x: payload.x, y: payload.y };
    saveSettings(settings);
    if (visible.length) void positionBubbleNearPet();
    void positionMenuNearPet(188);
    schedulePeek();
  });
  void (async () => {
    const saved = settings.petPosition;
    if (!saved) return;
    const monitors = await availableMonitors();
    const visible = monitors.some(({ position, size }) =>
      saved.x >= position.x && saved.x < position.x + size.width &&
      saved.y >= position.y && saved.y < position.y + size.height
    );
    if (visible) await pet.setPosition(new PhysicalPosition(saved.x, saved.y));
  })();

  render();
  schedulePeek();
  void initializeAutostartOnce();
  tick();
  setInterval(tick, 5_000);
  window.addEventListener("focus", tick);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
}
