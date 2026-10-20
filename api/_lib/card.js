// SVG renderer. Shares its layout and palette with the GitHub streak card
// (erberkk/github-streak-stats) so both look like one set on a profile README.

const W = 800;
const H = 280;
const PAD = 24;
const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif`;

const PALETTES = {
  dark: {
    bg: '#0d1117', border: '#30363d', text: '#e6edf3', muted: '#8b949e', track: '#21262d',
    accent: '#1ed760', accentDim: '#1db954',
  },
  light: {
    bg: '#ffffff', border: '#d0d7de', text: '#1f2328', muted: '#656d76', track: '#eaeef2',
    accent: '#1a9e4b', accentDim: '#168a41',
  },
};

export const RANGES = {
  short_term: 'Last 4 weeks',
  medium_term: 'Last 6 months',
  long_term: 'All time',
};

export function parseTheme(value) {
  return value === 'dark' || value === 'light' ? value : 'auto';
}

function vars(p) {
  return Object.entries(p).map(([k, v]) => `--${k}:${v};`).join('');
}

function themeCss(theme) {
  if (theme !== 'auto') return `svg{${vars(PALETTES[theme])}}`;
  return `svg{${vars(PALETTES.light)}}@media (prefers-color-scheme: dark){svg{${vars(PALETTES.dark)}}}`;
}

function esc(s) {
  return String(s ?? '').replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

// Rough text width so long titles can be cut before they overflow their column.
function textWidth(text, size, bold) {
  let units = 0;
  for (const ch of text) {
    if (/[ᄀ-鿿가-힯＀-￯]/.test(ch)) units += 1;
    else if (/[MWmw@%]/.test(ch)) units += 0.85;
    else if (/[A-Z0-9]/.test(ch)) units += 0.64;
    else if (/[ilIj.,'!:;|]/.test(ch)) units += 0.28;
    else if (ch === ' ') units += 0.3;
    else units += 0.54;
  }
  return units * size * (bold ? 1.05 : 1);
}

function fit(text, maxWidth, size, bold = false) {
  if (!text) return '';
  if (textWidth(text, size, bold) <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && textWidth(out + '…', size, bold) > maxWidth) out = out.slice(0, -1);
  return out.trimEnd() + '…';
}

function formatTime(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const SPOTIFY_LOGO =
  'M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z';

const STATUS = {
  playing: { text: 'Now playing', color: 'var(--accent)' },
  paused: { text: 'Paused', color: 'var(--muted)' },
  recent: { text: 'Last played', color: 'var(--muted)' },
  offline: { text: 'Offline', color: 'var(--muted)' },
};

function nowPlaying(hero, x, y) {
  const art = 96;
  const tx = x + art + 16;
  const tw = 300 - art - 16 - 8;
  const barW = 300 - 20;
  const playing = hero.status === 'playing';
  const progress = hero.duration > 0 ? Math.min(hero.progress / hero.duration, 1) : 0;
  const remaining = Math.max(0, hero.duration - hero.progress);

  const cover = hero.image
    ? `<image href="${hero.image}" x="${x}" y="${y}" width="${art}" height="${art}" clip-path="url(#art)" preserveAspectRatio="xMidYMid slice"/>`
    : `<rect x="${x}" y="${y}" width="${art}" height="${art}" rx="8" style="fill:var(--track)"/>
       <path d="${SPOTIFY_LOGO}" transform="translate(${x + art / 2 - 16} ${y + art / 2 - 16}) scale(1.333)" style="fill:var(--border)"/>`;

  const eq = playing
    ? [0, 1, 2, 3].map((i) => {
        const bx = tx + i * 5;
        return `<rect x="${bx}" y="${y + 66}" width="3" height="12" rx="1" class="eq" style="animation-delay:${[0, -0.4, -0.2, -0.6][i]}s;animation-duration:${[0.9, 1.1, 0.8, 1][i]}s"/>`;
      }).join('')
    : '';

  const progressBar = hero.duration > 0
    ? `<rect x="${x}" y="${y + art + 18}" width="${barW}" height="4" rx="2" style="fill:var(--track)"/>
       <rect x="${x}" y="${y + art + 18}" width="${(barW * progress).toFixed(1)}" height="4" rx="2" style="fill:var(--accent)">
         ${playing ? `<animate attributeName="width" from="${(barW * progress).toFixed(1)}" to="${barW}" dur="${(remaining / 1000).toFixed(1)}s" fill="freeze"/>` : ''}
       </rect>
       <text x="${x}" y="${y + art + 40}" class="small">${formatTime(hero.progress)}</text>
       <text x="${x + barW}" y="${y + art + 40}" text-anchor="end" class="small">${formatTime(hero.duration)}</text>`
    : '';

  return `<g class="fade">
    <clipPath id="art"><rect x="${x}" y="${y}" width="${art}" height="${art}" rx="8"/></clipPath>
    ${cover}
    <text x="${tx}" y="${y + 22}" class="track-title">${esc(fit(hero.title, tw, 15, true))}</text>
    <text x="${tx}" y="${y + 42}" class="muted">${esc(fit(hero.artist, tw, 12.5))}</text>
    ${eq}
    <text x="${playing ? tx + 26 : tx}" y="${y + 78}" class="small">${esc(fit(hero.album || '', tw - (playing ? 26 : 0), 11.5))}</text>
    ${progressBar}
  </g>`;
}

function list(items, x, y, width, round, delay) {
  const row = 32;
  const img = 24;
  return items.map((it, i) => {
    const cy = y + i * row;
    const tx = x + 22 + img + 10;
    const tw = width - (tx - x);
    const clip = `thumb-${round ? 'a' : 't'}${i}`;
    const shape = round
      ? `<circle cx="${x + 22 + img / 2}" cy="${cy + img / 2}" r="${img / 2}"/>`
      : `<rect x="${x + 22}" y="${cy}" width="${img}" height="${img}" rx="4"/>`;
    const picture = it.image
      ? `<image href="${it.image}" x="${x + 22}" y="${cy}" width="${img}" height="${img}" clip-path="url(#${clip})" preserveAspectRatio="xMidYMid slice"/>`
      : `<g style="fill:var(--track)">${shape}</g>`;
    const text = it.subtitle
      ? `<text x="${tx}" y="${cy + 10}" class="row-title">${esc(fit(it.title, tw, 12.5, true))}</text>
         <text x="${tx}" y="${cy + 24}" class="small">${esc(fit(it.subtitle, tw, 11.5))}</text>`
      : `<text x="${tx}" y="${cy + 17}" class="row-title">${esc(fit(it.title, tw, 12.5, true))}</text>`;
    return `<g class="fade" style="animation-delay:${delay + i * 50}ms">
      <clipPath id="${clip}">${shape}</clipPath>
      <text x="${x + 6}" y="${cy + 17}" text-anchor="middle" class="rank">${i + 1}</text>
      ${picture}
      ${text}
    </g>`;
  }).join('');
}

export function renderCard({ name, hero, tracks, artists, range, theme }) {
  const status = STATUS[hero.status];
  const pillW = status.text.length * 6.6 + 34;
  const pillX = W - PAD - pillW;
  const col1 = PAD;
  const col2 = PAD + 320;
  const col3 = PAD + 320 + 228;
  const colW = 204;

  const empty = (x) => `<text x="${x}" y="114" class="small">Not enough listening data yet</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(name)} on Spotify: ${esc(status.text)} ${esc(hero.title)} by ${esc(hero.artist)}">
  <title>${esc(name)} on Spotify</title>
  <style>
    ${themeCss(theme)}
    text{font-family:${FONT};fill:var(--text)}
    .title{font-size:16px;font-weight:600}
    .title .dim{fill:var(--muted);font-weight:400}
    .pill{font-size:11.5px;font-weight:500;fill:var(--muted)}
    .caption{font-size:11px;font-weight:600;letter-spacing:.6px;fill:var(--muted)}
    .track-title{font-size:15px;font-weight:600}
    .row-title{font-size:12.5px;font-weight:600}
    .muted{font-size:12.5px;fill:var(--muted)}
    .small{font-size:11.5px;fill:var(--muted)}
    .rank{font-size:12px;font-weight:600;fill:var(--muted)}
    .fade{animation:fade .6s ease-out both}
    .eq{fill:var(--accent);transform-box:fill-box;transform-origin:bottom;animation:eq 1s ease-in-out infinite alternate}
    .live{animation:pulse 2s ease-in-out infinite}
    @keyframes fade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
    @keyframes eq{from{transform:scaleY(.25)}to{transform:scaleY(1)}}
    @keyframes pulse{50%{opacity:.4}}
    @media (prefers-reduced-motion: reduce){*{animation:none!important}}
  </style>

  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="12" style="fill:var(--bg);stroke:var(--border)"/>

  <g class="fade">
    <path d="${SPOTIFY_LOGO}" transform="translate(${PAD} 21) scale(0.75)" style="fill:var(--accent)"/>
    <text x="${PAD + 28}" y="37" class="title">${esc(fit(name, 260, 16, true))}<tspan class="dim"> · on Spotify</tspan></text>
    <rect x="${pillX.toFixed(1)}" y="18" width="${pillW.toFixed(1)}" height="26" rx="13" style="fill:none;stroke:var(--border)"/>
    <circle cx="${(pillX + 15).toFixed(1)}" cy="31" r="4" style="fill:${status.color}" class="${hero.status === 'playing' ? 'live' : ''}"/>
    <text x="${(pillX + 25).toFixed(1)}" y="35" class="pill">${status.text}</text>
  </g>
  <line x1="${PAD}" y1="58" x2="${W - PAD}" y2="58" style="stroke:var(--border)"/>

  <text x="${col1}" y="86" class="caption">${hero.status === 'playing' || hero.status === 'paused' ? 'LISTENING TO' : 'RECENTLY PLAYED'}</text>
  ${nowPlaying(hero, col1, 100)}

  <line x1="${col2 - 20}" y1="78" x2="${col2 - 20}" y2="${H - 24}" style="stroke:var(--border)"/>
  <text x="${col2}" y="86" class="caption">TOP TRACKS</text>
  <text x="${col2 + colW}" y="86" text-anchor="end" class="small">${RANGES[range]}</text>
  ${tracks.length ? list(tracks, col2, 98, colW, false, 100) : empty(col2)}

  <line x1="${col3 - 12}" y1="78" x2="${col3 - 12}" y2="${H - 24}" style="stroke:var(--border)"/>
  <text x="${col3}" y="86" class="caption">TOP ARTISTS</text>
  ${artists.length ? list(artists, col3, 98, W - PAD - col3, true, 200) : empty(col3)}
</svg>`;
}

export function renderMessageCard(title, message, theme) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}: ${esc(message)}">
  <style>
    ${themeCss(theme)}
    text{font-family:${FONT}}
  </style>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="12" style="fill:var(--bg);stroke:var(--border)"/>
  <path d="${SPOTIFY_LOGO}" transform="translate(${W / 2 - 14} ${H / 2 - 62}) scale(1.1667)" style="fill:var(--accent)"/>
  <text x="${W / 2}" y="${H / 2 + 6}" text-anchor="middle" style="fill:var(--text);font-size:16px;font-weight:600">${esc(title)}</text>
  <text x="${W / 2}" y="${H / 2 + 30}" text-anchor="middle" style="fill:var(--muted);font-size:13px">${esc(message)}</text>
</svg>`;
}
