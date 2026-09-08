// Zero's double head fins and blue/red armor use the established articulated hero rig.
const safeId = value => String(value).replace(/[^a-zA-Z0-9_-]/g, '-');

export function zeroSVG(id = 'zero') {
  const p = `zero-${safeId(id)}`;
  return `<svg class="character-art hero-art ally-art zero-art" viewBox="0 0 360 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="赛罗奥特曼，双银色头镖、金色眼睛与蓝红双色战衣">
  <defs>
    <linearGradient id="${p}-silver" x1="0" y1="0" x2="1" y2=".8"><stop stop-color="#ffffff"/><stop offset=".3" stop-color="#e5e9f5"/><stop offset=".57" stop-color="#9daec5"/><stop offset=".78" stop-color="#e4edf5"/><stop offset="1" stop-color="#75849e"/></linearGradient>
    <linearGradient id="${p}-face" x1="0" y1=".2" x2="1" y2=".8"><stop stop-color="#b9c4dc"/><stop offset=".3" stop-color="#fbffff"/><stop offset=".66" stop-color="#dae4ef"/><stop offset="1" stop-color="#8c9bb3"/></linearGradient>
    <linearGradient id="${p}-red" x1="0" y1="0" x2=".9" y2="1"><stop stop-color="#ff7a7d"/><stop offset=".32" stop-color="#de4658"/><stop offset=".72" stop-color="#a91f41"/><stop offset="1" stop-color="#681933"/></linearGradient>
    <linearGradient id="${p}-suit-blue" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#82d4ff"/><stop offset=".32" stop-color="#338bd3"/><stop offset=".7" stop-color="#21519a"/><stop offset="1" stop-color="#122b61"/></linearGradient>
    <linearGradient id="${p}-blue" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#edffff"/><stop offset=".28" stop-color="#9cf6ff"/><stop offset=".7" stop-color="#4baded"/><stop offset="1" stop-color="#3157b7"/></linearGradient>
    <linearGradient id="${p}-eyes" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fffbe2"/><stop offset=".55" stop-color="#ffe17a"/><stop offset="1" stop-color="#f3ad36"/></linearGradient>
    <radialGradient id="${p}-aura"><stop stop-color="#a4edff" stop-opacity=".52"/><stop offset=".55" stop-color="#57c9ff" stop-opacity=".16"/><stop offset="1" stop-color="#388fea" stop-opacity="0"/></radialGradient>
    <linearGradient id="${p}-shield" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff4d4" stop-opacity=".22"/><stop offset=".5" stop-color="#94dbff" stop-opacity=".035"/><stop offset="1" stop-color="#5cbeff" stop-opacity=".25"/></linearGradient>
    <filter id="${p}-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="3"/></filter>
  </defs>
  <ellipse class="actor-shadow hero-shadow" cx="180" cy="388" rx="73" ry="13" fill="#19243c" opacity=".28"/>
  <g class="hero-power-aura"><ellipse cx="180" cy="225" rx="153" ry="190" fill="url(#${p}-aura)"/><path d="m88 283-13-50 20-51-9-43m185 154 14-54-18-47 12-59m-151-40 18-29m78 27-12-36" fill="none" stroke="#a2eaff" stroke-width="3"/><path d="m76 186 6-17m202 101 5-18" fill="none" stroke="#e1faff" stroke-width="3"/></g>
  <g class="hero-rig" stroke="#3b435d" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
    <g class="hero-left-leg">
      <path d="m140 281 37 7-4 41-11 37-29-2-7-29Z" fill="url(#${p}-red)"/>
      <path d="m140 289 14 7-5 29-17 14-6-4Z" fill="url(#${p}-suit-blue)" stroke-width="1.7"/>
      <path d="m150 304 15 4-7 26 11 7-7 29-28-1-8-29 14-14Z" fill="url(#${p}-silver)"/>
      <path d="m142 340 10 4 9-3-8 23-10-1Z" fill="#fff" opacity=".5" stroke="none"/>
      <path d="M135 357q14 11 28 2l4 17q-6 10-24 10l-27-1q-6-7 1-15Z" fill="url(#${p}-silver)"/>
      <path d="M116 379q24 7 49-2" fill="none" stroke="#626e89"/>
    </g>
    <g class="hero-right-leg">
      <path d="m183 288 38-8 11 55-6 29-29 2-15-38Z" fill="url(#${p}-red)"/>
      <path d="m220 289-14 7 5 29 17 14 4-4Z" fill="url(#${p}-suit-blue)" stroke-width="1.7"/>
      <path d="m210 304-15 4 7 26-11 7 6 29 28-1 7-29-14-14Z" fill="url(#${p}-silver)"/>
      <path d="m218 340-10 4-9-3 8 23 10-1Z" fill="#fff" opacity=".45" stroke="none"/>
      <path d="M197 359q13 8 28-2l20 14q7 9 0 14l-27 1q-18 0-25-10Z" fill="url(#${p}-silver)"/>
      <path d="M195 377q24 9 50 2" fill="none" stroke="#626e89"/>
    </g>
    <g class="hero-torso">
      <path d="m161 176-20 18-17 29 13 40-1 26q42 21 87-1l-1-27 14-41-18-26-17-18Z" fill="url(#${p}-suit-blue)"/>
      <path d="m131 223 17 6 8 35 24 20 24-20 8-35 17-6-7 39 1 26q-44 20-87 1l1-26Z" fill="url(#${p}-red)"/>
      <path d="m151 247 29 12 29-12-7 21-22 20-22-20Z" fill="url(#${p}-suit-blue)" stroke="#acd7ed" stroke-width="1.5"/>
      <path d="m148 190 18-10 14 9 14-9 19 10 17 13-8 30-23-7-19 13-19-13-23 7-8-30Z" fill="url(#${p}-silver)"/>
      <path d="m140 202 17-7 23 12 23-12 17 7-4 16-15-5-21 14-21-14-15 5Z" fill="#387fc2" stroke="#d9f2ff" stroke-width="1.6"/>
      <path d="m143 205 12-4 7 6-16 5Zm17-2 15 8-1 8-13-8Zm24 8 15-8-1 8-13 8Zm21-10 12 4-3 7-16-5Z" fill="url(#${p}-silver)" stroke="#819fbc" stroke-width="1"/>
      <path d="m145 221 13-4 11 8-5 8-18-5Zm70 0-13-4-11 8 5 8 18-5Z" fill="url(#${p}-silver)" stroke-width="1.5"/>
      <path d="m164 185 16 9 16-9-3 13-13 8-13-8Z" fill="#788fac"/>
      <path d="m145 253 9 7m-7 9 13 8m55-24-9 7m7 9-13 8" stroke="#ffb4ab" stroke-width="2"/>
      <path d="m157 287 23 8 23-8-5 12h-36Z" fill="url(#${p}-silver)"/>
      <g class="hero-crystal">
        <path d="m180 209 15 14-4 18-11 8-11-8-4-18Z" fill="url(#${p}-silver)" stroke="#e2f1ff" stroke-width="2.3"/>
        <path d="m180 216 9 10-3 13-6 4-6-4-3-13Z" fill="url(#${p}-blue)" stroke="#48659b" stroke-width="1.8"/>
        <path d="m179 220-4 8 4 9 5-9Z" fill="#efffff" stroke="none"/>
        <ellipse class="crystal-halo" cx="180" cy="228" rx="15" ry="21" fill="#99eaff" opacity=".6" stroke="none" filter="url(#${p}-glow)"/>
      </g>
    </g>
    <g class="hero-neutral-arms">
      <g class="hero-left-arm">
        <path d="M139 195q-13-6-22 7l-18 42 9 25 25-8 8-26 7-26Z" fill="url(#${p}-suit-blue)"/>
        <path d="M136 195q-13-6-19 7l-7 19 25 11 10-23Z" fill="url(#${p}-red)"/>
        <path d="m119 206-10 22 9 10 14-14-4-11Z" fill="url(#${p}-silver)" stroke-width="1.7"/>
        <path d="m100 251 25 9-4 30-7 12-20-6-4-12Z" fill="url(#${p}-silver)"/>
        <path d="m102 257 15 5-7 19-14 1Z" fill="url(#${p}-suit-blue)" stroke="none"/>
        <path d="m95 286 18 6m-13-2-3-8" fill="none" stroke="#fff" stroke-width="2" opacity=".65"/>
        <path d="m93 290 22 6 1 14-6 9-17-3-7-9Z" fill="url(#${p}-silver)"/>
        <path d="m95 301 12 4m-13 3 9 3" fill="none" stroke-width="1.5"/>
      </g>
      <g class="hero-right-arm">
        <path d="M221 195q13-6 22 7l18 42-9 25-25-8-8-26-7-26Z" fill="url(#${p}-suit-blue)"/>
        <path d="M224 195q13-6 19 7l7 19-25 11-10-23Z" fill="url(#${p}-red)"/>
        <path d="m241 206 10 22-9 10-14-14 4-11Z" fill="url(#${p}-silver)" stroke-width="1.7"/>
        <path d="m260 251-25 9 4 30 7 12 20-6 4-12Z" fill="url(#${p}-silver)"/>
        <path d="m258 257-15 5 7 19 14 1Z" fill="url(#${p}-suit-blue)" stroke="none"/>
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
      <g class="zero-left-fin">
        <path d="M162 103 151 80l-18-13-3-32 9-22 8 28 21 23 3 22Z" fill="url(#${p}-silver)" stroke-width="3"/>
        <path d="m140 24-3 14 4 25 18 16 3 14 2-18-22-28Z" fill="#f6ffff" stroke="none"/>
        <path d="m132 37 7 26 17 17 4 19" fill="none" stroke="#91acc6" stroke-width="2"/>
      </g>
      <g class="zero-right-fin">
        <path d="M198 103 209 80l18-13 3-32-9-22-8 28-21 23-3 22Z" fill="url(#${p}-silver)" stroke-width="3"/>
        <path d="m220 24 3 14-4 25-18 16-3 14-2-18 22-28Z" fill="#f6ffff" stroke="none"/>
        <path d="m228 37-7 26-17 17-4 19" fill="none" stroke="#91acc6" stroke-width="2"/>
      </g>
      <path d="m180 52-9 17 2 25 7 13 7-13 2-25Z" fill="url(#${p}-silver)" stroke="#93afc9" stroke-width="1.5"/>
      <path d="m180 72-6 10 6 13 6-13Z" fill="#4cbfad" stroke="#527d87" stroke-width="1.4"/>
      <path d="m180 75-2 7 2 7 3-7Z" fill="#d2fff4" stroke="none"/>
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
      <path d="M137 199q-13-1-18 11l-3 37q4 17 21 20l19-16-16-13 7-25Z" fill="url(#${p}-suit-blue)"/>
      <path d="M223 199q13-1 18 11l3 37q-4 17-21 20l-19-16 16-13-7-25Z" fill="url(#${p}-suit-blue)"/>
      <path d="m123 209 13-9 11 13-7 17-20-4Zm114 0-13-9-11 13 7 17 20-4Z" fill="url(#${p}-red)"/>
      <g class="hero-defense-left">
        <path d="m128 249 18 22 73-58-17-23Z" fill="url(#${p}-silver)" stroke-width="4"/>
        <path d="m142 248 9 11 54-47-8-10Z" fill="url(#${p}-suit-blue)" stroke-width="1.4"/>
        <path d="m202 191 5-12 11-5 10 8 1 13-11 17Z" fill="url(#${p}-silver)"/>
        <path d="m214 181 9 7m-14 0 11 8" fill="none" stroke-width="1.5"/>
      </g>
      <g class="hero-defense-right">
        <path d="m232 249-18 22-73-58 17-23Z" fill="url(#${p}-silver)" stroke-width="4"/>
        <path d="m218 248-9 11-54-47 8-10Z" fill="url(#${p}-suit-blue)" stroke-width="1.4"/>
        <path d="m158 191-5-12-11-5-10 8-1 13 11 17Z" fill="url(#${p}-silver)"/>
        <path d="m146 181-9 7m14 0-11 8" fill="none" stroke-width="1.5"/>
        <path d="m164 217 48 39" fill="none" stroke="#fff5dd" stroke-width="2.5"/>
      </g>
    </g>
    <g class="hero-beam-arms">
      <path d="M137 201q-16-3-20 12l-4 28q4 14 21 15l66-8-1-23-57 4 4-17Z" fill="url(#${p}-red)"/>
      <path d="m121 218-7 23 13 10 14-9-4-14Z" fill="url(#${p}-suit-blue)" stroke="none"/>
      <path d="m140 228 5 28 54-8-1-23Z" fill="url(#${p}-silver)"/>
      <path d="m151 234 39-3-1 11-35 5Z" fill="url(#${p}-suit-blue)" stroke="none"/>
      <path d="m197 226 15-2 12 5-2 13-12 6-13-2Z" fill="url(#${p}-silver)"/>
      <path d="M221 201q17-3 20 12l4 29q-4 12-18 12h-15l-4-48Z" fill="url(#${p}-red)"/>
      <path d="m231 218 12 10 2 14-17 9-13-5 3-20Z" fill="url(#${p}-suit-blue)" stroke="none"/>
      <path d="m207 234 24-2-2-60-25 1Z" fill="url(#${p}-silver)"/>
      <path d="m210 227 11-1-1-46-9 1Z" fill="url(#${p}-suit-blue)" stroke-width="1.3"/>
      <path d="m204 174-3-17 3-18 8-2 10 4 6 14 1 18Z" fill="url(#${p}-silver)"/>
      <path d="m210 145-1 15m7-14 1 14m5-9 1 10" stroke-width="1.4" fill="none"/>
      <g class="hero-beam-flare" stroke="none"><ellipse cx="235" cy="213" rx="26" ry="32" fill="#84e1ff" opacity=".7" filter="url(#${p}-glow)"/><path d="m235 180 7 24 22 9-22 7-7 23-6-23-17-7 17-9Z" fill="#fffaf0"/></g>
    </g>
  </g>
  <g class="hero-shield" fill="none" stroke="#97deff">
    <ellipse cx="180" cy="222" rx="111" ry="130" fill="url(#${p}-shield)" stroke-width="2.5"/>
    <ellipse cx="180" cy="222" rx="120" ry="139" stroke-width="1" stroke-dasharray="16 8 3 8" opacity=".65"/>
    <path d="m180 100 96 57v112l-96 66-96-66V157Zm0 0v45m96 12-36 23m36 89-36-21m-60 87v-43m-96-23 37-23m-37-89 37 23" stroke-width="1" opacity=".45"/>
    <path d="M79 186q-9 35 2 69m198-48q4 29-7 56" stroke="#fff2d0" stroke-width="5"/>
  </g>
  </svg>`;
}
