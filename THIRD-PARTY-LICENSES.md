# Third-party licenses and data notices

This file accompanies the browser application and the third-party resources it
loads or distributes. Links below identify the source material and its license.

## OpenDyslexic

The OpenDyslexic font files in `opendyslexic-0.92/` are distributed under the
SIL Open Font License 1.1. The complete license and copyright notice accompany
the font files in `opendyslexic-0.92/OFL.txt`.

- Source: https://github.com/antijingoist/opendyslexic
- License: https://openfontlicense.org/open-font-license-official-text/

## Wikcionario

Definitions and lexical metadata are requested from Spanish Wiktionary
(Wikcionario). Wiktionary text is available under the Creative Commons
Attribution-ShareAlike License; depending on the contribution, it may also be
available under the GNU Free Documentation License. See each source page and
its history for author attribution. The application does not claim ownership
of this material and does not imply endorsement by its contributors.

- Source: https://es.wiktionary.org/
- CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/
- CC BY-SA 3.0: https://creativecommons.org/licenses/by-sa/3.0/
- GNU FDL 1.3: https://www.gnu.org/licenses/fdl-1.3.html

## rspeer/wordfreq data

Spanish lexical frequency data is loaded from `rspeer/wordfreq` and processed
in the browser to rank words and find rhymes. The source data and the
frequency/rhyme data derived from it by this application are made available
under Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA
4.0). Processing includes decoding, normalization, filtering, indexing and
ordering; no authorship or endorsement by the source project is implied.

- Source: https://github.com/rspeer/wordfreq
- License: https://creativecommons.org/licenses/by-sa/4.0/

CC BY-SA 4.0 permits sharing and adaptation, including commercially, provided
appropriate credit and a license link are supplied, changes are indicated,
and adaptations are distributed under the same or a compatible license. No
additional legal or technological restrictions may be imposed. This summary
is not a substitute for the license legal code:
https://creativecommons.org/licenses/by-sa/4.0/legalcode

## edublancas/sinonimos

The Spanish synonym corpus is loaded from `edublancas/sinonimos` under the MIT
License.

Copyright (c) 2015 Edu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

- Source: https://github.com/edublancas/sinonimos

## Vosk Browser and Spanish speech model

The application distributes Vosk Browser 0.0.8 and the
`vosk-model-small-es-0.42` Spanish speech-recognition model. They run locally
in the browser as the dictation fallback when the Web Speech recognition API
is unavailable. Both resources are distributed under the Apache License 2.0.

- Vosk Browser source: https://github.com/ccoreilly/vosk-browser
- Vosk source: https://github.com/alphacep/vosk-api
- Spanish model: https://alphacephei.com/vosk/models
- License: https://www.apache.org/licenses/LICENSE-2.0

Copyright 2019-2022 Alpha Cephei Inc and Vosk contributors

Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed
under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
CONDITIONS OF ANY KIND, either express or implied. See the License for the
specific language governing permissions and limitations under the License.

## jsPDF

jsPDF is loaded as an ES module from jsDelivr and is distributed under the MIT
License.

Copyright (c) 2010-2021 James Hall, https://github.com/MrRio/jsPDF
Copyright (c) 2015-2021 yWorks GmbH, https://www.yworks.com/

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

- Source: https://github.com/parallax/jsPDF

## Tesseract.js

Tesseract.js 6.0.1 is loaded from jsDelivr when optical character recognition
is requested. It is distributed under the Apache License 2.0.

- Source: https://github.com/naptha/tesseract.js
- License: https://www.apache.org/licenses/LICENSE-2.0

## MessagePack and fflate

The rhyme-search worker loads `@msgpack/msgpack` 3.1.2 and `fflate` 0.8.2 from
jsDelivr to decode and decompress lexical frequency data. MessagePack is
distributed under the ISC License and fflate under the MIT License. Their complete copyright and license notices are
available in their source repositories.

- MessagePack source: https://github.com/msgpack/msgpack-javascript
- fflate source: https://github.com/101arrowz/fflate
- MIT License: https://opensource.org/license/mit

## Google Fonts

The interface loads several typefaces from Google Fonts. The font files are
made available under their respective open font licenses, principally the SIL
Open Font License 1.1. The applicable license and copyright metadata for each
family are provided in the Google Fonts catalog and source repository.

- Catalog: https://fonts.google.com/
- Source and license metadata: https://github.com/google/fonts
- SIL Open Font License 1.1: https://openfontlicense.org/open-font-license-official-text/

Loading Google Fonts also makes a network request to Google; see the
application privacy notice for information about external services.


### Font families used by the editor and public pages

The following upstream author notices and full license texts accompany this release.

| Family | License | Copyright and full notice |
| --- | --- | --- |
| Alegreya | SIL OFL 1.1 | [licenses/fonts/alegreya.txt](licenses/fonts/alegreya.txt) · [upstream](https://raw.githubusercontent.com/google/fonts/main/ofl/alegreya/OFL.txt) |
| Atkinson Hyperlegible | SIL OFL 1.1 | [licenses/fonts/atkinsonhyperlegible.txt](licenses/fonts/atkinsonhyperlegible.txt) · [upstream](https://raw.githubusercontent.com/google/fonts/main/ofl/atkinsonhyperlegible/OFL.txt) |
| Bebas Neue | SIL OFL 1.1 | [licenses/fonts/bebasneue.txt](licenses/fonts/bebasneue.txt) · [upstream](https://raw.githubusercontent.com/google/fonts/main/ofl/bebasneue/OFL.txt) |
| Bungee | SIL OFL 1.1 | [licenses/fonts/bungee.txt](licenses/fonts/bungee.txt) · [upstream](https://raw.githubusercontent.com/google/fonts/main/ofl/bungee/OFL.txt) |
| Caveat | SIL OFL 1.1 | [licenses/fonts/caveat.txt](licenses/fonts/caveat.txt) · [upstream](https://raw.githubusercontent.com/google/fonts/main/ofl/caveat/OFL.txt) |
| Cinzel | SIL OFL 1.1 | [licenses/fonts/cinzel.txt](licenses/fonts/cinzel.txt) · [upstream](https://raw.githubusercontent.com/google/fonts/main/ofl/cinzel/OFL.txt) |
| Cormorant Garamond | SIL OFL 1.1 | [licenses/fonts/cormorantgaramond.txt](licenses/fonts/cormorantgaramond.txt) · [upstream](https://raw.githubusercontent.com/google/fonts/main/ofl/cormorantgaramond/OFL.txt) |
| EB Garamond | SIL OFL 1.1 | [licenses/fonts/ebgaramond.txt](licenses/fonts/ebgaramond.txt) · [upstream](https://raw.githubusercontent.com/google/fonts/main/ofl/ebgaramond/OFL.txt) |
| Josefin Sans | SIL OFL 1.1 | [licenses/fonts/josefinsans.txt](licenses/fonts/josefinsans.txt) · [upstream](https://raw.githubusercontent.com/google/fonts/main/ofl/josefinsans/OFL.txt) |
| Lexend | SIL OFL 1.1 | [licenses/fonts/lexend.txt](licenses/fonts/lexend.txt) · [upstream](https://raw.githubusercontent.com/google/fonts/main/ofl/lexend/OFL.txt) |
| Libre Baskerville | SIL OFL 1.1 | [licenses/fonts/librebaskerville.txt](licenses/fonts/librebaskerville.txt) · [upstream](https://raw.githubusercontent.com/google/fonts/main/ofl/librebaskerville/OFL.txt) |
| Lora | SIL OFL 1.1 | [licenses/fonts/lora.txt](licenses/fonts/lora.txt) · [upstream](https://raw.githubusercontent.com/google/fonts/main/ofl/lora/OFL.txt) |
| Merriweather | SIL OFL 1.1 | [licenses/fonts/merriweather.txt](licenses/fonts/merriweather.txt) · [upstream](https://raw.githubusercontent.com/google/fonts/main/ofl/merriweather/OFL.txt) |
| Montserrat | SIL OFL 1.1 | [licenses/fonts/montserrat.txt](licenses/fonts/montserrat.txt) · [upstream](https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/OFL.txt) |
| Nunito | SIL OFL 1.1 | [licenses/fonts/nunito.txt](licenses/fonts/nunito.txt) · [upstream](https://raw.githubusercontent.com/google/fonts/main/ofl/nunito/OFL.txt) |
| Pacifico | SIL OFL 1.1 | [licenses/fonts/pacifico.txt](licenses/fonts/pacifico.txt) · [upstream](https://raw.githubusercontent.com/google/fonts/main/ofl/pacifico/OFL.txt) |
| Permanent Marker | Apache 2.0 | [licenses/fonts/permanentmarker.txt](licenses/fonts/permanentmarker.txt) · [upstream](https://raw.githubusercontent.com/google/fonts/main/apache/permanentmarker/LICENSE.txt) |
| Playfair Display | SIL OFL 1.1 | [licenses/fonts/playfairdisplay.txt](licenses/fonts/playfairdisplay.txt) · [upstream](https://raw.githubusercontent.com/google/fonts/main/ofl/playfairdisplay/OFL.txt) |
| Source Sans 3 | SIL OFL 1.1 | [licenses/fonts/sourcesans3.txt](licenses/fonts/sourcesans3.txt) · [upstream](https://raw.githubusercontent.com/google/fonts/main/ofl/sourcesans3/OFL.txt) |
| UnifrakturCook | SIL OFL 1.1 | [licenses/fonts/unifrakturcook.txt](licenses/fonts/unifrakturcook.txt) · [upstream](https://raw.githubusercontent.com/google/fonts/main/ofl/unifrakturcook/OFL.txt) |

## Notices embedded in Vosk Browser

The bundled `vendor/vosk/vosk.js` includes third-party components whose
copyright and license notices are preserved in the distributed source file,
including TypeScript helpers, UUID utilities, JavaScript-MD5 and related
cryptographic utilities. Those embedded notices form part of this
distribution and must not be removed.

## Resources not redistributed

RAE, IEDRA and “Vamos a hablar de métrica” are linked as external references;
their data is not bundled by this application. The `epidemian/es.txt` gist and
`xavier-hernandez/spanish-wordlist` are not present in this distribution.

## Flexoki

Palette by Steph Ango: https://stephango.com/flexoki
Source: https://github.com/kepano/flexoki
The selected palette values are integrated in identity.css. A copy of the MIT license is included in FLEXOKI-LICENSE.txt.

## Discord icon

`assets/discord.svg` uses the Discord icon from [Simple Icons](https://github.com/simple-icons/simple-icons), licensed under CC0. Discord is a trademark of Discord Inc.; the icon identifies the sign-in provider.

## unpdf and PDF.js

unpdf 1.7.0 extracts the text of contest PDFs on the server. It includes a
PDF.js-based engine. unpdf is MIT licensed; the PDF.js engine is Apache 2.0.
The original notices in the bundled engine are retained.

- unpdf source: https://github.com/unjs/unpdf
- Copyright (c) 2023-PRESENT Johann Schopplich
- Full unpdf license: [licenses/unpdf.txt](licenses/unpdf.txt)
- PDF.js source: https://github.com/mozilla/pdf.js
- Full PDF.js license: [licenses/pdfjs.txt](licenses/pdfjs.txt)

## Complete component notices included in this release

- jsPDF 2.5.1: [licenses/jspdf.txt](licenses/jspdf.txt)
- MessagePack 3.1.2: [licenses/msgpack.txt](licenses/msgpack.txt)
- fflate 0.8.2: [licenses/fflate.txt](licenses/fflate.txt)
- Apache 2.0 (Vosk, Vosk Browser, Tesseract.js): [licenses/apache-2.0.txt](licenses/apache-2.0.txt)
- Simple Icons CC0: [licenses/simple-icons.txt](licenses/simple-icons.txt)
- Flexoki: [FLEXOKI-LICENSE.txt](FLEXOKI-LICENSE.txt)
- OpenDyslexic: [opendyslexic-0.92/OFL.txt](opendyslexic-0.92/OFL.txt)

## Community and external contest sources

Busto de Pallas (https://discord.gg/mSz3ER2JKR) is thanked as the poetry
community associated with the project. Escritores.org is linked as a contest
directory; imported contest entries retain their source links and excerpts
for review. These acknowledgements do not imply endorsement or transfer of
ownership of the respective sites, contest rules, or community content.
