import type { MascotBody } from "../../shared/mascot-bodies";

/**
 * The peach the default bot wears: the fruit-theme icon's ring, cream face plate and leaf,
 * drawn rather than shipped as a picture, so the shared face keeps blinking and showing
 * expressions. Geometry matches the squircle body, so the face sits where every other
 * body puts it.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
export const PEACH_SILHOUETTE = {
  id: "peach",
  name: "Peach",
  fit: "translate(0 0) scale(1.142705)",
  body: `
    <defs>
      <linearGradient id="omb-peach-ring" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#F9E9A6"/>
        <stop offset="0.38" stop-color="#FFCBA3"/>
        <stop offset="0.66" stop-color="#F4A08C"/>
        <stop offset="1" stop-color="#C7D98A"/>
      </linearGradient>
      <radialGradient id="omb-peach-face" cx="0.42" cy="0.32" r="0.85">
        <stop offset="0" stop-color="#FFFDF9"/>
        <stop offset="1" stop-color="#F5E4D5"/>
      </radialGradient>
      <radialGradient id="omb-peach-blush" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="#FFA79E" stop-opacity="0.75"/>
        <stop offset="1" stop-color="#FFA79E" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="omb-peach-leaf" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#B7DC8F"/>
        <stop offset="1" stop-color="#6F9E4F"/>
      </linearGradient>
    </defs>
    <path fill="url(#omb-peach-ring)" d="M50 0C83.33333 0 116.66667 0 150 0C177.61424 0 200 22.38576 200 50C200 83.33333 200 116.66667 200 150C200 177.61424 177.61424 200 150 200C116.66667 200 83.33333 200 50 200C22.38576 200 0 177.61424 0 150C0 116.66667 0 83.33333 0 50C0 22.38576 22.38576 0 50 0Z"/>
    <path fill="url(#omb-peach-face)" d="M82 32H128C150.09139 32 168 49.90861 168 72V128C168 150.09139 150.09139 168 128 168H82C59.90861 168 42 150.09139 42 128V72C42 49.90861 59.90861 32 82 32Z"/>
    <ellipse cx="74" cy="108" rx="17" ry="13" fill="url(#omb-peach-blush)"/>
    <ellipse cx="126" cy="108" rx="17" ry="13" fill="url(#omb-peach-blush)"/>
    <path fill="url(#omb-peach-leaf)" d="M97 14C88 -1 71 -7 62 1C70 13 85 19 97 14Z"/>
    <path fill="url(#omb-peach-leaf)" d="M103 14C112 -1 129 -7 138 1C130 13 115 19 103 14Z"/>
    <path d="M100 18C100 12 100 7 100 3" stroke="#7E9C5C" stroke-width="3.2" stroke-linecap="round" fill="none"/>
  `,
  clip: '<path d="M50 0C83.33333 0 116.66667 0 150 0C177.61424 0 200 22.38576 200 50C200 83.33333 200 116.66667 200 150C200 177.61424 177.61424 200 150 200C116.66667 200 83.33333 200 50 200C22.38576 200 0 177.61424 0 150C0 116.66667 0 83.33333 0 50C0 22.38576 22.38576 0 50 0Z"/>',
  anchor: { x: 111.78, y: 111.79, scale: 0.791 },
} as unknown as MascotBody;
