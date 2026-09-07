// Tiga's own silhouette, paint definitions and articulated limbs share the existing hero rig.
const safeId = value => String(value).replace(/[^a-zA-Z0-9_-]/g, '-');

export function allySVG(id = 'ally') {
  const p = `tiga-${safeId(id)}`;
  return `<svg class="character-art hero-art ally-art" viewBox="0 0 360 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="迪迦奥特曼，银色头盔、金色胸甲与红紫色复合型战衣">
  <defs>
    <linearGradient id="${p}-silver" x1="0" y1="0" x2="1" y2=".8"><stop stop-color="#ffffff"/><stop offset=".3" stop-color="#e5e9f5"/><stop offset=".57" stop-color="#9daec5"/><stop offset=".78" stop-color="#e4edf5"/><stop offset="1" stop-color="#75849e"/></linearGradient>
    <linearGradient id="${p}-face" x1="0" y1=".2" x2="1" y2=".8"><stop stop-color="#b9c4dc"/><stop offset=".3" stop-color="#fbffff"/><stop offset=".66" stop-color="#dae4ef"/><stop offset="1" stop-color="#8c9bb3"/></linearGradient>
    <linearGradient id="${p}-red" x1="0" y1="0" x2=".9" y2="1"><stop stop-color="#ff7a7d"/><stop offset=".32" stop-color="#de4658"/><stop offset=".72" stop-color="#a91f41"/><stop offset="1" stop-color="#681933"/></linearGradient>
    <linearGradient id="${p}-purple" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#a799ed"/><stop offset=".32" stop-color="#7c66c7"/><stop offset=".7" stop-color="#514291"/><stop offset="1" stop-color="#342858"/></linearGradient>
    <linearGradient id="${p}-gold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff8c7"/><stop offset=".32" stop-color="#e7ce89"/><stop offset=".58" stop-color="#b99a53"/><stop offset=".8" stop-color="#f0dda0"/><stop offset="1" stop-color="#987641"/></linearGradient>
    <linearGradient id="${p}-blue" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#edffff"/><stop offset=".28" stop-color="#9cf6ff"/><stop offset=".7" stop-color="#4baded"/><stop offset="1" stop-color="#3157b7"/></linearGradient>
    <linearGradient id="${p}-eyes" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fffff6"/><stop offset=".55" stop-color="#fff6d1"/><stop offset="1" stop-color="#dcc990"/></linearGradient>
    <radialGradient id="${p}-aura"><stop stop-color="#e6d7ff" stop-opacity=".52"/><stop offset=".55" stop-color="#a78aff" stop-opacity=".16"/><stop offset="1" stop-color="#9781ff" stop-opacity="0"/></radialGradient>
    <linearGradient id="${p}-shield" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff4d4" stop-opacity=".22"/><stop offset=".5" stop-color="#d1b9ff" stop-opacity=".035"/><stop offset="1" stop-color="#bea0ff" stop-opacity=".25"/></linearGradient>
    <filter id="${p}-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="3"/></filter>
  </defs>
  <ellipse class="actor-shadow hero-shadow" cx="180" cy="388" rx="73" ry="13" fill="#19243c" opacity=".28"/>
  <g class="hero-power-aura"><ellipse cx="180" cy="225" rx="153" ry="190" fill="url(#${p}-aura)"/><path d="m88 283-13-50 20-51-9-43m185 154 14-54-18-47 12-59m-151-40 18-29m78 27-12-36" fill="none" stroke="#ded1ff" stroke-width="3"/><path d="m76 186 6-17m202 101 5-18" fill="none" stroke="#fff3ce" stroke-width="3"/></g>
  <g class="hero-rig" stroke="#3b435d" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
    <g class="hero-left-leg">
      <path d="m140 281 37 7-4 41-11 37-29-2-7-29Z" fill="url(#${p}-purple)"/>
      <path d="m140 289 14 7-5 29-17 14-6-4Z" fill="url(#${p}-red)" stroke-width="1.7"/>
      <path d="m150 304 15 4-7 26 11 7-7 29-28-1-8-29 14-14Z" fill="url(#${p}-silver)"/>
      <path d="m142 340 10 4 9-3-8 23-10-1Z" fill="#fff" opacity=".5" stroke="none"/>
      <path d="M135 357q14 11 28 2l4 17q-6 10-24 10l-27-1q-6-7 1-15Z" fill="url(#${p}-silver)"/>
      <path d="M116 379q24 7 49-2" fill="none" stroke="#626e89"/>
    </g>
    <g class="hero-right-leg">
      <path d="m183 288 38-8 11 55-6 29-29 2-15-38Z" fill="url(#${p}-purple)"/>
      <path d="m220 289-14 7 5 29 17 14 4-4Z" fill="url(#${p}-red)" stroke-width="1.7"/>
      <path d="m210 304-15 4 7 26-11 7 6 29 28-1 7-29-14-14Z" fill="url(#${p}-silver)"/>
      <path d="m218 340-10 4-9-3 8 23 10-1Z" fill="#fff" opacity=".45" stroke="none"/>
      <path d="M197 359q13 8 28-2l20 14q7 9 0 14l-27 1q-18 0-25-10Z" fill="url(#${p}-silver)"/>
      <path d="M195 377q24 9 50 2" fill="none" stroke="#626e89"/>
    </g>
    <g class="hero-torso">
      <path d="m161 176-20 18-17 29 13 40-1 26q42 21 87-1l-1-27 14-41-18-26-17-18Z" fill="url(#${p}-red)"/>
      <path d="m145 232 35 14 35-14-3 25 11 31q-44 20-87 1l12-32Z" fill="url(#${p}-purple)"/>
      <path d="m132 211 17 14 15 36 16 14 16-14 15-36 17-14-11 42-21 28-16 9-16-9-21-28Z" fill="url(#${p}-silver)"/>
      <path d="m150 250 14 17 16 14 16-14 14-17" fill="none" stroke="#f4f8ff" stroke-width="2.2" opacity=".8"/>
      <path d="m152 184 28 10 29-10 20 18-11 24-38 22-38-22-11-24Z" fill="url(#${p}-silver)"/>
      <path d="m139 199 15-10 26 11 26-11 15 10-10 20-31 18-31-18Z" fill="url(#${p}-gold)" stroke="#9b824c" stroke-width="1.6"/>
      <path d="m146 199 9-5 25 12 25-12 9 5-8 13-26 17-26-17Z" fill="url(#${p}-purple)" stroke="#e5d5a4" stroke-width="1.8"/>
      <path d="m154 207 26 18 26-18-6 14-20 13-20-13Z" fill="url(#${p}-silver)" stroke="none"/>
      <path d="m151 193-8 10m64-10 8 10m-75 7 9 10m71-10-9 10" fill="none" stroke="#fff0c0" stroke-width="2"/>
      <path d="m166 181 14 7 15-7-2 13-13 8-14-8Z" fill="#959fb7"/>
      <path d="m158 288 22 6 22-6-5 10h-34Z" fill="#4c4369"/>
      <g class="hero-crystal">
        <ellipse cx="180" cy="229" rx="14" ry="18" fill="url(#${p}-gold)" stroke="#f4e1ad" stroke-width="2.3"/>
        <ellipse cx="180" cy="229" rx="10" ry="14" fill="url(#${p}-blue)" stroke="#48659b" stroke-width="1.8"/>
        <path d="m179 218-5 10 5 9 5-9Z" fill="#d7ffff" stroke="none"/>
        <ellipse class="crystal-halo" cx="180" cy="228" rx="15" ry="21" fill="#99eaff" opacity=".6" stroke="none" filter="url(#${p}-glow)"/>
      </g>
    </g>
    <g class="hero-neutral-arms">
      <g class="hero-left-arm">
        <path d="M139 195q-13-6-22 7l-18 42 9 25 25-8 8-26 7-26Z" fill="url(#${p}-purple)"/>
        <path d="M136 195q-13-6-19 7l-7 19 25 11 10-23Z" fill="url(#${p}-red)"/>
        <path d="m119 206-10 22 9 10 14-14-4-11Z" fill="url(#${p}-silver)" stroke-width="1.7"/>
        <path d="m100 251 25 9-4 30-7 12-20-6-4-12Z" fill="url(#${p}-silver)"/>
        <path d="m102 257 15 5-7 19-14 1Z" fill="url(#${p}-purple)" stroke="none"/>
        <path d="m95 286 18 6m-13-2-3-8" fill="none" stroke="#fff" stroke-width="2" opacity=".65"/>
        <path d="m93 290 22 6 1 14-6 9-17-3-7-9Z" fill="url(#${p}-silver)"/>
        <path d="m95 301 12 4m-13 3 9 3" fill="none" stroke-width="1.5"/>
      </g>
      <g class="hero-right-arm">
        <path d="M221 195q13-6 22 7l18 42-9 25-25-8-8-26-7-26Z" fill="url(#${p}-purple)"/>
        <path d="M224 195q13-6 19 7l7 19-25 11-10-23Z" fill="url(#${p}-red)"/>
        <path d="m241 206 10 22-9 10-14-14 4-11Z" fill="url(#${p}-silver)" stroke-width="1.7"/>
        <path d="m260 251-25 9 4 30 7 12 20-6 4-12Z" fill="url(#${p}-silver)"/>
        <path d="m258 257-15 5 7 19 14 1Z" fill="url(#${p}-purple)" stroke="none"/>
        <path d="m265 286-18 6m13-2 3-8" fill="none" stroke="#fff" stroke-width="2" opacity=".65"/>
        <path d="m267 290-22 6-1 14 6 9 17-3 7-9Z" fill="url(#${p}-silver)"/>
        <path d="m265 301-12 4m13 3-9 3" fill="none" stroke-width="1.5"/>
      </g>
    </g>
    <g class="hero-head">
      <path d="m124 100-13-9-7 9 3 39 14 14m115-53 13-9 7 9-3 39-14 14" fill="url(#${p}-silver)"/>
      <path d="m111 107 7 7-1 23-6-4m138-26-7 7 1 23 6-4" fill="#68758f" stroke="none"/>
      <path d="M180 42c-43 0-66 26-67 63l8 44 23 30 36 18 36-18 23-30 8-44c-1-37-24-63-67-63Z" fill="url(#${p}-face)"/>
      <path d="M179 43q-40 1-56 38l4 40 20 38 32 34-24-42-13-37 3-38Z" fill="#fff" opacity=".18" stroke="none"/>
      <path d="M176 49q-38 6-46 37l15 23 19 10-8-18-11-18q7-17 25-22Zm8 0q38 6 46 37l-15 23-19 10 8-18 11-18q-7-17-25-22Z" fill="#7d8aa6" stroke="none"/>
      <path d="M175 47q-37 4-48 37l17 21 12 6-13-27q7-18 24-24Zm10 0q37 4 48 37l-17 21-12 6 13-27q-7-18-24-24Z" fill="url(#${p}-silver)" stroke="#b6c2d6" stroke-width="1.2"/>
      <path d="m180 22-10 26-7 35 17 32 17-32-7-35Z" fill="url(#${p}-silver)"/>
      <path d="m180 29-3 24-4 25 7 14 7-14-4-25Z" fill="#f6faff" stroke="none"/>
      <path d="m180 72-9 12 9 15 9-15Z" fill="url(#${p}-gold)" stroke="#b19a65" stroke-width="1.4"/>
      <path d="m180 77-5 7 5 9 5-9Z" fill="#8f83d8" stroke="none"/>
      <path d="m180 79-2 5 2 5 2-5Z" fill="#e9e8ff" stroke="none"/>
      <path d="m126 99 31 7 11 19-18 15-24-13-7-17Zm108 0-31 7-11 19 18 15 24-13 7-17Z" fill="#6c7891" stroke="#b6c6d8" stroke-width="1.7"/>
      <g class="hero-eyes" stroke="#f4e7ba" stroke-width="1.5">
        <path d="m128 104 26 7 8 13-13 9-18-10-7-13Z" fill="url(#${p}-eyes)"/>
        <path d="m232 104-26 7-8 13 13 9 18-10 7-13Z" fill="url(#${p}-eyes)"/>
        <path d="m130 108 19 6-14 6Zm100 0-19 6 14 6Z" fill="#fff" stroke="none"/>
      </g>
      <path d="m126 140 21 14 18-5m69-9-21 14-18-5" fill="none" stroke="#8b99b0" stroke-width="2.3"/>
      <path d="m171 134-5 19 14 6 14-6-5-19" fill="#cbd6e7" stroke="#9ba9be" stroke-width="1.5"/>
      <path d="m160 165 20 6 20-6-9 13h-22Z" fill="#79879e" stroke="#e2eaf5" stroke-width="1.3"/>
      <path d="m165 167 15 4 15-4" fill="none" stroke="#fff" stroke-width="2"/>
      <path d="m136 78 8-11m80 11-8-11" fill="none" stroke="#fff" opacity=".8" stroke-width="3"/>
    </g>
    <g class="hero-defense-arms">
      <path d="M137 199q-13-1-18 11l-3 37q4 17 21 20l19-16-16-13 7-25Z" fill="url(#${p}-purple)"/>
      <path d="M223 199q13-1 18 11l3 37q-4 17-21 20l-19-16 16-13-7-25Z" fill="url(#${p}-purple)"/>
      <path d="m123 209 13-9 11 13-7 17-20-4Zm114 0-13-9-11 13 7 17 20-4Z" fill="url(#${p}-red)"/>
      <g class="hero-defense-left">
        <path d="m128 249 18 22 73-58-17-23Z" fill="url(#${p}-silver)" stroke-width="4"/>
        <path d="m142 248 9 11 54-47-8-10Z" fill="url(#${p}-purple)" stroke-width="1.4"/>
        <path d="m202 191 5-12 11-5 10 8 1 13-11 17Z" fill="url(#${p}-silver)"/>
        <path d="m214 181 9 7m-14 0 11 8" fill="none" stroke-width="1.5"/>
      </g>
      <g class="hero-defense-right">
        <path d="m232 249-18 22-73-58 17-23Z" fill="url(#${p}-silver)" stroke-width="4"/>
        <path d="m218 248-9 11-54-47 8-10Z" fill="url(#${p}-purple)" stroke-width="1.4"/>
        <path d="m158 191-5-12-11-5-10 8-1 13 11 17Z" fill="url(#${p}-silver)"/>
        <path d="m146 181-9 7m14 0-11 8" fill="none" stroke-width="1.5"/>
        <path d="m164 217 48 39" fill="none" stroke="#fff5dd" stroke-width="2.5"/>
      </g>
    </g>
    <g class="hero-beam-arms">
      <path d="M137 201q-16-3-20 12l-4 28q4 14 21 15l66-8-1-23-57 4 4-17Z" fill="url(#${p}-red)"/>
      <path d="m121 218-7 23 13 10 14-9-4-14Z" fill="url(#${p}-purple)" stroke="none"/>
      <path d="m140 228 5 28 54-8-1-23Z" fill="url(#${p}-silver)"/>
      <path d="m151 234 39-3-1 11-35 5Z" fill="url(#${p}-purple)" stroke="none"/>
      <path d="m197 226 15-2 12 5-2 13-12 6-13-2Z" fill="url(#${p}-silver)"/>
      <path d="M221 201q17-3 20 12l4 29q-4 12-18 12h-15l-4-48Z" fill="url(#${p}-red)"/>
      <path d="m231 218 12 10 2 14-17 9-13-5 3-20Z" fill="url(#${p}-purple)" stroke="none"/>
      <path d="m207 234 24-2-2-60-25 1Z" fill="url(#${p}-silver)"/>
      <path d="m210 227 11-1-1-46-9 1Z" fill="url(#${p}-purple)" stroke-width="1.3"/>
      <path d="m204 174-3-17 3-18 8-2 10 4 6 14 1 18Z" fill="url(#${p}-silver)"/>
      <path d="m210 145-1 15m7-14 1 14m5-9 1 10" stroke-width="1.4" fill="none"/>
      <g class="hero-beam-flare" stroke="none"><ellipse cx="235" cy="213" rx="26" ry="32" fill="#d9c2ff" opacity=".7" filter="url(#${p}-glow)"/><path d="m235 180 7 24 22 9-22 7-7 23-6-23-17-7 17-9Z" fill="#fffaf0"/></g>
    </g>
  </g>
  <g class="hero-shield" fill="none" stroke="#dfc9ff">
    <ellipse cx="180" cy="222" rx="111" ry="130" fill="url(#${p}-shield)" stroke-width="2.5"/>
    <ellipse cx="180" cy="222" rx="120" ry="139" stroke-width="1" stroke-dasharray="16 8 3 8" opacity=".65"/>
    <path d="m180 100 96 57v112l-96 66-96-66V157Zm0 0v45m96 12-36 23m36 89-36-21m-60 87v-43m-96-23 37-23m-37-89 37 23" stroke-width="1" opacity=".45"/>
    <path d="M79 186q-9 35 2 69m198-48q4 29-7 56" stroke="#fff2d0" stroke-width="5"/>
  </g>
  </svg>`;
}
