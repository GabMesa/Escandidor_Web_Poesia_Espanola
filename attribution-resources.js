export const attributionGroups = [
  {title:'Palabras y datos',items:[
    ['Wikcionario','Definiciones y metadatos léxicos; los resultados enlazan a la entrada y su historial.','https://es.wiktionary.org/','CC BY-SA; GFDL cuando corresponda','https://creativecommons.org/licenses/by-sa/4.0/'],
    ['rspeer/wordfreq','Frecuencias para ordenar palabras y buscar rimas. Decodificamos, normalizamos, filtramos e indexamos los datos; las adaptaciones conservan CC BY-SA 4.0.','https://github.com/rspeer/wordfreq','CC BY-SA 4.0','https://creativecommons.org/licenses/by-sa/4.0/'],
    ['edublancas/sinonimos','Corpus de sinónimos para acompañar la escritura.','https://github.com/edublancas/sinonimos','MIT','/THIRD-PARTY-LICENSES.md#edublancassinonimos'],
    ['MessagePack','Decodificación de los datos de frecuencia.','https://github.com/msgpack/msgpack-javascript','ISC','/licenses/msgpack.txt'],
    ['fflate','Descompresión de los datos de frecuencia.','https://github.com/101arrowz/fflate','MIT','/licenses/fflate.txt']
  ]},
  {title:'Documentos, lectura y voz',items:[
    ['jsPDF','Exportación de poemas e historiales a PDF.','https://github.com/parallax/jsPDF','MIT','/licenses/jspdf.txt'],
    ['unpdf','Extracción del texto de las bases de concursos en PDF.','https://github.com/unjs/unpdf','MIT','/licenses/unpdf.txt'],
    ['PDF.js','Motor de lectura de PDF utilizado por unpdf.','https://github.com/mozilla/pdf.js','Apache 2.0','/licenses/pdfjs.txt'],
    ['Vosk y Vosk Browser','Dictado local con el modelo español vosk-model-small-es-0.42.','https://alphacephei.com/vosk/','Apache 2.0','/licenses/apache-2.0.txt'],
    ['Tesseract.js','Reconocimiento de texto en imágenes.','https://github.com/naptha/tesseract.js','Apache 2.0','/licenses/apache-2.0.txt']
  ]},
  {title:'Diseño y accesibilidad',items:[
    ['OpenDyslexic','Tipografía accesible incluida localmente.','https://github.com/antijingoist/opendyslexic','SIL OFL 1.1','/opendyslexic-0.92/OFL.txt'],
    ['Flexoki · Steph Ango','Paleta que sirve de base a los colores de la mesa.','https://stephango.com/flexoki','MIT','/FLEXOKI-LICENSE.txt'],
    ['Simple Icons','Icono de Discord para identificar el acceso con esa cuenta. Discord es una marca de Discord Inc.','https://github.com/simple-icons/simple-icons','CC0','/licenses/simple-icons.txt']
  ]}
];

export const creditEscape = value => String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export const creditLink = (href,label) => `<a href="${creditEscape(href)}"${href.startsWith('https:')?' target="_blank" rel="noopener noreferrer"':''}>${creditEscape(label)}</a>`;
