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

Copyright (c) 2010-2025 James Hall, https://github.com/MrRio/jsPDF
Copyright (c) 2015-2025 yWorks GmbH, https://www.yworks.com/

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
jsDelivr to decode and decompress lexical frequency data. Both are distributed
under the MIT License. Their complete copyright and license notices are
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