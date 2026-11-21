// Own illustrations for E10 „Pierwsza pomoc” (one scene per adult step).
// Drawn from scratch for this project: simple figures (head, torso, arms, legs, mitten hands),
// no ERC/PRR or vendor graphics. Colours come only from CSS variables (tokens.css).
// Static constant markup – no user input ever reaches these strings.

export type AidScene =
  | 'safe' | 'shake' | 'call' | 'breath' | 'send' | 'compress' | 'pads' | 'notouch' | 'continue';

const V = 'var(--aid-victim)';
const SK = 'var(--aid-skin)';
const R = 'var(--aid-rescuer)';
const H = 'var(--aid-helper)';
const D = 'var(--aid-device)';
const AMB = 'var(--aid-shock)';
const BG = 'var(--color-bg)';
const FL = 'var(--aid-floor)';
const INK = 'var(--color-text)';

const floor = `<line x1="6" y1="143" x2="234" y2="143" stroke="${FL}" stroke-width="3" stroke-linecap="round"/>`;

/** Line with a background-coloured halo so overlapping limbs stay readable. */
function limb(d: string, color: string, w = 10): string {
  return `<path d="${d}" fill="none" stroke="${BG}" stroke-width="${w + 5}" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function hand(x: number, y: number, color: string, rot = 0): string {
  return `<ellipse cx="${x}" cy="${y}" rx="9" ry="6.5" transform="rotate(${rot} ${x} ${y})" fill="${color}" stroke="${BG}" stroke-width="2.5"/>`;
}

/** Person lying on the back, head on the left. Chest top ≈ (92,112). */
function victim(): string {
  return [
    limb('M140 121 L212 121 L217 107', V, 11),
    limb('M140 132 L214 134 L221 121', V, 11),
    `<rect x="50" y="111" width="96" height="27" rx="13.5" fill="${V}"/>`,
    `<circle cx="35" cy="123" r="13.5" fill="${V}"/>`,
    limb('M60 133 L120 138', V, 8),
  ].join('');
}

/** Kneeling rescuer seen from the front, behind the victim (lower body hidden by the victim). */
function kneelBody(cx: number, color = R, headDy = 0): string {
  return `<path d="M${cx - 21} 52 Q${cx} 45 ${cx + 21} 52 L${cx + 16} 120 L${cx - 16} 120 Z" fill="${color}"/>`
    + `<circle cx="${cx}" cy="${31 + headDy}" r="13" fill="${color}"/>`;
}

/** Standing figure; `pose` sets arms/legs. */
function standing(cx: number, color: string, pose: 'look' | 'run'): string {
  const head = `<circle cx="${cx}" cy="22" r="12" fill="${color}"/>`;
  const torso = `<path d="M${cx - 16} 40 Q${cx} 34 ${cx + 16} 40 L${cx + 12} 88 L${cx - 12} 88 Z" fill="${color}"/>`;
  if (pose === 'look') {
    return limb(`M${cx - 6} 86 L${cx - 9} 139`, color, 11) + limb(`M${cx + 6} 86 L${cx + 9} 139`, color, 11)
      + torso + head
      + limb(`M${cx - 14} 45 L${cx - 20} 84`, color, 9) + hand(cx - 20, 88, color, 80)
      + limb(`M${cx + 14} 45 L${cx + 26} 34 L${cx + 12} 16`, color, 9) + hand(cx + 9, 15, color, -20);
  }
  // running to the right
  return limb(`M${cx - 4} 86 L${cx - 18} 112 L${cx - 30} 136`, color, 11)
    + limb(`M${cx + 6} 86 L${cx + 26} 108 L${cx + 22} 136`, color, 11)
    + torso + head
    + limb(`M${cx - 13} 46 L${cx - 30} 62 L${cx - 24} 78`, color, 9) + hand(cx - 23, 81, color, 70)
    + limb(`M${cx + 13} 46 L${cx + 30} 58 L${cx + 42} 46`, color, 9) + hand(cx + 45, 43, color, -40);
}

/** AED device with the heart-and-bolt sign. */
function aedBox(x: number, y: number, w = 50, h = 44): string {
  const cx = x + w / 2;
  const cy = y + h / 2 + 2;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="${D}"/>`
    + `<path d="M${cx} ${cy + 12} s-15-9-15-19 a7.5 7.5 0 0 1 15-3 a7.5 7.5 0 0 1 15 3 c0 10-15 19-15 19z" fill="${BG}"/>`
    + `<path d="M${cx + 2} ${cy - 10} l-6 9 h5 l-2 8 l7-11 h-5z" fill="${D}"/>`;
}

function arrowDown(x: number, y1: number, y2: number, color = INK): string {
  return `<path d="M${x} ${y1} V${y2} M${x - 7} ${y2 - 8} L${x} ${y2} L${x + 7} ${y2 - 8}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function bubble(x: number, y: number, text: string): string {
  return `<path d="M${x} ${y} h64 a8 8 0 0 1 8 8 v18 a8 8 0 0 1 -8 8 h-44 l-12 10 l2 -10 h-10 a8 8 0 0 1 -8 -8 v-18 a8 8 0 0 1 8 -8z" fill="${BG}" stroke="${INK}" stroke-width="2.5"/>`
    + `<text x="${x + 32}" y="${y + 23}" text-anchor="middle" font-size="16" font-weight="700" font-family="inherit" fill="${INK}">${text}</text>`;
}

function compressionScene(arrows = true): string {
  return kneelBody(92) + victim()
    + limb('M74 56 L88 104', R) + limb('M110 56 L96 104', R)
    + hand(92, 112, R) + hand(92, 105, R)
    + (arrows ? arrowDown(140, 64, 98) + arrowDown(44, 64, 98) : '');
}

/** Victim drawn smaller so a standing figure fits on the right. */
const smallVictim = () => `<g transform="translate(4 29) scale(0.8)">${victim()}</g>`;

const SCENES: Record<AidScene, string> = {
  safe: floor + standing(206, R, 'look') + smallVictim()
    + `<path d="M24 52 L44 18 L64 52 Z" fill="none" stroke="${AMB}" stroke-width="5" stroke-linejoin="round"/>`
    + `<path d="M44 30 V40" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><circle cx="44" cy="46" r="2.6" fill="${INK}"/>`,

  shake: floor + kneelBody(80) + victim()
    + limb('M62 56 L58 106', R) + limb('M98 56 L84 106', R)
    + hand(58, 111, R, 90) + hand(84, 111, R, 90)
    + bubble(112, 10, 'Halo?'),

  call: floor + kneelBody(104) + victim()
    + limb('M86 56 L92 108', R) + hand(92, 113, R)
    + limb('M122 56 L146 68 L150 48', R) + hand(150, 44, R, -80)
    + `<rect x="140" y="14" width="24" height="40" rx="5" fill="${INK}"/>`
    + `<rect x="143" y="19" width="18" height="26" rx="2" fill="${BG}"/>`
    + `<text x="152" y="37" text-anchor="middle" font-size="10" font-weight="700" font-family="inherit" fill="${INK}">112</text>`
    + `<path d="M172 22 q8 12 0 24 M182 16 q13 18 0 36" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,

  breath: floor
    + `<g transform="rotate(-20 70 118)">${kneelBody(70)}</g>`
    + victim()
    + limb('M33 66 L34 104', R) + hand(35, 108, R)
    + limb('M65 55 L74 104', R) + hand(75, 108, R)
    + `<path d="M52 40 Q96 44 104 100" fill="none" stroke="${INK}" stroke-width="2.5" stroke-dasharray="5 5"/>`
    + `<path d="M116 98 q5 -7 10 0 q5 7 10 0 M116 86 q5 -7 10 0 q5 7 10 0" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`,

  send: floor
    + `<line x1="140" y1="101" x2="226" y2="101" stroke="${FL}" stroke-width="2.5" stroke-linecap="round"/>`
    + `<g transform="translate(152 5) scale(0.7)">${standing(0, H, 'run')}</g>`
    + kneelBody(62) + victim()
    + limb('M45 56 L54 106', R) + hand(54, 110, R)
    + limb('M79 56 L98 48 L112 42', R) + hand(116, 40, R, -20)
    + aedBox(196, 6, 40, 34),

  compress: floor + compressionScene(),

  pads: `<path d="M52 46 L36 132" fill="none" stroke="${SK}" stroke-width="15" stroke-linecap="round"/>`
    + `<path d="M128 46 L144 132" fill="none" stroke="${SK}" stroke-width="15" stroke-linecap="round"/>`
    + `<path d="M50 44 Q90 32 130 44 L126 140 L54 140 Z" fill="${SK}"/>`
    + `<circle cx="90" cy="20" r="15" fill="${SK}"/>`
    + `<path d="M64 52 Q78 48 88 54 M116 52 Q102 48 92 54" fill="none" stroke="${V}" stroke-width="2" stroke-linecap="round"/>`
    // pads: right side of the victim below the collarbone (viewer's left), left side below the armpit (viewer's right)
    + `<rect x="58" y="58" width="26" height="19" rx="4" fill="${BG}" stroke="${D}" stroke-width="3.5"/>`
    + `<rect x="106" y="84" width="19" height="28" rx="4" fill="${BG}" stroke="${D}" stroke-width="3.5"/>`
    + `<path d="M71 77 Q92 128 172 112 M115 112 Q135 132 172 118" fill="none" stroke="${INK}" stroke-width="2.5"/>`
    + aedBox(170, 82, 60, 52),

  notouch: floor + kneelBody(110) + victim()
    + limb('M92 56 L76 40 L72 20', R) + hand(72, 16, R, 90)
    + limb('M128 56 L144 40 L148 20', R) + hand(148, 16, R, 90)
    + aedBox(178, 96, 52, 44)
    + `<path d="M196 10 L184 34 H196 L188 58 L212 28 H198 L208 10 Z" fill="${AMB}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`,

  continue: floor + compressionScene(false)
    + `<path d="M186 30 a24 24 0 1 1 -22 14" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`
    + `<path d="M155 40 L164 46 L170 36" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`,
};

export function aidSceneSvg(kind: AidScene): string {
  return `<svg viewBox="0 0 240 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${SCENES[kind]}</svg>`;
}

export const AID_SCENES_ORDER: AidScene[] = [
  'safe', 'shake', 'call', 'breath', 'send', 'compress', 'pads', 'notouch', 'continue',
];
