# Reglas de escansion (v2)

## Objetivo
Este documento define las reglas linguisticas usadas por el escandador basico de poesia en espanol.

## Alcance de v2
- Analisis por palabra y por linea.
- Separacion silabica ortografica aproximada.
- Deteccion de silaba tonica.
- Clasificacion acentual: aguda, llana, esdrujula, sobreesdrujula, monosilaba.
- Conteo de silabas por linea.
- Patron de conteo configurable: guiones para secuencias ordenadas y espacios para alternativas en cualquier orden.
- Ajuste metrico por acento final del verso:
  - aguda: +1
  - llana: +0
  - esdrujula/sobreesdrujula: -1
- Patron de acentos del verso como posiciones silabicas.
- Validacion de acento versal contra patron objetivo elegido por el poeta.
- Hemistiquio por barra inline (/) y por corte global aplicado a todas las lineas.
- Conteo en versos compuestos como n+m (cada hemistiquio se computa por separado).
- Sinalefa automatica con posibilidad de forzar/romper manualmente por frontera.
- Comparacion de rima por modo global: asonante, consonante o repeticion de palabra final.
- Esquema de rima configurable por letras (ej: ABBAACCDDC).
- Modo sextina con comparacion por palabra final completa y validacion del envio por grupos (ej: AB, DE, CF).
- Revision de monosilabos atonos como soporte ritmico opcional (marcado con *).

## Reglas de separacion silabica

### 1) Nucleo silabico
- Cada silaba contiene un nucleo vocalico.
- Se consideran vocales: a, e, i, o, u, con tildes y u con dieresis.

### 2) Consonantes entre vocales
- Una consonante entre vocales pasa al ataque de la silaba siguiente.
  - ca-sa, pe-ro
- Dos consonantes:
  - Si forman grupo de ataque permitido, se mantienen juntas en la segunda silaba.
  - Grupos considerados: bl, br, cl, cr, dr, fl, fr, gl, gr, pl, pr, tr, tl.
  - Ejemplos: a-bra-zo, a-cla-rar.
  - En otro caso, se separan: al-to, ac-to.
- Digrafos tratados como unidad consonantica: ch, ll, rr.

### 3) qu / gu en gue-gui / que-qui
- En secuencias qu + e/i y gu + e/i, la u se trata como muda para el nucleo.
- Ejemplos: gue-rra, qui-ta.

### 4) Diptongo
- Dos vocales en el mismo nucleo cuando:
  - hay al menos una vocal debil (i, u, y final),
  - no hay hiato por tilde en debil (i/u tildada),
  - no son dos vocales fuertes puras en contacto.
- La h intercalada no rompe la posible union vocalica.

### 5) Triptongo
- Tres vocales pronunciadas en una misma silaba.
- Patron obligatorio: vocal cerrada atona (`i`, `u`) + vocal abierta (`a`, `e`, `o`) + vocal cerrada atona (`i`, `u`).
- La `y` funciona como vocal cerrada cuando suena como `i`.
- Una tilde en cualquiera de las vocales cerradas rompe el triptongo.
- La `h` intercalada es transparente y no cuenta como vocal; por ejemplo, `mundo hay` aporta `o_a_y`, que no es triptongo por su orden vocalico.

### 6) Hiato
- Se separan en silabas distintas cuando:
  - hay dos fuertes contiguas,
  - o una debil tildada rompe diptongo/triptongo.

## Reglas de acentuacion (silaba tonica)

### 1) Con tilde grafica
- Si la palabra tiene tilde, la silaba que contiene esa vocal es la tonica.

### 2) Sin tilde grafica
- Si termina en vocal, n o s: tonica en penultima silaba (llana).
- Si termina en otra consonante: tonica en ultima silaba (aguda).
- Monosilabas: unica silaba tonica.

## Clasificacion acentual
- Aguda: tonica en ultima silaba.
- Llana: tonica en penultima.
- Esdrujula: tonica en antepenultima.
- Sobreesdrujula: tonica antes de la antepenultima.
- Monosilaba: una sola silaba.

## Conteo silabico y metrico

### 1) Conteo silabico bruto
- Suma de silabas de todas las palabras de la linea.

### 2) Ajuste por palabra final del verso
- Si la ultima palabra es aguda: conteo metrico = bruto + 1.
- Si es llana: conteo metrico = bruto.
- Si es monosilaba final: conteo metrico = bruto + 1.
- Si es esdrujula o sobreesdrujula: conteo metrico = bruto - 1.

### 3) Importante: posicion del acento final y conteo metrico
- El bono metrico de palabra final aguda o monosilaba suma al conteo del verso.
- Ese bono no desplaza la posicion mostrada del acento natural final.
- Ejemplo: si el verso cuenta 9 por final aguda, el ultimo acento puede seguir mostrandose en 8.

## Patron de acentos del verso
- Se recorre la linea palabra por palabra con indice silabico acumulado (1-based).
- Para cada palabra polisilabica se anota la posicion de su silaba tonica.
- Se muestra como secuencia unida por guiones, por ejemplo: 2-4-8-10.
- En versos con hemistiquio, la visualizacion puede reiniciar la numeracion por segmento para mostrar cada hemistiquio como verso independiente.

## Acento versal
- El poeta define un patron objetivo por cada conteo silabico configurado (ej: 7 -> 3-6 y 11 -> 6-10).
- Los versos de 11 silabas usan 6-10 como valor sugerido inicial.
- Por cada verso se comparan los acentos detectados con ese patron.
- Ademas del patron escrito por el poeta, se incorpora el ultimo acento natural de cada hemistiquio al patron efectivo del analisis.
- Estado visual:
  - verde: posicion presente,
  - rojo: posicion ausente,
  - *: ausencia compensada solo por monosilabo atono (aviso, no acierto fuerte).

## Hemistiquio
- Dos formas de marcado:
  - inline en el poema con /,
  - global desde controles de la app (corte en una posicion silabica para todas las lineas).
- Precedencia:
  - si una linea tiene / inline, ese corte manda en esa linea,
  - si no hay / inline y el modo global esta activo, se usa el corte global.
- El analisis muestra / en la linea y el conteo como n+m.
- Cada hemistiquio se ajusta con su propia regla final (aguda +1, llana 0, esdrujula -1, monosilaba final +1).
- No se permite sinalefa a traves de una frontera de hemistiquio.
- Los acentos finales naturales de cada hemistiquio se incorporan al patron versal efectivo.

## Sinalefa
- Candidata cuando una palabra termina en vocal fonica y la siguiente empieza en vocal fonica (incluyendo h muda).
- Modo conservador por defecto:
  - evita sinalefa en pausas fuertes,
  - evita sinalefa en frontera de hemistiquio,
  - evita sinalefa cuando compromete una frontera de acento versal objetivo.
- El poeta puede alternar manualmente cada frontera candidata desde el analisis.
- Si se pulsa "Detectar automaticamente", se limpian forzados manuales y se recalcula la sinalefa segun estas reglas.
- Las cadenas de sinalefa consecutiva solo se compactan como una unica union cuando el patron vocalico permite un triptongo real.
- La pausa de final de verso impide sinalefa entre versos.

## Rima y esquema

### 1) Modos de rima
- Asonante: se compara la vocal tonica final y la ultima vocal de la palabra final.
- Consonante: se compara la cola desde la vocal tonica de la palabra final.
  - Se admiten dos licencias poeticas opcionales para equivalencia consonante:
    - Diptongos en zona de rima: puede omitirse la vocal debil del diptongo cuando la tradicion metrico-rimica lo admite.
      - Ejemplo: celestiales ~ mortales (i+a -> a).
      - Ejemplo: aceite ~ vete (ei -> e).
    - Finales esdrujulos/sobreesdrujulos: puede omitirse la silaba postonica inmediata.
      - Ejemplo: cantico ~ zanco (can-ti-co -> can-co).
- Repeticion de palabra final: se compara la palabra final completa normalizada, no solo la terminacion rimica. Puede usarse en cualquier forma o verso.

### 2) Palabra final usada para rima
- La rima se calcula sobre la ultima palabra analizada de cada verso.
- La palabra se normaliza quitando puntuacion periferica y diferencias graficas no relevantes para la comparacion interna.

### 2.1) Excepcion de los diptongos
- Si la ultima palabra del verso contiene un diptongo dentro de la zona rimica (desde la ultima silaba tonica), la vocal debil puede omitirse a efectos de rima.
- Esta licencia no es obligatoria: se usa solo cuando la disposicion rimica del poema lo requiere.
- Es mas comun y mas aceptada en diptongos crecientes de la penultima silaba, aunque puede aparecer en otras posiciones.

### 2.2) Excepcion de las esdrujulas
- En palabras esdrujulas (y, por extension, sobreesdrujulas), puede ignorarse la silaba postonica inmediata para comparar la rima.
- Ejemplo consonante: cantico ~ zanco (suprimiendo -ti- en can-ti-co).
- Ejemplo asonante: cantico puede aproximarse a terminaciones en -a-o.
- Esta licencia suele verse mas en rima asonante que en consonante.

### 3) Esquema de rima configurable
- El usuario puede escribir un esquema por letras, por ejemplo: ABBAACCDDC o ABBA ABBA CDE CDE.
- Para modos asonante y consonante, cada letra representa la clase de rima esperada de un verso.
- Si el poema tiene mas versos que letras, se validan solo los primeros N versos, donde N = longitud efectiva del esquema.
- Si el esquema tiene mas letras que versos, se valida solo el tramo disponible del poema.
- Cada verso validado puede marcarse como correcto o incorrecto respecto a la letra esperada.

### 4) Esquema de sextina
- Cuando la forma seleccionada es Sextina, los bloques de seis letras continuas se interpretan como seis versos separados:
  - ABCDEF = A, B, C, D, E, F
- Los grupos del envio se mantienen como grupos:
  - AB, DE, CF
- El esquema por defecto usado por la app para la Sextina es:
  - ABCDEF FAEBDC CFDABE ECBFAD DEACFB BDFECA AB DE CF

### 5) Validacion del envio en sextina
- En los seis sextetos, cada verso debe cerrar con la palabra final base correspondiente a su letra.
- En el envio final, un grupo como AB exige que ambas palabras-base aparezcan dentro del verso, no necesariamente como ultima palabra unica.

## Configuraciones poeticas sugeridas en la guia
- Sintaxis del conteo:
  - `7-5-7-5` exige esa secuencia ordenada y la repite.
  - `7 11` permite versos de 7 u 11 silabas en cualquier orden.
  - `8-7 11-8` permite 7 u 11 solo en la segunda posicion de la secuencia.
- Soneto:
  - 14 versos
  - endecasilabo habitual
  - acento versal sugerido: 6-10
  - esquema habitual sugerido: ABBA ABBA CDC DCD
- Espinela:
  - 10 versos
  - octosilabo
  - acento versal sugerido: 7
  - esquema sugerido: ABBAACCDDC
- Sonetillo:
  - 14 versos octosilabos
  - puede reutilizar el esquema del soneto como referencia formal basica
- Sextina:
  - 6 sextetos y un envio de 3 versos
  - comparacion por palabra final completa
  - esquema por defecto: ABCDEF FAEBDC CFDABE ECBFAD DEACFB BDFECA AB DE CF

## Monosilabos y ritmo
- Se distingue entre monosilabos atonos funcionales y monosilabos tonicos.
- Los atonos funcionales no cuentan como acento fuerte principal por defecto.
- Si un patron se sostiene solo por esos monosilabos atonos, se marca como soporte debil (*).

## Reglas no implementadas aun (siguiente fase)
- Dialefa y sineresis poetica completas.
- Ajustes dialectales avanzados de sinalefa/hiato.
- Perfil ritmico profundo por series (acento versal de estrofa, no solo linea).
- Modelado avanzado de tonicidad secundaria.

## Nota de precision
Este analizador es una base didactica. La metrica poetica real en espanol requiere licencias y fenomenos prosodicos adicionales que se incorporaran en fases posteriores.
