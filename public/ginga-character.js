// The source is an unmodified official suit photograph. Animated pieces reuse it
// through SVG clipping; no alternate illustration replaces Ginga's suit details.
const safeId = value => String(value).replace(/[^a-zA-Z0-9_-]/g, '-');

export function gingaSVG(id = 'ginga') {
  const p = `ginga-${safeId(id)}`;
  const source = `<use href="#${p}-photo"/>`;
  const part = name => `<g clip-path="url(#${p}-${name})">${source}</g>`;
  const leftUpper = part('upper-left');
  const rightUpper = part('upper-right');
  const leftLower = part('forearm-left');
  const rightLower = part('forearm-right');
  return `<svg class="character-art hero-art ginga-art" viewBox="0 0 360 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="银河奥特曼，电视剧真人皮套造型，蓝色水晶胸甲与圆形计时器">
    <defs>
      <image id="${p}-photo" href="/assets/ginga/ginga-official.png" width="403" height="948"/>
      <clipPath id="${p}-head"><path d="M132 0H268V157L241 190H162L132 157Z"/></clipPath>
      <clipPath id="${p}-torso"><path d="M162 174H241L250 208 278 216 298 278 278 349 265 410 279 477 289 519 268 548 201 551 141 546 112 516 126 443 130 405 113 348 105 282 123 214 153 208Z"/></clipPath>
      <clipPath id="${p}-leg-left"><path d="M118 474 165 495 206 525 205 557 182 598 156 664 143 716 112 838 99 884 77 948H0V829L65 709 78 660 90 576Z"/></clipPath>
      <clipPath id="${p}-leg-right"><path d="M205 522 245 492 279 474 313 589 328 673 344 720 403 842V948H324L307 884 290 836 263 720 249 666 224 590 201 551Z"/></clipPath>
      <clipPath id="${p}-upper-left"><path d="M43 187H125L125 220 116 255 107 289 98 319Q89 344 76 352L35 339 42 303 47 276 42 247Z"/></clipPath>
      <clipPath id="${p}-upper-right"><path d="M278 187H359L364 247 357 280 369 339 328 352Q313 340 307 319L298 289 288 255 278 220Z"/></clipPath>
      <clipPath id="${p}-forearm-left"><path d="M37 320Q63 326 99 337L79 391 52 445 45 478 52 511 36 535H0V387Z"/></clipPath>
      <clipPath id="${p}-forearm-right"><path d="M304 337Q340 326 366 320L403 388V535H364L347 507 354 480 348 446 326 391Z"/></clipPath>
      <radialGradient id="${p}-aura"><stop stop-color="#82f2ff" stop-opacity=".34"/><stop offset=".58" stop-color="#36cfff" stop-opacity=".12"/><stop offset="1" stop-color="#19bcff" stop-opacity="0"/></radialGradient>
      <radialGradient id="${p}-light"><stop stop-color="#efffff"/><stop offset=".28" stop-color="#a3f5ff" stop-opacity=".7"/><stop offset="1" stop-color="#20d9ff" stop-opacity="0"/></radialGradient>
      <linearGradient id="${p}-shield" x2="1" y2="1"><stop stop-color="#c8fcff" stop-opacity=".13"/><stop offset=".5" stop-color="#73eaff" stop-opacity=".025"/><stop offset="1" stop-color="#59d9ff" stop-opacity=".18"/></linearGradient>
    </defs>
    <ellipse class="actor-shadow" cx="180" cy="397" rx="73" ry="11" fill="#061c2e" opacity=".28"/>
    <g class="hero-power-aura"><ellipse cx="180" cy="208" rx="137" ry="192" fill="url(#${p}-aura)"/><path d="m101 316-12-44 17-44-9-38m164 126 11-45-16-44 10-37" fill="none" stroke="#9bf3ff" stroke-width="1.5" opacity=".55"/></g>
    <g class="hero-rig">
      <svg class="ginga-photo-space" x="98" y="10" width="164" height="386" viewBox="0 0 403 948" overflow="visible">
        <g class="ginga-idle-photo">${source}</g>
        <g class="ginga-segmented">
          <g class="hero-left-leg">${part('leg-left')}</g>
          <g class="hero-right-leg">${part('leg-right')}</g>
          <g class="hero-torso">${part('torso')}</g>
          <g class="hero-head">${part('head')}</g>
          <g class="hero-neutral-arms">
            <g class="hero-left-arm">${leftUpper}<g class="ginga-left-forearm">${leftLower}</g></g>
            <g class="hero-right-arm">${rightUpper}<g class="ginga-right-forearm">${rightLower}</g></g>
          </g>
          <g class="hero-defense-arms">
            <g transform="rotate(-22 96 223)">${leftUpper}</g>
            <g transform="rotate(22 307 223)">${rightUpper}</g>
            <g class="hero-defense-left" transform="translate(43 1) rotate(-138 72 332)">${leftLower}</g>
            <g class="hero-defense-right" transform="translate(-43 1) rotate(138 331 332)">${rightLower}</g>
          </g>
          <g class="hero-beam-arms">
            <g transform="rotate(-14 96 223)">${leftUpper}</g>
            <g transform="rotate(32 307 223)">${rightUpper}</g>
            <g transform="translate(31 3) rotate(-106 72 332)">${leftLower}</g>
            <g transform="translate(-61 -4) rotate(-164 331 332)">${rightLower}</g>
          </g>
        </g>
        <g class="hero-crystal"><circle class="crystal-halo" cx="198" cy="242" r="24" fill="url(#${p}-light)"/></g>
        <rect class="hero-head-anchor" x="145" y="15" width="114" height="162" fill="none" pointer-events="none"/>
        <g transform="translate(30 50)"><g class="hero-beam-flare"><circle cx="235" cy="213" r="23" fill="url(#${p}-light)"/><path d="m235 193 4 16 17 4-17 4-4 16-4-16-17-4 17-4Z" fill="#e7ffff"/></g></g>
      </svg>
    </g>
    <g class="hero-shield" fill="none" stroke="#9aecff"><ellipse cx="181" cy="207" rx="97" ry="177" fill="url(#${p}-shield)" stroke-width="1.6"/><ellipse cx="181" cy="207" rx="104" ry="183" stroke-width=".8" stroke-dasharray="16 7 2 7" opacity=".6"/><path d="m181 31 87 83v184l-87 85-87-85V114Z" stroke-width=".7" opacity=".4"/></g>
    <g class="hero-sleep-symbols" fill="#b7edff" font-family="sans-serif" font-weight="700"><text x="230" y="75" font-size="18">z</text><text x="255" y="52" font-size="25">Z</text></g>
    <g class="hero-heart" fill="#ffb3c0" stroke="#ffdce4" stroke-width="1"><path d="M260 136c-18-13-24-23-16-30 5-5 12-2 16 3 5-5 12-8 17-3 8 7 1 17-17 30Z"/></g>
  </svg>`;
}
