# Auditoría de portadas y primeras páginas

Ver el informe visual local en `portadas.html`. Seis concursos del listado de Escritores.org consultados el 14 de octubre de 2026. Alcance: portada y primera página, no entrega completa ni elegibilidad.

| Concurso | Requisito |
| --- | --- |
| [Gonzalo de Berceo](https://www.escritores.org/recursos-para-escritores/41991-iii-premio-internacional-de-poesia-gonzalo-de-berceo) | Portada con número de versos; seudónimo en la obra y declaración de IA en la primera página. |
| [De la Viña y el Vino](https://www.escritores.org/recursos-para-escritores/42186-xx-edicion-del-certamen-literario-de-la-vina-y-el-vino) | Primera página con título o lema, sin firma ni elementos de identificación. No exige una portada separada. |
| [Manuel Campazas](https://www.escritores.org/recursos-para-escritores/41961-iii-certamen-nacional-de-poesia-manuel-campazas) | Obra identificada con el título, sin firma; Times New Roman 12 e interlineado 1,5. No exige portada separada. |
| [Hernán de Usero](https://www.escritores.org/recursos-para-escritores/42066-certamenes-2026-del-ateneo-literario-de-artes-y-de-ciencias-de-puerto-real-v-concurso-de-sonetos-hernan-de-usero-vii-premio-de-poesia-rosa-butler-x-edicion-del-premio-de-novela-isaac-asimov-2026) | PDF de la obra con título y seudónimo. No exige portada separada. |
| [Rosa Butler](https://www.escritores.org/recursos-para-escritores/42066-certamenes-2026-del-ateneo-literario-de-artes-y-de-ciencias-de-puerto-real-v-concurso-de-sonetos-hernan-de-usero-vii-premio-de-poesia-rosa-butler-x-edicion-del-premio-de-novela-isaac-asimov-2026) | PDF de la obra con título y seudónimo. No exige portada separada. |
| [Adonáis](https://www.escritores.org/recursos-para-escritores/42092-80-edicion-premio-adonais) | Documento compatible con Word; el uso de seudónimos excluye. No exige portada separada. |

Validación: PDF renderizado en Edge y primeras páginas inspeccionadas, medidas A4 y anonimato comprobados; DOCX validado por XML y ZIP, sin render de Word. Las opciones usan la misma función para vista previa, HTML/PDF y DOCX. La declaración de IA permanece vacía hasta que el poeta la complete.

Reproducir: `node scripts/audit-contest-covers.mjs`, `node scripts/render-contest-covers.mjs`; inspeccionar los PDF y su primera página antes de marcar la verificación visual como correcta. Paco Mollá requiere revisión de secciones en imagen; Grande Aguirre no se extrajo por superar 8 MB.
