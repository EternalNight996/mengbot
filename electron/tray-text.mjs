// The tray's two actions, in the language this desktop shows: the one picked in Settings, else this computer's.
// Main has no locale packs of its own (the page loads those), so the few words the tray needs live here.

const LABELS = {
  en: { open: "Open MengBot", quit: "Quit MengBot" },
  zh: { open: "打开 MengBot", quit: "退出 MengBot" },
  "zh-tw": { open: "開啟 MengBot", quit: "結束 MengBot" },
  ja: { open: "MengBot を開く", quit: "MengBot を終了" },
  ko: { open: "MengBot 열기", quit: "MengBot 종료" },
  ru: { open: "Открыть MengBot", quit: "Выйти из MengBot" },
  uk: { open: "Відкрити MengBot", quit: "Вийти з MengBot" },
  "pt-br": { open: "Abrir o MengBot", quit: "Sair do MengBot" },
  it: { open: "Apri MengBot", quit: "Esci da MengBot" },
  de: { open: "MengBot öffnen", quit: "MengBot beenden" },
  es: { open: "Abrir MengBot", quit: "Salir de MengBot" },
  fr: { open: "Ouvrir MengBot", quit: "Quitter MengBot" },
  tr: { open: "MengBot'u aç", quit: "MengBot'tan çık" },
  pl: { open: "Otwórz MengBot", quit: "Zakończ MengBot" },
  vi: { open: "Mở MengBot", quit: "Thoát MengBot" },
  hi: { open: "MengBot खोलें", quit: "MengBot बंद करें" },
};

/** The shipped language nearest `tag` ("zh-CN" → zh, "pt-BR" → pt-br), English when none matches. */
export function trayLanguage(tag) {
  const value = typeof tag === "string" ? tag.trim().toLowerCase() : "";
  if (!value) return "en";
  if (LABELS[value]) return value;
  if (value.startsWith("zh")) return /(^|-)tw\b|hk|mo/.test(value) ? "zh-tw" : "zh";
  if (value.startsWith("pt")) return "pt-br";
  const base = value.split("-")[0];
  return LABELS[base] ? base : "en";
}

/** The tray's "open" and "quit" words for `tag`. */
export function trayText(tag) {
  return LABELS[trayLanguage(tag)];
}
