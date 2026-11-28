import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Reproducible vector illustration; the renderer is a temporary build tool,
// not a dependency downloaded by visitors or included in the public release.
const require = createRequire(join(tmpdir(), 'mesa-seo-render-tools', 'render.cjs'));
const { Resvg } = require('@resvg/resvg-js');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#e6e4d9"/>
<path d="M0 520H1200M0 550H1200M0 580H1200" stroke="#dad8ce" stroke-width="2"/>
<rect x="223" y="93" width="760" height="471" rx="12" fill="#100f0f" opacity=".08"/>
<path d="M235 78Q415 45 600 92Q785 45 965 78V531Q785 496 600 545Q415 496 235 531Z" fill="#fffcf0" stroke="#b7b5ac" stroke-width="3"/>
<path d="M600 92V545" stroke="#cecdc3" stroke-width="3"/>
<g stroke="#b7b5ac" stroke-width="4" stroke-linecap="round">
<path d="M294 153H507M294 195H530M294 237H488M294 279H522M294 321H470M294 363H536M294 405H497M294 447H510"/>
<path d="M658 153H903M658 195H878M658 237H899M658 279H861M658 321H893M658 363H843M658 405H884"/>
</g>
<g stroke="#9a6e3a" stroke-width="6" stroke-linecap="round"><path d="M297 170h22m24 0h22m24 0h22m24 0h22M661 296h22m24 0h22m24 0h22m24 0h22"/></g>
<path d="M842 432L1034 143L1065 165L873 454L828 475Z" fill="#43856b" stroke="#285b46" stroke-width="3"/>
<path d="M842 432L873 454L828 475Z" fill="#d0a77b"/><path d="M828 475L839 454L849 461Z" fill="#343331"/>
<path d="M1040 134L1052 116Q1057 109 1065 115L1083 128Q1090 133 1085 141L1072 160Z" fill="#da702c"/>
<circle cx="143" cy="376" r="65" fill="#b7b5ac" opacity=".35"/><circle cx="139" cy="364" r="57" fill="#fffcf0" stroke="#9f9d95" stroke-width="4"/><circle cx="139" cy="364" r="42" fill="#6f4e37"/><path d="M194 344Q237 340 226 375Q220 392 195 384" fill="none" stroke="#9f9d95" stroke-width="9"/>
</svg>`;
await writeFile('assets/social-preview.svg', svg);
await writeFile('assets/social-preview.png', new Resvg(svg).render().asPng());
console.log('Created assets/social-preview.svg and 1200×630 PNG.');
