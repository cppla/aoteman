// Original, self-contained SVG character illustrations. Every instance owns its paint ids.
const safeId = value => String(value).replace(/[^a-zA-Z0-9_-]/g, '-');

export function heroSVG(id = 'hero') {
  const p = `hero-${safeId(id)}`;
  return `<svg class="character-art hero-art" viewBox="0 0 360 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="银河奥特曼，银红色装甲与蓝色能量水晶">
  <defs>
    <linearGradient id="${p}-silver" x1="0" y1="0" x2="1" y2=".8"><stop stop-color="#fbffff"/><stop offset=".35" stop-color="#dcebf0"/><stop offset=".59" stop-color="#8fabba"/><stop offset=".78" stop-color="#d2e5ed"/><stop offset="1" stop-color="#627f91"/></linearGradient>
    <linearGradient id="${p}-face" x1="0" x2="1" y1=".2" y2=".7"><stop stop-color="#d4e6ee"/><stop offset=".3" stop-color="#fbffff"/><stop offset=".64" stop-color="#d3e5ed"/><stop offset="1" stop-color="#849fb2"/></linearGradient>
    <linearGradient id="${p}-red" x1="0" x2=".9" y1="0" y2="1"><stop stop-color="#fa6a67"/><stop offset=".32" stop-color="#e83d49"/><stop offset=".69" stop-color="#b91c39"/><stop offset="1" stop-color="#790c2a"/></linearGradient>
    <linearGradient id="${p}-blue" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#e7ffff"/><stop offset=".28" stop-color="#72f1ff"/><stop offset=".67" stop-color="#16a6e9"/><stop offset="1" stop-color="#2459b9"/></linearGradient>
    <linearGradient id="${p}-gold" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#ffffe3"/><stop offset=".6" stop-color="#fff2a1"/><stop offset="1" stop-color="#e9b849"/></linearGradient>
    <radialGradient id="${p}-aura"><stop stop-color="#b9faff" stop-opacity=".5"/><stop offset=".52" stop-color="#45d9ff" stop-opacity=".17"/><stop offset="1" stop-color="#2ad6ff" stop-opacity="0"/></radialGradient>
    <linearGradient id="${p}-shield" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#d6ffff" stop-opacity=".24"/><stop offset=".45" stop-color="#61e5ff" stop-opacity=".035"/><stop offset="1" stop-color="#37ccff" stop-opacity=".24"/></linearGradient>
    <filter id="${p}-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="3"/></filter>
  </defs>
  <ellipse class="actor-shadow" cx="180" cy="388" rx="73" ry="13" fill="#0a2638" opacity=".28"/>
  <g class="hero-power-aura"><ellipse cx="180" cy="223" rx="155" ry="191" fill="url(#${p}-aura)"/><path d="M89 283 76 233 98 181 84 139M266 293 285 239 267 193 280 133M126 95 145 64M225 91 211 53" fill="none" stroke="#8ef5ff" stroke-width="3"/></g>
  <g class="hero-rig" stroke="#294e64" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
    <g class="hero-left-leg">
      <path d="M140 281 177 288 173 329 162 366 133 364 126 335Z" fill="url(#${p}-red)"/>
      <path d="m132 326 20 9 20-5-10 40-28-1-8-29Z" fill="url(#${p}-silver)"/>
      <path d="m142 338 10 5 9-3-8 24-10-1Z" fill="#fcffff" opacity=".55" stroke="none"/>
      <path d="M135 357q14 11 28 2l4 17q-6 10-24 10l-27-1q-6-7 1-15Z" fill="url(#${p}-silver)"/>
      <path d="M116 379q24 7 49-2" fill="none" stroke="#426277"/>
    </g>
    <g class="hero-right-leg">
      <path d="m183 288 38-8 11 55-6 29-29 2-15-38Z" fill="url(#${p}-red)"/>
      <path d="m187 330 20 5 21-9 4 14-8 29-29 1Z" fill="url(#${p}-silver)"/>
      <path d="m198 339 10 5 10-5-3 23-11 3Z" fill="#f7ffff" opacity=".5" stroke="none"/>
      <path d="M197 359q13 8 28-2l20 14q7 9 0 14l-27 1q-18 0-25-10Z" fill="url(#${p}-silver)"/>
      <path d="M195 377q24 9 50 2" fill="none" stroke="#426277"/>
    </g>
    <g class="hero-torso">
      <path d="m160 176-19 18-17 29 13 40-1 26q42 21 87-1l-1-27 14-41-18-26-17-18Z" fill="url(#${p}-red)"/>
      <path d="m152 184 28 9 29-9 18 18-14 40-33 16-34-16-14-40Z" fill="url(#${p}-silver)"/>
      <path d="m137 205 19 9 24 19 23-19 20-9-8 25-35 18-34-18Z" fill="#456576"/>
      <path d="m142 202 17 7 21 18 21-18 19-7-5 14-35 22-33-22Z" fill="url(#${p}-blue)" stroke="#2c91b6" stroke-width="1.5"/>
      <path d="m154 216 5 10m6-2 7 10m36-18-5 10m-6-2-7 10" fill="none" stroke="#c8faff" stroke-width="2"/>
      <path d="m145 252 35 15 35-15-4 23-31 12-32-12Z" fill="url(#${p}-silver)"/>
      <path d="m154 258 26 10 25-10m-49 15 24 8 23-8" stroke="#f3ffff" opacity=".5" fill="none" stroke-width="2"/>
      <path d="m156 288 24 6 23-6-5 11h-36Z" fill="#29485d"/>
      <path d="m166 181 14 7 15-7-2 14-13 10-14-10Z" fill="#7a9cac"/>
      <g class="hero-crystal">
        <path d="m180 207 13 15-4 20-9 9-10-9-4-20Z" fill="#255479" stroke="#e5faff" stroke-width="3"/>
        <path d="m180 212 9 12-4 15-5 6-6-6-3-15Z" fill="url(#${p}-blue)" stroke="none"/>
        <path d="m180 215-5 10 5 11 5-11Z" fill="#c6ffff" stroke="none"/>
        <ellipse class="crystal-halo" cx="180" cy="228" rx="15" ry="22" fill="#5ce9ff" opacity=".6" stroke="none" filter="url(#${p}-glow)"/>
      </g>
    </g>
    <g class="hero-neutral-arms">
      <g class="hero-left-arm">
        <path d="M139 195q-13-6-22 7l-18 42 9 25 25-8 8-26 7-26Z" fill="url(#${p}-red)"/>
        <path d="M136 195q-13-6-19 7l-7 19 25 11 10-23Z" fill="url(#${p}-silver)"/>
        <path d="m115 225 16 7-5 13-16-6Z" fill="url(#${p}-blue)" stroke-width="1.7"/>
        <path d="m100 251 25 9-4 30-7 12-20-6-4-12Z" fill="url(#${p}-silver)"/>
        <path d="m101 260-4 20 8 8m12-24-6 20" fill="none" stroke="#f7ffff" stroke-width="2" opacity=".7"/>
        <path d="m93 290 22 6 1 14-6 9-17-3-7-9Z" fill="url(#${p}-silver)"/>
        <path d="m95 301 12 4m-13 3 9 3" fill="none" stroke-width="1.5"/>
      </g>
      <g class="hero-right-arm">
        <path d="M221 195q13-6 22 7l18 42-9 25-25-8-8-26-7-26Z" fill="url(#${p}-red)"/>
        <path d="M224 195q13-6 19 7l7 19-25 11-10-23Z" fill="url(#${p}-silver)"/>
        <path d="m245 225-16 7 5 13 16-6Z" fill="url(#${p}-blue)" stroke-width="1.7"/>
        <path d="m260 251-25 9 4 30 7 12 20-6 4-12Z" fill="url(#${p}-silver)"/>
        <path d="m259 260 4 20-8 8m-12-24 6 20" fill="none" stroke="#f7ffff" stroke-width="2" opacity=".7"/>
        <path d="m267 290-22 6-1 14 6 9 17-3 7-9Z" fill="url(#${p}-silver)"/>
        <path d="m265 301-12 4m13 3-9 3" fill="none" stroke-width="1.5"/>
      </g>
    </g>
    <g class="hero-head">
      <path d="m124 101-13-11-7 8 2 41 15 15m115-53 13-11 7 8-2 41-15 15" fill="url(#${p}-silver)"/>
      <path d="m111 106 7 8-1 24-6-4m138-28-7 8 1 24 6-4" fill="#536e80" stroke="none"/>
      <path d="M180 41c-44 0-67 26-68 64l8 44 23 30 37 18 37-18 23-30 8-44c-1-38-24-64-68-64Z" fill="url(#${p}-face)"/>
      <path d="M180 41c-44 0-67 26-68 64l8 44 23 30 37 18-26-31-15-36-2-34 14-35Z" fill="#ffffff" opacity=".2" stroke="none"/>
      <path d="m180 43-17 40 6 30 11 12 11-12 6-30Z" fill="#88a9b9" stroke="none"/>
      <path d="m180 21-11 34-5 30 16 25 15-25-4-30Z" fill="url(#${p}-silver)"/>
      <path d="m180 28-5 31-4 25 9 16 8-16-4-25Z" fill="url(#${p}-blue)" stroke="#76bdd4" stroke-width="1.2"/>
      <path d="m179 34-3 44 4 12 1-48Z" fill="#e1ffff" opacity=".9" stroke="none"/>
      <path d="m127 95 34 8 7 24-19 13-23-13-7-21Zm106 0-34 8-7 24 19 13 23-13 7-21Z" fill="#4a687c" stroke="#93b1c2" stroke-width="2"/>
      <g class="hero-eyes" stroke="#fff4ad" stroke-width="1.7">
        <path d="m128 101 28 8 7 15-15 9-17-10-7-16Z" fill="url(#${p}-gold)"/>
        <path d="m232 101-28 8-7 15 15 9 17-10 7-16Z" fill="url(#${p}-gold)"/>
        <path d="m130 105 19 6-14 7Zm100 0-19 6 14 7Z" fill="#fffef0" stroke="none"/>
      </g>
      <path d="m126 142 19 11 18-5m71-6-19 11-18-5" fill="none" stroke="#7794a6" stroke-width="2.4"/>
      <path d="m170 133-5 19 15 7 15-7-5-19" fill="#bfd7e3" stroke="#8faaba" stroke-width="1.5"/>
      <path d="m159 165 21 6 21-6-9 13h-24Z" fill="#59798e" stroke="#d6edf5" stroke-width="1.3"/>
      <path d="m165 167 15 4 15-4" fill="none" stroke="#f6ffff" stroke-width="2"/>
      <path d="m138 77 13-10m63 5 10 12" fill="none" stroke="#fff" opacity=".65" stroke-width="4"/>
    </g>
    <g class="hero-defense-arms">
      <path d="M137 199q-13-1-18 11l-3 37q4 17 21 20l19-16-16-13 7-25Z" fill="url(#${p}-red)"/>
      <path d="M223 199q13-1 18 11l3 37q-4 17-21 20l-19-16 16-13-7-25Z" fill="url(#${p}-red)"/>
      <path d="m123 209 13-9 11 13-7 17-20-4Zm114 0-13-9-11 13 7 17 20-4Z" fill="url(#${p}-silver)"/>
      <g class="hero-defense-left">
        <path d="m128 249 18 22 73-58-17-23Z" fill="url(#${p}-silver)" stroke-width="4"/>
        <path d="m142 248 9 11 54-47-8-10Z" fill="url(#${p}-blue)" stroke-width="1.4"/>
        <path d="m202 191 5-12 11-5 10 8 1 13-11 17Z" fill="url(#${p}-silver)"/>
        <path d="m214 181 9 7m-14 0 11 8" fill="none" stroke-width="1.5"/>
      </g>
      <g class="hero-defense-right">
        <path d="m232 249-18 22-73-58 17-23Z" fill="url(#${p}-silver)" stroke-width="4"/>
        <path d="m218 248-9 11-54-47 8-10Z" fill="url(#${p}-blue)" stroke-width="1.4"/>
        <path d="m158 191-5-12-11-5-10 8-1 13 11 17Z" fill="url(#${p}-silver)"/>
        <path d="m146 181-9 7m14 0-11 8" fill="none" stroke-width="1.5"/>
        <path d="m164 217 48 39" fill="none" stroke="#f0ffff" stroke-width="2.5"/>
      </g>
    </g>
    <g class="hero-beam-arms">
      <path d="M137 201q-16-3-20 12l-4 28q4 14 21 15l66-8-1-23-57 4 4-17Z" fill="url(#${p}-red)"/>
      <path d="m140 228 5 28 54-8-1-23Z" fill="url(#${p}-silver)"/>
      <path d="m197 226 15-2 12 5-2 13-12 6-13-2Z" fill="url(#${p}-silver)"/>
      <path d="M221 201q17-3 20 12l4 29q-4 12-18 12h-15l-4-48Z" fill="url(#${p}-red)"/>
      <path d="m207 234 24-2-2-60-25 1Z" fill="url(#${p}-silver)"/>
      <path d="m210 227 11-1-1-46-9 1Z" fill="url(#${p}-blue)" stroke-width="1.3"/>
      <path d="m204 174-3-17 3-18 8-2 10 4 6 14 1 18Z" fill="url(#${p}-silver)"/>
      <path d="m210 145-1 15m7-14 1 14m5-9 1 10" stroke-width="1.4" fill="none"/>
      <g class="hero-beam-flare" stroke="none"><ellipse cx="235" cy="213" rx="24" ry="31" fill="#75f3ff" opacity=".6" filter="url(#${p}-glow)"/><path d="m235 180 7 24 22 9-22 7-7 23-6-23-17-7 17-9Z" fill="#eaffff"/></g>
    </g>
  </g>
  <g class="hero-shield" fill="none" stroke="#91f7ff">
    <ellipse cx="180" cy="222" rx="111" ry="130" fill="url(#${p}-shield)" stroke-width="2.5"/>
    <ellipse cx="180" cy="222" rx="119" ry="138" stroke-width="1" stroke-dasharray="16 8 3 8" opacity=".65"/>
    <path d="m180 100 96 57v112l-96 66-96-66V157Zm0 0v45m96 12-36 23m36 89-36-21m-60 87v-43m-96-23 37-23m-37-89 37 23" stroke-width="1" opacity=".45"/>
    <path d="M79 186q-9 35 2 69m198-48q4 29-7 56" stroke="#d8ffff" stroke-width="5" stroke-linecap="round"/>
  </g>
  <g class="hero-sleep-symbols" fill="#b7edff" font-family="sans-serif" font-weight="700" stroke="none"><text x="244" y="110" font-size="22">z</text><text x="266" y="87" font-size="29">z</text><text x="294" y="51" font-size="37">Z</text></g>
  <g class="hero-heart" fill="#ffb3c0" stroke="#ffdce4" stroke-width="1.5"><path d="M274 172c-21-15-28-27-19-35 6-6 14-2 19 4 5-6 13-10 19-4 9 8 2 20-19 35Z"/></g>
  </svg>`;
}

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
