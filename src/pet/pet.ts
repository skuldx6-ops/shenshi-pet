import { emit, listen } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { PhysicalPosition, availableMonitors, getCurrentWindow } from "@tauri-apps/api/window";
import petImage from "../assets/pet-idle.png";
import eyeAnimation from "../assets/animations/eye.webp";
import drinkAnimation from "../assets/animations/drink.webp";
import lunchAnimation from "../assets/animations/lunch.webp";
import checkinAnimation from "../assets/animations/daka.webp";
import customAnimation from "../assets/animations/custom.webp";
import { collectDue, loadSettings, saveSettings, updateFocus } from "../reminders/schedule";
import type { ReminderEvent, ReminderKind } from "../reminders/schedule";
import { MAX_VISIBLE_REMINDERS, positionBubbleNearPet, resizeBubbleForReminders, showSettingsWindow } from "../shared/windows";

const ACTIVE_KEY = "shenshi-pet-active-reminder";
const animations: Record<ReminderKind, string> = {
  eye: eyeAnimation,
  drink: drinkAnimation,
  lunch: lunchAnimation,
  checkin: checkinAnimation,
  custom: customAnimation,
};
const displayMs: Record<ReminderKind, number> = {
  eye: 20_000,
  drink: 20_000,
  lunch: 45_000,
  checkin: 45_000,
  custom: 45_000,
};

export function startPet(root: HTMLElement): void {
  const pet = getCurrentWindow();
  let settings = loadSettings();
  const visible: ReminderEvent[] = [];
  const pending: ReminderEvent[] = [];
  const closeTimers = new Map<string, ReturnType<typeof setTimeout>>();
  let bubbleSync: Promise<void> = Promise.resolve();
  let playingKind: ReminderKind | null = null;
  let menuOpen = false;
  let pointerStart: { x: number; y: number } | null = null;
  let dragged = false;

  root.innerHTML = `
    <main class="pet-stage">
      <button class="pet-character" aria-label="申时桌宠：点击打开菜单，拖动可移动" title="点击打开菜单 · 拖动可移动">
        <img src="${petImage}" alt="蓝色闹钟桌宠" draggable="false" />
      </button>
      <nav class="quick-menu" hidden aria-label="桌宠菜单">
        <button data-action="focus"></button>
        <button data-action="settings">提醒设置</button>
        <button data-action="lunch">测试午饭提醒</button>
        <button data-action="hide">隐藏桌宠</button>
      </nav>
      <span class="focus-badge" hidden>专注中</span>
    </main>`;

  const character = root.querySelector<HTMLButtonElement>(".pet-character")!;
  const characterImage = character.querySelector<HTMLImageElement>("img")!;
  const menu = root.querySelector<HTMLElement>(".quick-menu")!;
  const focusBadge = root.querySelector<HTMLElement>(".focus-badge")!;

  function render(): void {
    menu.hidden = !menuOpen;
    menu.querySelector<HTMLButtonElement>('[data-action="focus"]')!.textContent =
      settings.focusMode ? "退出专注模式" : "进入专注模式";
    focusBadge.hidden = !settings.focusMode;
    root.classList.toggle("is-focused", settings.focusMode);
    root.classList.toggle("is-reminding", visible.length > 0);
  }

  function updateCharacter(): void {
    const kind = visible[0]?.kind ?? null;
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
      const reminder = pending.shift()!;
      visible.push(reminder);
      closeTimers.set(reminder.id, setTimeout(() => removeReminder(reminder.id), displayMs[reminder.kind]));
    }
    updateCharacter();
    syncBubble();
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
    fillVisible();
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
      void pet.startDragging();
    }
  });
  character.addEventListener("pointerup", () => {
    if (!dragged) {
      menuOpen = !menuOpen;
      render();
    }
    pointerStart = null;
  });
  character.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    menuOpen = true;
    render();
  });
  menu.addEventListener("click", (event) => {
    const action = (event.target as HTMLElement).closest<HTMLButtonElement>("button")?.dataset.action;
    menuOpen = false;
    render();
    switch (action) {
      case "focus": toggleFocus(); break;
      case "settings": void showSettingsWindow(); break;
      case "lunch": testReminder("lunch"); break;
      case "hide": void pet.hide(); break;
    }
  });

  void listen<string>("reminder-closed", ({ payload }) => removeReminder(payload));
  void listen("settings-changed", () => {
    settings = loadSettings();
    render();
  });
  void listen("tray-toggle-focus", toggleFocus);
  void listen<ReminderKind>("preview-reminder", ({ payload }) => testReminder(payload));
  void pet.onMoved(({ payload }) => {
    settings.petPosition = { x: payload.x, y: payload.y };
    saveSettings(settings);
    if (visible.length) void positionBubbleNearPet();
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
  tick();
  setInterval(tick, 5_000);
  window.addEventListener("focus", tick);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
}
