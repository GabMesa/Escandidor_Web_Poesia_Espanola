import { writeFile } from 'node:fs/promises';

// /recursos, /formas-poeticas y /concursos-de-poesia se renderizan en servidor (SSR)
// desde D1 mediante functions/recursos.js, functions/formas-poeticas.js y functions/concursos-de-poesia.js.
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const publishedDate = '2026-11-22';

const pages = [
  {
    slug: 'componer-versos',
    title: 'Cómo componer versos y revisar un poema | Mesa de Poesía',
    heading: 'Cómo componer versos: del borrador al ritmo',
    eyebrow: 'Guías de escritura y métrica',
    description: 'Una guía para escribir versos en español: elegir imágenes, revisar el ritmo, decidir la rima y conservar versiones con Mesa de Poesía.',
    content: `<p>Componer versos empieza con algo que querés decir: una escena, una sensación o una pregunta. No hace falta resolver la rima antes de escribir. En Mesa de Poesía podés trabajar un borrador, escuchar su ritmo y comparar versiones en el mismo taller.</p>
    <h2>1. Escribí una escena antes de buscar la rima</h2><p>Elegí un detalle concreto: la luz de una ventana, una conversación o un objeto que quedó sobre la mesa. Anotá lo que ves y lo que cambia. Después dividí esas frases en versos y leelas en voz alta. El corte de un verso puede sostener una pausa o dejar una idea abierta para el siguiente.</p>
    <h2>2. Elegí entre verso libre y una medida regular</h2><p>En el verso libre no necesitás repetir una cantidad fija de sílabas ni un esquema de rima. Aun así, las pausas, las repeticiones y los acentos construyen ritmo. Si buscás una medida regular, probá con un verso corto y revisá que los demás mantengan el mismo pulso.</p><p>El <a href="/taller/">escandidor del taller de poesía</a> te ayuda a separar versos en sílabas y revisar su medida. El conteo depende de la pronunciación, las sinalefas y la palabra final; si querés estudiarlo a fondo con autores de referencia, visitá la sección de métrica del <a href="/recursos#metrica">mapa de recursos curados</a>.</p>
    <h2>3. Revisá acentos y rimas sin perder el sentido</h2><p>Dos versos con el mismo número de sílabas pueden sonar distintos porque sus acentos caen en lugares diferentes. Leelos con la intención que buscás y comprobá si alguna palabra obliga a una pronunciación poco natural.</p><p>La rima consonante repite sonidos vocálicos y consonánticos desde la última vocal tónica; la asonante repite las vocales. Probá varias palabras, pero conservá la imagen y el sentido del poema. También podés escribir sin rima.</p>
    <h2>4. Guardá una versión antes de cambiar el poema</h2><p>Un cambio puede mejorar el ritmo y debilitar una imagen. Conservá el borrador para comparar las dos lecturas. El taller permite organizar poemas, revisar su historial y exportar el trabajo. Sin cuenta, el guardado queda en este navegador: descargá una copia si vas a cambiar de dispositivo.</p>
    <h2>Un ejercicio para empezar</h2><ol><li>Describí una escena en cuatro frases breves.</li><li>Convertí cada frase en un verso y leelo en voz alta.</li><li>Revisá una sola cosa: los cortes, la medida o la rima.</li><li>Guardá ambas versiones y compará qué lectura expresa mejor la escena.</li></ol>
    <p><a class="cta" href="/taller/">Abrir el taller y escribir un poema ↗</a></p>`,
  },
];

for (const page of pages) {
  const url = `https://poesia.mimesa.dev/${page.slug}`;
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: page.heading,
        description: page.description,
        inLanguage: 'es',
        datePublished: publishedDate,
        dateModified: publishedDate,
        mainEntityOfPage: url,
        image: 'https://poesia.mimesa.dev/assets/social-preview.png',
        author: { '@type': 'Organization', name: 'Mesa de Poesía', url: 'https://poesia.mimesa.dev/' },
        publisher: { '@type': 'Organization', name: 'Mesa de Poesía', url: 'https://poesia.mimesa.dev/' },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://poesia.mimesa.dev/' },
          { '@type': 'ListItem', position: 2, name: page.heading, item: url },
        ],
      },
    ],
  };

  await writeFile(`${page.slug}.html`, `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(page.title)}</title><meta name="description" content="${escape(page.description)}">
<meta name="robots" content="index, follow, max-image-preview:large"><link rel="canonical" href="${url}">
<link rel="icon" href="/favicon.ico" sizes="64x64"><meta name="theme-color" content="#E6E4D9"><meta property="og:type" content="article"><meta property="og:locale" content="es_ES">
<meta property="og:site_name" content="Mesa de Poesía"><meta property="og:title" content="${escape(page.title)}">
<meta property="og:description" content="${escape(page.description)}"><meta property="og:url" content="${url}">
<meta property="og:image" content="https://poesia.mimesa.dev/assets/social-preview.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Cuaderno abierto con versos, marcas de métrica y un lápiz sobre una mesa">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(page.title)}"><meta name="twitter:description" content="${escape(page.description)}"><meta name="twitter:image" content="https://poesia.mimesa.dev/assets/social-preview.png">
<script src="/theme-init.js"></script><link rel="stylesheet" href="/landing.css"><link rel="stylesheet" href="/identity.css"><link rel="stylesheet" href="/guides.css"><script src="/theme.js" defer></script>
<script type="application/ld+json">${JSON.stringify(schema)}</script></head>
<body class="landing-page"><a class="skip" href="#contenido">Saltar al contenido</a><header class="publication-header"><nav class="publication-nav" aria-label="Navegación principal"><a class="publication-brand" href="/">Mesa de Poesía<span aria-hidden="true">.</span></a><div class="publication-links"><a href="/">Inicio</a><a href="/taller/">Taller</a><a href="/recursos">Recursos</a><a href="/formas-poeticas">Formas poéticas</a><a href="/concursos-de-poesia">Concursos</a><button type="button" class="theme-toggle" data-theme-toggle aria-label="Cambiar a modo oscuro" aria-pressed="false">Modo oscuro</button></div></nav><div class="edition-line"><span>Un taller de poesía en español</span><span>Aprender · Medir · Revisar · Presentar</span></div></header>
<main id="contenido" class="container guide"><article><p class="label">${escape(page.eyebrow)}</p><h1>${escape(page.heading)}</h1>${page.content}</article></main>
<footer class="container footer"><a href="/">Mesa de Poesía</a><nav aria-label="Enlaces del pie"><a href="/taller/">Abrir mi mesa</a><a href="/recursos">Recursos</a><a href="/formas-poeticas">Formas poéticas</a><a href="/concursos-de-poesia">Concursos</a><a href="/apoyar">Donaciones</a><a href="/privacidad">Privacidad</a><a href="/agradecimientos">Atribuciones</a></nav></footer></body></html>\n`);
}

console.log(`Built ${pages.length} static editorial page(s).`);
