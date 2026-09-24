// Ginga uses the attributed official suit photograph; monsters are original SVG art.
// Every animated instance owns its paint and clipping ids.
const safeId = value => String(value).replace(/[^a-zA-Z0-9_-]/g, '-');

export { gingaSVG as heroSVG } from './ginga-character.js';

export function monsterSVG(type = 'obsidian', id = 'monster') {
  const kinds = {
    obsidian: { name: '暗星装甲兽', light: '#a095cc', mid: '#64527e', dark: '#2e294c', armor: '#554a6d', rim: '#bc9dec', eye: '#f3b8ff', energy: '#db86ff', horn: '#d8c9e7' },
    lava: { name: '熔岩角兽', light: '#ec8463', mid: '#ac423e', dark: '#542839', armor: '#702e35', rim: '#f4a467', eye: '#fff6b4', energy: '#ffbc45', horn: '#f3c8a1' },
    cosmic: { name: '宇宙电光兽', light: '#72bec6', mid: '#357b8d', dark: '#173b58', armor: '#2d637a', rim: '#7ce3e9', eye: '#dcffb6', energy: '#8af6df', horn: '#b3eddf' },
  };
  const kind = Object.hasOwn(kinds, type) ? type : 'obsidian';
  const c = kinds[kind];
  const p = `monster-${safeId(id)}-${kind}`;
  const horns = kind === 'lava'
    ? `<path d="M137 148q-46-22-33-85 9 34 42 43Zm86 0q46-22 33-85-9 34-42 43Z" fill="url(#${p}-horn)"/><path d="m119 116-7-30m129 30 7-30" stroke="${c.dark}" opacity=".5" fill="none" stroke-width="2"/>`
    : kind === 'cosmic'
      ? `<path d="m138 122-14-53 12-25 8 28 14 32m64 18 14-53-12-25-8 28-14 32" fill="url(#${p}-horn)"/><circle cx="135" cy="51" r="8" fill="${c.energy}"/><circle cx="225" cy="51" r="8" fill="${c.energy}"/><path d="m113 155-25-13 13 31-14 15 32 9m128-42 25-13-13 31 14 15-32 9" fill="${c.armor}"/>`
      : `<path d="m128 138-18-49 33 22 12-39 21 34 25-47 8 48 37-22-17 55" fill="url(#${p}-horn)"/><path d="m156 104 13 18 20-39 4 39 25-10" fill="${c.armor}" stroke="none"/>`;
  const forehead = kind === 'lava'
    ? `<path d="m180 100-17 31 17 18 17-18Z" fill="${c.armor}"/><path d="m180 111-6 17 7 8 6-9Z" fill="${c.energy}" stroke="none"/>`
    : kind === 'cosmic'
      ? `<path d="m180 101-21 22 21 26 21-26Z" fill="${c.armor}"/><path d="m180 110-11 14 11 15 11-15Z" fill="${c.energy}" stroke="${c.horn}" stroke-width="1.5"/>`
      : `<path d="m180 101-25 22 9 26 16-6 16 6 9-26Z" fill="${c.armor}"/><path d="m180 106-11 20 11 11 11-11Z" fill="${c.rim}" stroke="none" opacity=".7"/>`;
  return `<svg class="character-art monster-art monster-art-${kind}" viewBox="0 0 360 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${c.name}，有发光眼睛和可活动利爪的怪兽">
  <defs>
    <linearGradient id="${p}-skin" x1=".15" x2=".8" y1="0" y2="1"><stop stop-color="${c.light}"/><stop offset=".45" stop-color="${c.mid}"/><stop offset="1" stop-color="${c.dark}"/></linearGradient>
    <linearGradient id="${p}-plate" x1=".2" x2=".8" y1="0" y2="1"><stop stop-color="${c.light}"/><stop offset=".25" stop-color="${c.armor}"/><stop offset="1" stop-color="${c.dark}"/></linearGradient>
    <linearGradient id="${p}-horn" x1=".2" x2=".9" y1="0" y2="1"><stop stop-color="#f1ebdf"/><stop offset=".45" stop-color="${c.horn}"/><stop offset="1" stop-color="${c.mid}"/></linearGradient>
    <radialGradient id="${p}-aura"><stop stop-color="${c.energy}" stop-opacity=".45"/><stop offset="1" stop-color="${c.energy}" stop-opacity="0"/></radialGradient>
    <filter id="${p}-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="4"/></filter>
  </defs>
  <ellipse class="actor-shadow" cx="183" cy="388" rx="94" ry="14" fill="#0a1930" opacity=".3"/>
  <ellipse class="monster-aura" cx="182" cy="235" rx="165" ry="176" fill="url(#${p}-aura)"/>
  <g class="monster-rig" stroke="${c.dark}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
    <g class="monster-tail"><path d="M226 294q41 42 70 17 23-20 11-44 35 25 15 64-31 45-89 9Z" fill="url(#${p}-skin)"/><path d="m279 320 6-25 13 20 17-20 3 20" fill="${c.armor}"/><path d="M264 334q34 12 52-16" fill="none" stroke="${c.rim}" stroke-width="2" opacity=".4"/></g>
    <g class="monster-left-leg"><path d="M127 290q-22 26-21 61l-18 18q-11 16 9 17h51q18-5 11-21l-7-14 20-46Z" fill="url(#${p}-skin)"/><path d="m116 322 29 6-4 24-28-5Z" fill="${c.armor}"/><path d="m95 369-10 16h20l3-16m9-2-4 19h19l-3-18m11 2-2 16h19l-9-16" fill="url(#${p}-horn)" stroke-width="2"/></g>
    <g class="monster-right-leg"><path d="M231 290q22 26 21 61l18 18q11 16-9 17h-51q-18-5-11-21l7-14-20-46Z" fill="url(#${p}-skin)"/><path d="m242 322-29 6 4 24 28-5Z" fill="${c.armor}"/><path d="m263 369 10 16h-20l-3-16m-9-2 4 19h-19l3-18m-11 2 2 16h-19l9-16" fill="url(#${p}-horn)" stroke-width="2"/></g>
    <g class="monster-body"><path d="M133 180q-32 19-35 71l15 52 31 28h74l28-28 16-52q-3-52-35-71Z" fill="url(#${p}-skin)"/>
      <path d="m133 201 46 20 47-20 12 39-12 54-47 23-45-23-13-54Z" fill="${c.armor}"/>
      <path d="m129 217 50 18 50-18-5 25-45 13-45-13Zm6 40 44 12 43-12-7 22-36 13-37-13Zm15 38 29 10 29-10-9 19-20 6-20-6Z" fill="url(#${p}-plate)" stroke-width="2"/>
      <g class="monster-energy" fill="none" stroke="${c.energy}" stroke-width="2.5"><path d="m153 213 26 22 27-22m-46 46 19 10 19-10m-43 39 24 8 23-8"/></g>
      <path d="m112 207-19-15 4 28-21 2 18 16m152-31 19-15-4 28 21 2-18 16" fill="${c.armor}"/>
    </g>
    <g class="monster-left-arm"><path d="M116 207q-18-5-27 14l-22 45 8 37 27-6 12-32 15-35Z" fill="url(#${p}-skin)"/><path d="m100 212 14-8 15 18-12 18-26-8Z" fill="url(#${p}-plate)"/><path d="m91 229-13-17-3 22-15 4 17 11" fill="${c.armor}"/><path d="m76 269 25 9-4 26-23 4-10-14Z" fill="${c.armor}"/><path d="m73 293-13 22 9 8 15-21 2 25 11 1 5-25 11 14 8-8-17-26Z" fill="url(#${p}-horn)" stroke-width="2.5"/><path d="m83 258 8-14" fill="none" stroke="${c.rim}" opacity=".55"/></g>
    <g class="monster-right-arm"><path d="M244 207q18-5 27 14l22 45-8 37-27-6-12-32-15-35Z" fill="url(#${p}-skin)"/><path d="m260 212-14-8-15 18 12 18 26-8Z" fill="url(#${p}-plate)"/><path d="m269 229 13-17 3 22 15 4-17 11" fill="${c.armor}"/><path d="m284 269-25 9 4 26 23 4 10-14Z" fill="${c.armor}"/><path d="m287 293 13 22-9 8-15-21-2 25-11 1-5-25-11 14-8-8 17-26Z" fill="url(#${p}-horn)" stroke-width="2.5"/><path d="m277 258-8-14" fill="none" stroke="${c.rim}" opacity=".55"/></g>
    <g class="monster-head">
      ${horns}
      <path d="M179 100q-51-1-66 39l-4 44 20 30 50 14 50-14 20-30-4-44q-15-40-66-39Z" fill="url(#${p}-skin)"/>
      <path d="m116 140 20-20 24 8-7 30-36 14Zm128 0-20-20-24 8 7 30 36 14Z" fill="url(#${p}-plate)"/>
      ${forehead}
      <path d="m126 153 37 10-9 18-25-7-8-11Zm108 0-37 10 9 18 25-7 8-11Z" fill="${c.dark}" stroke="none"/>
      <g class="monster-eyes" fill="${c.eye}" stroke="${c.energy}" stroke-width="1.2"><path d="m129 158 28 9-8 8-17-5Z"/><path d="m231 158-28 9 8 8 17-5Z"/></g>
      <path d="m179 158-12 24 12 7 12-7Z" fill="${c.armor}"/>
      <path d="m135 187 20 4 24 8 24-8 22-4-14 23-32 9-32-9Z" fill="${c.dark}"/>
      <path d="m144 190 7 12 7-8m42 0 7 8 7-12m-56 17 6-8 6 11m20 0 6-11 6 8" fill="url(#${p}-horn)" stroke-width="1.4"/>
      <path d="m119 176 16 7m106-7-16 7" fill="none" stroke="${c.rim}" stroke-width="2" opacity=".45"/>
      <path d="m140 119 10-4m58 1 10 5" fill="none" stroke="${c.rim}" opacity=".6"/>
      ${kind === 'lava' ? `<path class="monster-energy" d="m123 139 13 10-4 15m97-28-12 13 7 11m-40-50-5 17" fill="none" stroke="${c.energy}" stroke-width="2"/>` : ''}
    </g>
  </g>
  <g class="monster-slash" fill="none" stroke="${c.energy}" stroke-width="5" stroke-linecap="round"><path d="M67 193q54 18 95 89M87 176q53 19 94 89M110 161q52 22 85 85"/><path d="M67 193q54 18 95 89M87 176q53 19 94 89M110 161q52 22 85 85" stroke="#fff6ea" stroke-width="1.5"/></g>
  <g class="monster-stun" fill="${c.eye}" stroke="none"><path d="m99 112 3 9 10 1-8 6 2 10-8-5-9 4 3-9-7-7 10 1Z"/><path d="m258 90 3 9 10 1-8 6 2 10-8-5-9 4 3-9-7-7 10 1Z"/></g>
  </svg>`;
}
