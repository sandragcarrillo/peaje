# Peaje: dirección visual

> Este documento define cómo se ve y se siente Peaje. Cualquier UI, landing, dashboard o pieza de marca de Peaje debe seguir estas reglas. Si algo no está definido aquí, decide a favor de la sobriedad técnica, nunca del decorado.

## 1. Concepto

Peaje es la caseta de peaje del internet para agentes: hace que un sitio sea encontrado por agentes de IA y cobre por sus rutas. La estética debe comunicar exactamente eso, infraestructura seria que un agente puede leer, con la calidez editorial suficiente para que un humano quiera quedarse.

La idea rectora: **el sitio de Peaje es su propia demo**. La interfaz se comporta como un sitio agent-ready, muestra su estado en vivo, expone sus rutas, habla en pares clave:valor. Todo elemento de chrome (status bars, tickers, índices) es evidencia del producto, no decoración.

Tono en una frase: terminal editorial. Mitad documento técnico impreso, mitad consola viva.

## 2. Paleta

Dos mundos que conviven en la misma página, claro y oscuro, alternando por secciones (nunca medio tono gris intermedio).

| Token | Hex | Uso |
|---|---|---|
| `--crema` | `#EFEBE2` | Fondo claro base, el "papel" |
| `--tinta` | `#1A1917` | Fondo oscuro base y texto sobre crema |
| `--tinta-suave` | `#2A2825` | Cards y superficies elevadas sobre tinta |
| `--verde` | `#A2DAE2` | Acento único: el punto de estado, precios activos, el "semáforo" del peaje |
| `--gris-texto` | `#8C8880` | Texto secundario, índices apagados, timestamps |
| `--linea` | `#D8D3C8` (sobre crema) / `#3A3833` (sobre tinta) | Hairlines y bordes |

Reglas:
- El verde es un punto, no una capa. Aparece como dot de estado, precio, o highlight puntual. Jamás como fondo de sección, gradiente o botón grande.
- Nada de gradientes, sombras suaves de SaaS, ni glassmorphism. Las superficies se separan con borde de 1px y contraste de fondo, no con sombra.
- Un acento secundario frío (lila `#B8AFF0`) queda reservado solo para el dashboard, para diferenciar datos "en vivo" de datos estáticos. En la landing no se usa.

## 3. Tipografía

Dos familias, roles estrictos:

**Display y body: grotesca neutra de alto contraste de tamaño.**
Primera opción PP Neue Montreal, alternativas libres: Archivo o Inter Tight. Pesos 500 a 600 para titulares, 400 para body. Titulares grandes con tracking ligeramente negativo (-0.02em) y line-height apretado (1.05).

**Chrome técnico: monoespaciada.**
IBM Plex Mono o JetBrains Mono. Se usa para TODO lo que "hablaría un agente": navegación, botones, status bars, tickers, índices, labels, precios, listas numeradas de features, FAQs. Siempre en un solo peso (400 o 500), tamaño pequeño (12 a 14px), con letter-spacing amplio (0.05em).

La tensión entre ambas es la identidad: titulares enormes en grotesca que dicen una sola cosa con calma, rodeados de mono pequeña que reporta estado como una terminal.

Jerarquía de titulares: frases cortas, punto final incluido, a veces partidas en dos o tres líneas donde cada línea es una oración completa. Para Peaje:

```
Tu sitio ya existe.
Los agentes no lo saben.
Peaje lo arregla.
```

Tratamiento de dos tonos en titulares clave: primera parte en color pleno, segunda en gris, para marcar el giro de la frase. Usarlo máximo una vez por página, en el hero o en el CTA final.

## 4. Layout

- **Grid visible cuando aporta.** Las ilustraciones técnicas viven sobre una retícula fina con marcas de coordenadas en las esquinas, como plano de ingeniería.
- **Split claro/oscuro.** El hero puede partirse vertical: mitad crema con el claim, mitad tinta con arte generativo. Las secciones alternan fondo completo crema y fondo completo tinta.
- **Esquinas con carácter.** Bordes rectos o radio mínimo (4 a 8px) en cards. Una sección oscura por página puede llevar la esquina superior recortada en diagonal con su label dentro del recorte.
- Contenido alineado a la izquierda por defecto, titulares de sección centrados solo cuando la sección es simétrica.
- Ancho de lectura de body: máximo 70 caracteres.

## 5. Componentes canónicos

### 5.1 Status bar
Franja mono de pares clave:valor, fija al pie del hero o del footer. Es la firma de Peaje: el sitio reportando su propio estado, en vivo si es posible.

```
MPP: ACTIVO      RUTAS: 12      SCORE: 94/100      AGENTS.MD: CARGADO      DRIFT: 0
```

### 5.2 Ticker marquee
Cinta horizontal en mono, dentro de un borde, con un mensaje repetido desplazándose. Un solo ticker por página.

### 5.3 Índices numerados
Features, FAQs y pasos se etiquetan en mono: `001 / AGENT-READY`, `Q.003 / ¿NECESITO SABER DE CRYPTO?`. Los números solo cuando el contenido realmente es una secuencia o un listado consultable.

### 5.4 Botones pastilla conectados
Pares de botones con esquinas exteriores redondeadas que se tocan formando una sola pieza. En mono, mayúsculas, con un dot verde en el secundario. El CTA dice exactamente lo que pasa al usarlo.

### 5.5 Card comparativa antes/después
Dos paneles lado a lado: izquierda crema apagado, badge `SIN PEAJE · INVISIBLE`, chips de rutas en gris sin tráfico; derecha panel destacado, badge `CON PEAJE · COBRANDO`, las mismas rutas activas con timestamps de segundos y montos entrando. Los chips de ruta (`/api/search`, icono + nombre + timestamp) son un patrón propio: reusarlos en dashboard y landing.

### 5.6 Roadmap por etapas
Timeline vertical con tres estaciones y flechas: `Hoy` → `Siguiente` → `Endgame`.

### 5.7 Pricing en cards tinta sobre crema
Cards oscuras sobre fondo crema, precio grande en grotesca, lista mono numerada, botones pastilla abajo, badge `DISPONIBLE` con dot verde.

### 5.8 FAQ acordeón
Sobre fondo tinta, preguntas en mono con índice `Q.001 /`, control `+`/`−`, respuesta en grotesca.

## 6. Textura y arte

Nada de fotos de stock ni ilustraciones 3D. El arte de Peaje se genera con texto y puntos:

- **Ruido tipográfico.** Fondos oscuros con capas de texto mono repetido en baja opacidad. El texto del ruido es real y del dominio: rutas, `PAGO CONFIRMADO`, `AGENT: VERIFIED`.
- **Formas concéntricas de texto.** Frases del producto repetidas en anillos o espirales como pieza central del hero oscuro.
- **Dot-matrix.** Objetos del dominio (caseta, talanquera, moneda, candado) dibujados con puntos sobre retícula con coordenadas, con callouts mono.
- Fotos solo en blanco y negro o muy desaturadas, con barra blanca de label encima.

Presupuesto de audacia: máximo una pieza de arte generativo grande por página.

## 7. Movimiento

- Un solo momento orquestado por página.
- Los timestamps de la comparativa pueden contar en vivo.
- Transiciones cortas (150ms), sin rebotes.
- Respetar `prefers-reduced-motion` siempre.

## 8. Voz y copy

- Español latinoamericano neutro, frases cortas y afirmativas en titulares.
- El chrome técnico puede ir en inglés o español, consistente dentro de una página.
- Los CTAs nombran la acción real: `Medir mi sitio`, `Instalar el kit`. Nunca `Comenzar`.
- Los números concretos son parte de la voz. Donde haya un dato real, mostrarlo antes que un adjetivo.
- Sin emojis en la interfaz.

## 9. Lo que Peaje nunca hace

- Fondos con gradiente, mesh gradients, blobs, glassmorphism.
- Sombras suaves grises bajo cards idénticas.
- Iconos genéricos de librería como protagonistas.
- Ilustraciones 3D de robots o personajes.
- Acentos morados/azules eléctricos de template de IA.
- Más de un acento de color por superficie.
- Animaciones de entrada fade-up en cada sección.

## 10. Blueprint de la landing

1. Nav: logo, links en mono, ticker integrado.
2. Hero split: crema izquierda con eyebrow mono, titular en tres frases, botones pastilla; tinta derecha con arte concéntrico; status bar al pie con datos reales.
3. Comparativa antes/después.
4. Features numeradas sobre tinta con ruido tipográfico.
5. Roadmap por etapas sobre crema.
6. Sección de confianza con esquina recortada y dot-matrix.
7. Pricing.
8. FAQ: "Antes de instalar".
9. CTA final sobre tinta: titular a dos tonos, dos botones, footer limpio.
