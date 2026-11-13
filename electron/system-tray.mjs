// Retain the Windows notification-area identity across app restarts.
export function createSystemTray({ Tray, Menu, nativeImage, iconPath, getWindow, onQuit, labels }) {
  const tray = new Tray(nativeImage.createFromPath(iconPath).resize({ width: 20, height: 20 }),
    "889af657-21b5-4ec9-b5d0-cb798cbdfd30");
  let hidden = false;
  const show = () => {
    const win = getWindow();
    if (!win || win.isDestroyed()) return false;
    hidden = false;
    win.setSkipTaskbar(false);
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    return true;
  };
  // The tray's words follow the language this desktop shows: main rebuilds the menu when it changes (electron/tray-text.mjs).
  let text = labels && typeof labels.open === "string" && typeof labels.quit === "string"
    ? labels
    : { open: "Open MengBot", quit: "Quit MengBot" };
  const applyMenu = () => tray.setContextMenu(Menu.buildFromTemplate([
    { label: text.open, click: show },
    { type: "separator" },
    { label: text.quit, click: onQuit },
  ]));
  tray.setToolTip("MengBot");
  applyMenu();
  tray.on("click", show);
  tray.on("double-click", show);
  return {
    show,
    hide(win) { hidden = true; win.setSkipTaskbar(true); win.hide(); },
    isHidden() { return hidden; },
    windowShown(win) { hidden = false; win.setSkipTaskbar(false); },
    /** Rebuilds the menu in another language; a wrong or unchanged pair is ignored. */
    setLabels(next) {
      if (!next || typeof next.open !== "string" || typeof next.quit !== "string") return;
      if (next.open === text.open && next.quit === text.quit) return;
      text = next;
      applyMenu();
    },
    destroy() { if (!tray.isDestroyed()) tray.destroy(); },
  };
}
