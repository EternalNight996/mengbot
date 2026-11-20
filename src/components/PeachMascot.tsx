import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

const STYLE = `
@keyframes pm-breathe { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-2px) scale(1.015); } }
@keyframes pm-sway { 0%,100% { transform: rotate(-3deg); } 50% { transform: rotate(4deg); } }
@keyframes pm-sparkle { 0% { opacity: 0; transform: scale(.4); } 30% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(1.5); } }
.pm-breathe { animation: pm-breathe 3.6s ease-in-out infinite; transform-origin: 100px 150px; }
.pm-leaf { animation: pm-sway 4.2s ease-in-out infinite; transform-origin: 100px 58px; }
.pm-pressed { animation: pm-press .32s cubic-bezier(.2,1.6,.4,1); }
@keyframes pm-press { 0% { transform: scale(1); } 40% { transform: scale(1.08,.92); } 70% { transform: scale(.96,1.04); } 100% { transform: scale(1); } }
.pm-sparkle { animation: pm-sparkle .7s ease-out both; }
@media (prefers-reduced-motion: reduce) {
  .pm-breathe, .pm-leaf, .pm-pressed, .pm-sparkle { animation: none !important; }
}
`;

/** The peach mascot: a small, original character with a real click, blink, gaze and talking mouth. */
export function PeachMascot({
  size = 72,
  interactive = true,
  speaking = false,
  className,
  onSay,
}: {
  size?: number;
  interactive?: boolean;
  speaking?: boolean;
  className?: string;
  onSay?: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const [blink, setBlink] = useState(false);
  const [wink, setWink] = useState(false);
  const [sparkle, setSparkle] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(false);
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  const alive = useRef(true);
  const pressTimer = useRef<number | null>(null);
  const winkTimer = useRef<number | null>(null);
  const sparkleTimer = useRef<number | null>(null);

  useEffect(() => {
    alive.current = true;
    let timer = 0;
    const loop = () => {
      timer = window.setTimeout(() => {
        if (!alive.current) return;
        setBlink(true);
        window.setTimeout(() => alive.current && setBlink(false), 120);
        loop();
      }, 3600 + Math.random() * 2600);
    };
    loop();
    return () => {
      alive.current = false;
      window.clearTimeout(timer);
      if (pressTimer.current) window.clearTimeout(pressTimer.current);
      if (winkTimer.current) window.clearTimeout(winkTimer.current);
      if (sparkleTimer.current) window.clearTimeout(sparkleTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!speaking) return;
    const timer = window.setInterval(() => setMouthOpen((open) => !open), 130);
    return () => {
      window.clearInterval(timer);
      setMouthOpen(false);
    };
  }, [speaking]);

  const press = () => {
    if (!interactive) return;
    setPressed(true);
    setWink(true);
    setSparkle(true);
    onSay?.();
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    if (winkTimer.current) window.clearTimeout(winkTimer.current);
    if (sparkleTimer.current) window.clearTimeout(sparkleTimer.current);
    pressTimer.current = window.setTimeout(() => setPressed(false), 340);
    winkTimer.current = window.setTimeout(() => setWink(false), 720);
    sparkleTimer.current = window.setTimeout(() => setSparkle(false), 760);
  };

  const move = (event: React.PointerEvent<HTMLSpanElement>) => {
    if (!interactive) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * 2 - 1;
    const y = ((event.clientY - box.top) / box.height) * 2 - 1;
    setGaze({ x: Math.max(-1, Math.min(1, x)) * 4, y: Math.max(-1, Math.min(1, y)) * 3 });
  };

  const Tag = interactive ? "button" : "span";
  return (
    <span className={cn("inline-flex shrink-0", className)}>
      <style>{STYLE}</style>
      <Tag
        type={interactive ? "button" : undefined}
        aria-label={interactive ? "和 MengBot 桃子互动" : undefined}
        onClick={interactive ? press : undefined}
        onPointerMove={interactive ? move : undefined}
        onPointerLeave={interactive ? () => setGaze({ x: 0, y: 0 }) : undefined}
        className={cn("group relative block shrink-0 rounded-[22%] outline-none focus-visible:ring-2 focus-visible:ring-accent/70", pressed && "pm-pressed")}
        style={{ width: size, height: size }}
      >
        <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-hidden={!interactive}>
          <defs>
            <linearGradient id="pm-peach" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#FFE18A" />
              <stop offset=".48" stopColor="#FFA39A" />
              <stop offset="1" stopColor="#A8D89B" />
            </linearGradient>
            <linearGradient id="pm-face" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFFDF8" />
              <stop offset="1" stopColor="#F8EDE0" />
            </linearGradient>
            <filter id="pm-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#120820" floodOpacity=".28" />
            </filter>
          </defs>
          <ellipse cx="100" cy="183" rx="54" ry="7" fill="#120820" opacity=".22" />
          <g className="pm-breathe">
            <path d="M54 61C54 48 64 38 77 38H123C136 38 146 48 146 61V151C146 164 136 174 123 174H77C64 174 54 164 54 151Z" fill="url(#pm-peach)" filter="url(#pm-shadow)" />
            <path d="M68 73C68 64 75 57 84 57H116C125 57 132 64 132 73V146C132 155 125 162 116 162H84C75 162 68 155 68 146Z" fill="url(#pm-face)" />
            <g className="pm-leaf">
              <path d="M100 46C92 32 77 28 68 33C73 45 86 51 100 46Z" fill="#7EBA62" />
              <path d="M100 46C108 30 123 25 133 30C128 43 114 50 100 46Z" fill="#9BCB76" />
              <path d="M100 46V34" stroke="#5A9A49" strokeWidth="4" strokeLinecap="round" />
            </g>
            <g transform={`translate(${gaze.x} ${gaze.y})`}>
              <ellipse cx="84" cy="108" rx="9" ry={blink ? 1.5 : 12} fill="#2B1727" />
              {!blink && <ellipse cx="81.5" cy="103" rx="2.4" ry="3.2" fill="#fff" opacity=".9" />}
              {wink ? (
                <path d="M108 108C112 103 117 103 121 108" fill="none" stroke="#2B1727" strokeWidth="3.6" strokeLinecap="round" />
              ) : (
                <>
                  <ellipse cx="116" cy="108" rx="9" ry={blink ? 1.5 : 12} fill="#2B1727" />
                  {!blink && <ellipse cx="113.5" cy="103" rx="2.4" ry="3.2" fill="#fff" opacity=".9" />}
                </>
              )}
            </g>
            <ellipse cx="70" cy="124" rx="8" ry="4" fill="#FF8B93" opacity=".55" />
            <ellipse cx="130" cy="124" rx="8" ry="4" fill="#FF8B93" opacity=".55" />
            {speaking && mouthOpen ? (
              <ellipse cx="100" cy="138" rx="12" ry="8" fill="#2B1727" />
            ) : (
              <path d="M88 137C94 144 106 144 112 137" fill="none" stroke="#2B1727" strokeWidth="3.8" strokeLinecap="round" />
            )}
          </g>
          {sparkle && (
            <g className="pm-sparkle" fill="#FFD86B">
              <path d="M32 62L35 54L38 62L46 65L38 68L35 76L32 68L24 65Z" />
              <path d="M164 132L166 127L168 132L173 134L168 136L166 141L164 136L159 134Z" />
            </g>
          )}
        </svg>
      </Tag>
    </span>
  );
}
