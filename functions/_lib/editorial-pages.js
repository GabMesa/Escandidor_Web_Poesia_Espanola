import { escapeHtml, renderEditorialMarkdown } from '../../editorial-markdown.js';

export const RESERVED_SLUGS = new Set([
  '',
  'index',
  'taller',
  'escandidor',
  'escandidor-de-poesia',
  'admin',
  'api',
  'apoyar',
  'privacidad',
  'agradecimientos',
  'landing',
  'assets',
  'vendor',
  'licenses',
  'opendyslexic-0.92',
  'robots',
  'sitemap',
  'favicon',
  '404',
  'separar-en-silabas',
  'separar-en-silabas-metricas',
  'componer-versos',
  'metrica',
]);

const PUBLISHED_FALLBACK_DATE = '2026-11-22';

export const DEFAULT_EDITORIAL_PAGES = Object.freeze([
  {
    slug: 'recursos',
    title: 'Recursos para aprender poesía y métrica en español | Mesa de Poesía',
    heading: 'Mapa de recursos para aprender poesía en español',
    eyebrow: 'Recurso de recursos · Enlaces validados',
    description: 'Centralizamos lecturas, videos y comunidad validados para aprender poesía y métrica en español: El Busto de Pallas, Vamos a hablar de métrica y Lufloro Panadero.',
    showInNav: 1,
    navLabel: 'Recursos',
    sortOrder: 10,
    published: 1,
    markdown: `Aprender poesía suele trabarse por lo que uno todavía no sabe que existe: sinalefas, acentos rítmicos, encabalgamientos, formas clásicas o cómo preparar una entrega a concurso. En lugar de reescribir manuales genéricos, acá centralizamos referencias creadas por poetas, divulgadores y comunidad para que estudies directo de las fuentes y practiques en el taller.

## Referencias principales de esta mesa

- **[El Busto de Pallas](https://discord.gg/mSz3ER2JKR)** — Comunidad de Discord enfocada en poesía, lectura compartida, dudas de oficio y acompañamiento entre personas que escriben.
- **[Vamos a hablar de métrica (índice completo, entrega XX)](https://www.lasnuevemusas.com/2018/03/06/vamos-a-hablar-de-metrica-xx/)** — Ciclo de 20 artículos de Ricardo Fernández Esteban en *Las nueve musas*: del ritmo acentual y las sinalefas al soneto, el romance y el verso libre.
- **[Canal de YouTube de Lufloro Panadero](https://www.youtube.com/@LufloroPanadero)** — Videos de Luis Flores Romero con explicaciones claras sobre métrica, ritmo, rimas, sonetos y escritura poética desde cero.

{{aviso:/taller/|Abrir el taller|**Cómo combinar esto con Mesa de Poesía:** el Escandidor ya separa tus versos en sílabas métricas automáticamente y deja a la vista sinalefas, acentos y rimas. Usá estas fuentes para entender el porqué y volvé al taller para probarlo sobre tus propios versos.}}

## 1. Empezar desde cero: qué es un poema y cómo entrenarte

Si recién empezás a escribir, conviene distinguir primero qué hace que un texto funcione como poema (ritmo, corte de verso, escucha) antes de pelearte con las reglas.

### Videos · Lufloro Panadero

- [Curso de poesía para principiantes](https://www.youtube.com/watch?v=UmMOpDs1INk) — Panorama inicial para arrancar desde cero.
- [¿Cómo se debe entender un poema?](https://www.youtube.com/watch?v=5SJQ-_HIYP0) — Claves de lectura para afinar tu propio criterio.
- [Deja de ser principiante en la poesía](https://www.youtube.com/watch?v=P4pU-mGAP50) — Hábitos y errores habituales al dar el siguiente salto.

### Lecturas · Vamos a hablar de métrica

- [¿Qué diferencia a la prosa del poema?](https://www.lasnuevemusas.com/2023/08/30/que-diferencia-a-la-prosa-del-poema/) — Por qué el ritmo y el corte cambian la lectura.
- [Vamos a hablar de métrica (I)](https://www.lasnuevemusas.com/2020/05/17/vamos-a-hablar-de-metrica/) — Introducción sin tecnicismos a la armonía del verso.
- [Vamos a hablar de métrica (II)](https://www.lasnuevemusas.com/2020/05/17/hablar-metrica-ii/) — ¿Hay que conocer las normas para saltárselas?
- [¿Qué es la métrica y para qué nos sirve?](https://www.lasnuevemusas.com/2020/06/12/que-es-la-metrica-y-para-que-nos-sirve/) — Una definición práctica orientada a quien escribe.

## 2. Sílabas métricas, licencias, acentos y encabalgamiento

Acá aparecen las piezas que suelen sorprender a quien empieza: por qué las sílabas del verso no siempre coinciden con las del diccionario, cuándo una pausa rompe una sinalefa, cómo el ritmo depende de dónde caen los acentos y qué efecto produce cortar una frase entre dos versos.

### Serie central · Vamos a hablar de métrica

- [III · El ritmo del verso: sílabas tónicas y átonas](https://www.lasnuevemusas.com/2020/05/20/ritmo-del-verso-la-alternancia-las-silabas-tonicas-atonas/) — Cómo la alternancia acentual crea musicalidad.
- [IV · La longitud del verso: simples y compuestos](https://www.lasnuevemusas.com/2020/05/29/la-longitud-del-verso-versos-simples-compuestos/) — Arte menor, arte mayor y versos con hemistiquios.
- [V · Agrupación y separación de sílabas al pronunciar](https://www.lasnuevemusas.com/2020/06/01/la-agrupacion-separacion-silabas-al-pronunciar-poema/) — Sinalefa, hiato, sinéresis y diéresis.
- [VI · Más sobre sinalefas e hiatos](https://www.lasnuevemusas.com/2020/06/11/mas-sinalefas-e-hiatos/) — Pausas y acentos fuertes que impiden la unión.
- [VII · Sinalefas e hiatos según las vocales](https://www.lasnuevemusas.com/2020/06/12/mas-sinalefas-hiatos-ii/) — Vocales abiertas, cerradas y tonicidad.
- [VIII · Últimos consejos sobre sinalefas e hiatos](https://www.lasnuevemusas.com/2020/06/16/ultimos-consejos-sobre-sinalefas-e-hiatos/) — Grupos de tres vocales y casos límite.
- [XII · Los encabalgamientos versales](https://www.lasnuevemusas.com/2020/07/30/los-encabalgamientos-versales/) — Desajuste entre pausa sintáctica y final de verso.
- [Las pausas del verso y del poema](https://www.lasnuevemusas.com/2020/08/28/las-pausas-del-verso-y-del-poema/) — Cesura, pausa estrófica y respiración.

### Videos · Lufloro Panadero

- [Cómo contar las sílabas métricas de un poema](https://www.youtube.com/watch?v=D_0G8oz5wCI) — Sinalefas y ley del acento final explicadas en video.
- [Cómo analizar la métrica de un poema](https://www.youtube.com/watch?v=zQg1lBbqiTs) — Recorrido completo sobre un poema real.
- [Metro y ritmo en la poesía](https://www.youtube.com/watch?v=6aPkTfs2A3M) — Por qué contar sílabas no alcanza sin cuidar el pulso.
- [Qué es el ritmo en la poesía](https://www.youtube.com/watch?v=IZJLOBxoS2o) — La cadencia más allá del número de sílabas.

## 3. Rima consonante, asonante, verso blanco y verso libre

Rimar bien no es forzar palabras al final del verso, y escribir verso libre tampoco significa abandonar el ritmo. Estas lecturas y videos ayudan a decidir con oído.

### Lecturas · Vamos a hablar de métrica

- [IX · La rima](https://www.lasnuevemusas.com/2020/06/19/la-rima/) — Consonancia, asonancia y función sonora.
- [X · La rima asonante](https://www.lasnuevemusas.com/2020/06/30/la-rima-asonante/) — Cómo escuchar y trabajar la coincidencia vocálica.
- [XI · Tipos y fuerza de la rima asonante](https://www.lasnuevemusas.com/2020/07/28/rima-asonante/) — Por qué algunas asonancias suenan más firmes que otras.
- [XIX · Versos blancos y versos libres](https://www.lasnuevemusas.com/2018/02/06/vamos-a-hablar-de-metrica-xix/) — Medida sin rima frente a verso libre.
- [El versolibrismo y los versos métricos que esconde](https://www.lasnuevemusas.com/2019/12/07/el-versolibrismo-y-los-versos-metricos-que-esconde/) — Por qué el verso libre sigue dialogando con la métrica.

### Videos · Lufloro Panadero

- [8 trucos para escribir buenas rimas](https://www.youtube.com/watch?v=PBjS7ZFkXbI) — Recursos prácticos para sonar natural.
- [Rimas que debes evitar en tus poemas](https://www.youtube.com/watch?v=6pxJB_o_dgY) — Cómo escapar de ripios y clichés repetidos.
- [Cómo escribir poemas en verso libre (tres formas)](https://www.youtube.com/watch?v=-FLA245fdDU) — Estrategias concretas para sostener un poema sin metro fijo.

## Siguientes pasos

- Explorá el [mapa de las 22 formas poéticas en español](/formas-poeticas) disponibles en el Escandidor.
- Si querés enviar obra a certámenes, revisá la guía de [concursos de poesía y plicas](/concursos-de-poesia).`,
  },
  {
    slug: 'formas-poeticas',
    title: 'Formas poéticas y estrofas en español: mapa y referencias | Mesa de Poesía',
    heading: 'Formas poéticas y estrofas en español',
    eyebrow: 'Métrica española · 22 formas integradas en el taller',
    description: 'Mapa curado de las 22 formas métricas del español disponibles en Mesa de Poesía: soneto, décima espinela, romance, lira, redondilla, silva y más, con lecturas de autores reales.',
    showInNav: 1,
    navLabel: 'Formas poéticas',
    sortOrder: 20,
    published: 1,
    markdown: `Esta referencia reúne las **22 formas poéticas clásicas** que ya podés activar en el [Escandidor de Mesa de Poesía](/taller/). En cada grupo te damos el esquema técnico exacto y te redirigimos a los artículos y videos de autores que explican cómo funcionan de verdad.

{{aviso:/taller/|Probar una forma en el taller|**Cómo probar cualquiera de estas formas:** abrí el taller, desplegá *Configuración → Forma poética* y elegí la estrofa. El Escandidor ajusta automáticamente las sílabas esperadas, los acentos clave, los hemistiquios y el esquema de rima.}}

## Estrofas de dos a cuatro versos

Combinaciones breves de arte menor y arte mayor, ideales para empezar a entrenar el oído, el cierre de estrofa y el contraste entre rima consonante y asonante.

{{formas:cortas}}

### Para estudiar con autores reales

- [Vamos a hablar de métrica XIV · Estrofas de dos a cuatro versos](https://www.lasnuevemusas.com/2017/05/08/hablar-metrica-xiv/) — Ricardo Fernández Esteban (*Las nueve musas*).
- [Vamos a hablar de métrica XIII · Clasificación de poemas e isometría](https://www.lasnuevemusas.com/2020/08/12/hablar-metrica-xiii/) — Ricardo Fernández Esteban (*Las nueve musas*).

## Estrofas de cinco a diez versos

Estructuras con mayor desarrollo rítmico: desde la lira renacentista y el pie quebrado hasta la décima espinela, una de las formas más vivas de la poesía en español.

{{formas:medianas}}

### Para estudiar con autores reales

- [Vamos a hablar de métrica XV · Estrofas de más de cuatro versos](https://www.lasnuevemusas.com/2017/06/03/hablar-metrica-xv/) — Ricardo Fernández Esteban (*Las nueve musas*).
- [Metro y ritmo en la poesía](https://www.youtube.com/watch?v=6aPkTfs2A3M) — Lufloro Panadero (YouTube).

## Poemas estróficos y series clásicas

Composiciones completas con tradición propia: el soneto de catorce endecasílabos, el romance narrativo y lírico, las silvas y la exigente sextina.

{{formas:poemas}}

### Para estudiar con autores reales

- [Vamos a hablar de métrica XVI · El soneto](https://www.lasnuevemusas.com/2017/08/03/hablar-metrica-xvi/) — Ricardo Fernández Esteban (*Las nueve musas*).
- [El soneto y alguna de sus variantes](https://www.lasnuevemusas.com/2022/01/27/el-soneto-y-alguna-de-sus-variantes/) — Ricardo Fernández Esteban (*Las nueve musas*).
- [Cómo escribir un soneto en 8 pasos](https://www.youtube.com/watch?v=iKu4czVh1Lg) — Lufloro Panadero (YouTube).
- [Cómo escribir versos endecasílabos (explicado en endecasílabos)](https://www.youtube.com/watch?v=RVgVZQZow7c) — Lufloro Panadero (YouTube).
- [Vamos a hablar de métrica XVII · El romance](https://www.lasnuevemusas.com/2018/01/06/vamos-a-hablar-de-metrica-xvii/) — Ricardo Fernández Esteban (*Las nueve musas*).
- [Vamos a hablar de métrica XVIII · Las silvas rimadas o blancas](https://www.lasnuevemusas.com/2018/01/06/vamos-a-hablar-de-metrica-xviii/) — Ricardo Fernández Esteban (*Las nueve musas*).

## Seguí aprendiendo

Si querés revisar primero cómo contar sílabas, identificar sinalefas o elegir lecturas de base, visitá el [mapa de recursos de métrica](/recursos). Si ya tenés un poema listo para enviar, pasá por la guía de [concursos de poesía y plicas](/concursos-de-poesia).`,
  },
  {
    slug: 'concursos-de-poesia',
    title: 'Preparar poemas y plicas para concursos de poesía | Mesa de Poesía',
    heading: 'Cómo preparar poemas y plicas para concursos de poesía',
    eyebrow: 'Concursos literarios · Entregas, formato y plica',
    description: 'Qué revisar en las bases, cómo armar una plica, conservar la versión enviada y preparar tus poemas en PDF o DOCX para concursos literarios en español.',
    showInNav: 1,
    navLabel: 'Concursos',
    sortOrder: 30,
    published: 1,
    markdown: `Presentarse a un concurso de poesía suele implicar tanto cuidado editorial como escritura: respetar el anonimato, elegir la versión correcta de cada poema, ajustar la maquetación a las bases y preparar una plica separada. Acá reunimos lo esencial para llegar a la fecha de cierre con orden.

## Qué revisar siempre en las bases antes de exportar

### Requisitos de la obra

- **Extensión:** mínimo y máximo de versos o poemas (y si las citas o el título cuentan en el total).
- **Inédito y originalidad:** algunos certámenes excluyen textos publicados en redes o blogs, y piden declaración sobre autoría humana / IA.
- **Temática y forma:** libre o sujeta a un metro concreto (por ejemplo, soneto o décima).

### Formato y entrega

- **Tipografía e interlineado:** suelen pedir Times New Roman o Arial 12, interlineado 1,5 o doble y hoja A4 o Carta.
- **Anonimato:** obra firmada solo con título y seudónimo o lema, sin tu nombre real en el archivo del poema.
- **Plica aparte:** segundo archivo (o sobre) con tus datos personales, contacto y el mismo título y seudónimo.

## Qué es una plica y por qué va separada

En los concursos literarios con jurado a ciegas, la **plica** es el documento que vincula tu obra anónima con tu identidad real. Solo se abre si el poema resulta premiado o finalista. Por eso debe entregarse como archivo independiente y contener únicamente lo que pidan las bases (nombre completo, documento, domicilio, correo o teléfono y, cuando corresponde, nota de autoría).

## Cómo te ayuda Mesa de Poesía a preparar la entrega

1. **Traé la convocatoria a tu mesa:** pegá la URL de [Escritores.org](https://www.escritores.org/concursos/concursos-1/concursos-poesia) o cargá las bases a mano desde la pestaña *Concursos*.
2. **Fijá o seguí versiones:** asociá poemas de tu biblioteca eligiendo si el concurso sigue la última edición o queda fijado en una versión concreta.
3. **Exportá obra y plica por separado:** configurá fuente, tamaño de hoja, márgenes, portada, numeración y orden de poemas para descargar en PDF o DOCX, y reutilizá tus datos de plica cifrados.
4. **Guardá constancia del envío:** al marcar el concurso como enviado se conserva una copia exacta de lo entregado, aunque después sigas corrigiendo el poema.
5. **No pierdas los cierres ni el fallo:** descargá eventos \`.ics\` para tu calendario o activá recordatorios en el navegador.

{{aviso:/taller/?view=contests|Organizar un concurso en el taller|**Aviso importante:** Mesa de Poesía organiza tu preparación, tus archivos y tus fechas, pero no envía obras automáticamente. Revisá siempre las bases oficiales y mandá tus documentos por el medio que indique la organización.}}

## Referencias útiles

- [Concursos de poesía vigentes en Escritores.org](https://www.escritores.org/concursos/concursos-1/concursos-poesia) — Directorio actualizado de certámenes en español (compatible con la importación por URL del taller).
- [¿Cómo maquetar la edición de un libro de poemas?](https://www.lasnuevemusas.com/2020/11/02/como-maquetar-la-edicion-de-un-libro-de-poemas/) — Ricardo Fernández Esteban · Criterios editoriales para presentar versos en página.
- [El Busto de Pallas (Discord)](https://discord.gg/mSz3ER2JKR) — Pedí una lectura crítica antes de cerrar tu entrega y compartí convocatorias con otros poetas.

Si además necesitás revisar la medida antes de entregar, mirá el [mapa de recursos de poesía](/recursos) o las [formas poéticas](/formas-poeticas).`,
  },
]);

export function normalizeSlug(raw) {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, '');
}

export function validateSlug(raw) {
  const slug = normalizeSlug(raw);
  if (!slug || slug.length < 2 || slug.length > 80) {
    return { error: 'La URL (slug) debe tener entre 2 y 80 caracteres.' };
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { error: 'La URL solo admite letras minúsculas, números y guiones medios (ej. guia-de-soneto).' };
  }
  if (RESERVED_SLUGS.has(slug)) {
    return { error: `La ruta "/${slug}" está reservada por la aplicación.` };
  }
  return { slug };
}

export function validateEditorialPage(body, existing = null) {
  let slug = existing?.slug;
  if (!existing) {
    const checked = validateSlug(body.slug);
    if (checked.error) return { error: checked.error };
    slug = checked.slug;
  }

  const heading = String(body.heading ?? existing?.heading ?? '').trim().slice(0, 160);
  if (!heading) return { error: 'El encabezado principal (H1) es obligatorio.' };

  const title = String(body.title ?? existing?.title ?? `${heading} | Mesa de Poesía`).trim().slice(0, 160);
  if (!title) return { error: 'El título SEO es obligatorio.' };

  const eyebrow = String(body.eyebrow ?? existing?.eyebrow ?? '').trim().slice(0, 120);
  const description = String(body.description ?? existing?.description ?? '').trim().slice(0, 320);
  const draftMd = String(body.draftMd ?? existing?.draft_md ?? '').replace(/\r\n?/g, '\n');
  if (draftMd.length > 100_000) return { error: 'El contenido Markdown supera el tamaño máximo permitido.' };

  const showInNav = (body.showInNav ?? (existing ? Boolean(existing.show_in_nav) : false)) ? 1 : 0;
  const navLabel = String(body.navLabel ?? existing?.nav_label ?? heading).trim().slice(0, 40) || heading.slice(0, 40);
  const rawOrder = body.sortOrder ?? existing?.sort_order ?? 100;
  const sortOrder = Number.isFinite(Number(rawOrder))
    ? Math.max(-9999, Math.min(9999, Math.trunc(Number(rawOrder))))
    : 100;

  return {
    value: {
      slug,
      title,
      heading,
      eyebrow,
      description,
      draftMd,
      showInNav,
      navLabel,
      sortOrder,
    },
  };
}

export function serializeEditorialPage(row) {
  const published = Boolean(row.published);
  const draftMd = row.draft_md ?? '';
  const publishedMd = row.published_md ?? '';
  return {
    slug: row.slug,
    title: row.title,
    heading: row.heading,
    eyebrow: row.eyebrow || '',
    description: row.description || '',
    draftMd,
    publishedMd,
    published,
    hasUnpublishedChanges: published ? draftMd !== publishedMd : draftMd.trim().length > 0,
    showInNav: Boolean(row.show_in_nav),
    navLabel: row.nav_label || row.heading,
    sortOrder: Number(row.sort_order) || 100,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at || null,
  };
}

function fallbackSerializedPages() {
  return DEFAULT_EDITORIAL_PAGES.map((item) => ({
    slug: item.slug,
    title: item.title,
    heading: item.heading,
    eyebrow: item.eyebrow,
    description: item.description,
    draftMd: item.markdown,
    publishedMd: item.markdown,
    published: Boolean(item.published),
    hasUnpublishedChanges: false,
    showInNav: Boolean(item.showInNav),
    navLabel: item.navLabel,
    sortOrder: item.sortOrder,
    createdAt: `${PUBLISHED_FALLBACK_DATE} 00:00:00`,
    updatedAt: `${PUBLISHED_FALLBACK_DATE} 00:00:00`,
    publishedAt: `${PUBLISHED_FALLBACK_DATE} 00:00:00`,
  }));
}

export async function ensureEditorialPages(db) {
  if (!db) return false;
  try {
    const marker = await db
      .prepare("SELECT value FROM editorial_pages_meta WHERE key = 'initialized'")
      .first();
    if (marker?.value === '1') return true;

    const existing = await db.prepare('SELECT COUNT(*) AS count FROM editorial_pages').first();
    const statements = [];
    if ((Number(existing?.count) || 0) === 0) {
      for (const page of DEFAULT_EDITORIAL_PAGES) {
        statements.push(
          db.prepare(
            `INSERT INTO editorial_pages
             (slug, title, heading, eyebrow, description, draft_md, published_md, published, show_in_nav, nav_label, sort_order, published_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
          ).bind(
            page.slug,
            page.title,
            page.heading,
            page.eyebrow,
            page.description,
            page.markdown,
            page.markdown,
            page.published,
            page.showInNav,
            page.navLabel,
            page.sortOrder
          )
        );
      }
    }
    statements.push(
      db.prepare("INSERT OR REPLACE INTO editorial_pages_meta (key, value) VALUES ('initialized', '1')")
    );
    await db.batch(statements);
    return true;
  } catch {
    return false;
  }
}

export async function listEditorialPages(db, { publishedOnly = false, search = '' } = {}) {
  const ready = await ensureEditorialPages(db);
  if (!ready) {
    return fallbackSerializedPages().filter((p) => !publishedOnly || p.published);
  }
  const q = String(search || '').trim();
  const pattern = `%${q}%`;
  const { results } = await db
    .prepare(
      `SELECT slug, title, heading, eyebrow, description, draft_md, published_md, published,
              show_in_nav, nav_label, sort_order, created_at, updated_at, published_at
       FROM editorial_pages
       WHERE (? = 0 OR published = 1)
         AND (? = '' OR slug LIKE ? OR title LIKE ? OR heading LIKE ? OR draft_md LIKE ?)
       ORDER BY sort_order ASC, slug ASC`
    )
    .bind(publishedOnly ? 1 : 0, q, pattern, pattern, pattern, pattern)
    .all();

  return results.map(serializeEditorialPage);
}

export async function getPublishedEditorialPage(db, slug) {
  const normalized = normalizeSlug(slug);
  if (!normalized || RESERVED_SLUGS.has(normalized)) return null;
  const ready = await ensureEditorialPages(db);
  if (!ready) {
    return fallbackSerializedPages().find((p) => p.slug === normalized && p.published) || null;
  }
  const row = await db
    .prepare(
      `SELECT slug, title, heading, eyebrow, description, draft_md, published_md, published,
              show_in_nav, nav_label, sort_order, created_at, updated_at, published_at
       FROM editorial_pages
       WHERE slug = ? AND published = 1`
    )
    .bind(normalized)
    .first();
  return row ? serializeEditorialPage(row) : null;
}

export async function resetDefaultEditorialPages(db) {
  const statements = [];
  for (const page of DEFAULT_EDITORIAL_PAGES) {
    statements.push(
      db.prepare(
        `INSERT INTO editorial_pages
         (slug, title, heading, eyebrow, description, draft_md, published_md, published, show_in_nav, nav_label, sort_order, updated_at, published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
         ON CONFLICT(slug) DO UPDATE SET
           title = excluded.title,
           heading = excluded.heading,
           eyebrow = excluded.eyebrow,
           description = excluded.description,
           draft_md = excluded.draft_md,
           published_md = excluded.published_md,
           published = excluded.published,
           show_in_nav = excluded.show_in_nav,
           nav_label = excluded.nav_label,
           sort_order = excluded.sort_order,
           updated_at = datetime('now'),
           published_at = datetime('now')`
      ).bind(
        page.slug,
        page.title,
        page.heading,
        page.eyebrow,
        page.description,
        page.markdown,
        page.markdown,
        page.published,
        page.showInNav,
        page.navLabel,
        page.sortOrder
      )
    );
  }
  statements.push(
    db.prepare("INSERT OR REPLACE INTO editorial_pages_meta (key, value) VALUES ('initialized', '1')")
  );
  await db.batch(statements);
  return DEFAULT_EDITORIAL_PAGES.length;
}

function isoDateOnly(raw) {
  const day = String(raw || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : PUBLISHED_FALLBACK_DATE;
}

export function renderEditorialPageHtml(page, navPages = []) {
  const url = `https://poesia.mimesa.dev/${page.slug}`;
  const publishedDate = isoDateOnly(page.createdAt);
  const modifiedDate = isoDateOnly(page.publishedAt || page.updatedAt);
  const bodyHtml = renderEditorialMarkdown(page.publishedMd);

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: page.heading,
        description: page.description,
        inLanguage: 'es',
        datePublished: publishedDate,
        dateModified: modifiedDate,
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

  const navLinks = (navPages.length ? navPages : fallbackSerializedPages())
    .filter((item) => item.published && item.showInNav)
    .map((item) => `<a href="/${escapeHtml(item.slug)}"${item.slug === page.slug ? ' aria-current="page"' : ''}>${escapeHtml(item.navLabel || item.heading)}</a>`)
    .join('');

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(page.title)}</title><meta name="description" content="${escapeHtml(page.description)}">
<meta name="robots" content="index, follow, max-image-preview:large"><link rel="canonical" href="${escapeHtml(url)}">
<link rel="icon" href="/favicon.ico" sizes="64x64"><meta name="theme-color" content="#E6E4D9"><meta property="og:type" content="article"><meta property="og:locale" content="es_ES">
<meta property="og:site_name" content="Mesa de Poesía"><meta property="og:title" content="${escapeHtml(page.title)}">
<meta property="og:description" content="${escapeHtml(page.description)}"><meta property="og:url" content="${escapeHtml(url)}">
<meta property="og:image" content="https://poesia.mimesa.dev/assets/social-preview.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Cuaderno abierto con versos, marcas de métrica y un lápiz sobre una mesa">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(page.title)}"><meta name="twitter:description" content="${escapeHtml(page.description)}"><meta name="twitter:image" content="https://poesia.mimesa.dev/assets/social-preview.png">
<script src="/theme-init.js"></script><link rel="stylesheet" href="/landing.css"><link rel="stylesheet" href="/identity.css"><link rel="stylesheet" href="/guides.css"><script src="/theme.js" defer></script>
<script type="application/ld+json">${JSON.stringify(schema)}</script></head>
<body class="landing-page"><a class="skip" href="#contenido">Saltar al contenido</a><header class="publication-header"><nav class="publication-nav" aria-label="Navegación principal"><a class="publication-brand" href="/">Mesa de Poesía<span aria-hidden="true">.</span></a><div class="publication-links"><a href="/">Inicio</a><a href="/taller/">Taller</a>${navLinks}<button type="button" class="theme-toggle" data-theme-toggle aria-label="Cambiar a modo oscuro" aria-pressed="false">Modo oscuro</button></div></nav><div class="edition-line"><span>Un taller de poesía en español</span><span>Aprender · Medir · Revisar · Presentar</span></div></header>
<main id="contenido" class="container guide"><article>${page.eyebrow ? `<p class="label">${escapeHtml(page.eyebrow)}</p>` : ''}<h1>${escapeHtml(page.heading)}</h1>${bodyHtml}</article></main>
<footer class="container footer"><a href="/">Mesa de Poesía</a><nav aria-label="Enlaces del pie"><a href="/taller/">Abrir mi mesa</a>${navLinks}<a href="/apoyar">Donaciones</a><a href="/privacidad">Privacidad</a><a href="/agradecimientos">Atribuciones</a></nav></footer></body></html>\n`;
}
