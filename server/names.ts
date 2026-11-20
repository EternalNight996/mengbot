const NAMES = [
  "Scout", "Pixel", "Atlas", "Nova", "Juno", "Koda", "Miso", "Mochi",
  "Biscuit", "Pepper", "Clover", "Ember", "Willow", "Comet", "Orbit", "Echo",
  "Indigo", "Sage", "Zephyr", "Poppy", "Maple", "Cosmo", "Luna", "Otto",
  "Ivy", "Finch", "Wren", "Basil", "Hazel", "Nimbus", "Onyx", "Pearl",
  "Quill", "Rocket", "Sunny", "Tango", "Vega", "Waffle", "Ziggy", "Noodle",
  "Pickle", "Churro", "Panko", "Dumpling", "Pesto", "Olive", "Cocoa", "Taffy",
  "Bramble", "Fig", "Juniper", "Moss", "Pebble", "Rio", "Skye", "Tuli",
  "Ursa", "Yuki", "Zuko", "Momo", "Kiwi", "Plum", "Sprout", "Turnip",
];

const CHINESE_NAMES = [
  "小星", "小光", "小云", "小禾", "小鹿", "小岚", "小舟", "小果",
  "小豆", "小满", "小夏", "小秋", "小冬", "小森", "小溪", "小川",
  "小野", "小石", "小竹", "小梅", "小兰", "小荷", "小鱼", "小鸟",
  "小虎", "小兔", "小龙", "小马", "小牛", "小羊", "小团", "小圆",
];

function freeName(pool: readonly string[], taken: Set<string>): string {
  const free = pool.filter((name) => !taken.has(name.trim().toLowerCase()));
  if (free.length > 0) return free[Math.floor(Math.random() * free.length)]!;
  const base = pool[Math.floor(Math.random() * pool.length)]!;
  for (let i = 2; ; i++) {
    if (!taken.has(`${base.toLowerCase()} ${i}`)) return `${base} ${i}`;
  }
}

export function pickBotName(taken: Iterable<string>, language?: string): string {
  const used = new Set([...taken].map((name) => name.trim().toLowerCase()));
  return freeName(/^zh(?:-|$)/i.test(language?.trim() ?? "") ? CHINESE_NAMES : NAMES, used);
}

const PICKED = new Set([...NAMES, ...CHINESE_NAMES].map((name) => name.toLowerCase()));
const ENGLISH_PICKED = new Set(NAMES.map((name) => name.toLowerCase()));

/** A name pickBotName could have given ("Pesto", "Pesto 2"): New bot sends one from /api/bot-defaults' suggestedName. */
export function isPickedBotName(name: string): boolean {
  return PICKED.has(name.trim().toLowerCase().replace(/ \d+$/, ""));
}

/** An untouched name from the English pool, safe to replace with a Chinese one when the app is Chinese. */
export function isEnglishPickedName(name: string): boolean {
  return ENGLISH_PICKED.has(name.trim().toLowerCase().replace(/ \d+$/, ""));
}
