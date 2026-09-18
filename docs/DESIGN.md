# OpenFit — Diseño de producto y técnico

> Documento de la **primera tarea** (fases 1–3: definición de producto, diseño técnico y UX).
> Es la referencia de las decisiones del MVP. La guía breve para contribuir al código está en
> [ARCHITECTURE.md](ARCHITECTURE.md) (en inglés).
>
> Estado: MVP 0.1.0 construido · Última revisión: 2026-09-17

**Prioridad:** local-first + simple + rápido + privado + open source + self-hostable en el futuro.

> **Adenda (2026-09-17): apps para Android e iOS.** El requisito original omitía que el producto
> debe existir como app en las tiendas. Decisión: **el mismo código web se empaqueta con
> Capacitor 8** (`android/`, `ios/`). No hay funciones exclusivas de las apps: la PWA sigue siendo
> completa. Ver la sección [4b](#4b-apps-nativas-android-e-ios) y [MOBILE.md](MOBILE.md).

---

## Índice

1. [Análisis general](#1-análisis-general)
2. [Definición final del MVP](#2-definición-final-del-mvp)
3. [Comparación de stacks](#3-comparación-de-stacks)
4. [Stack recomendado](#4-stack-recomendado) · [4b. Apps nativas](#4b-apps-nativas-android-e-ios) · [4c. Revisión de producto](#4c-revisión-de-producto-2026-09-17)
5. [Arquitectura local-first](#5-arquitectura-local-first)
6. [IndexedDB: elección y estructura](#6-indexeddb-elección-y-estructura)
7. [Modelo inicial de datos](#7-modelo-inicial-de-datos)
8. [Estrategia de IDs pensando en sync](#8-estrategia-de-ids-pensando-en-sync)
9. [Backup y restauración](#9-backup-y-restauración)
10. [Base nutricional](#10-base-nutricional)
11. [Mantener pequeño el bundle](#11-mantener-pequeño-el-bundle)
12. [Estructura del repositorio](#12-estructura-del-repositorio)
13. [Mapa de pantallas](#13-mapa-de-pantallas)
14. [Flujo de navegación y UX](#14-flujo-de-navegación-y-ux)
15. [Roadmap por milestones](#15-roadmap-por-milestones)
16. [Riesgos técnicos](#16-riesgos-técnicos)
17. [Riesgos de licencias de datasets](#17-riesgos-de-licencias-de-datasets)
18. [Decisiones que dificultarían el self-hosting](#18-decisiones-que-dificultarían-el-self-hosting)
19. [Funcionalidades que eliminaría para mantener la app ligera](#19-funcionalidades-que-eliminaría-para-mantener-la-app-ligera)

---

## 1. Análisis general

### Producto

Un diario de alimentación **que vive en el dispositivo**. La persona usuaria abre la app, añade lo
que comió y ve al instante cuántas calorías y macronutrientes lleva frente a sus objetivos. No hay
cuenta, servidor ni telemetría. Los datos se exportan y se restauran con un archivo.

**Usuario objetivo:** alguien que registra comidas a diario, valora la privacidad y quiere una
herramienta rápida (segundos por registro), no una red social ni un coach.

**Métrica de éxito del flujo principal:** registrar un alimento reciente en **≤ 3 toques**
(`+` → alimento reciente → Guardar) y uno nuevo en ≤ 5 toques más la búsqueda.

### Contradicciones y tensiones detectadas (y cómo se resuelven)

| #   | Tensión                                                | Resolución                                                                                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | "Instalar → configurar perfil"                         | Instalar una PWA es opcional y depende del navegador. El onboarding ocurre en la **primera apertura**, instalada o no.                                                                                                                                                                      |
| 2   | "100 % offline" vs "ampliar el catálogo"               | La base inicial viaja con la app (precacheada). Los catálogos extra necesitan red **una vez** para descargarse; después quedan en IndexedDB y funcionan offline.                                                                                                                            |
| 3   | "Peso actual" en el perfil vs "historial de peso"      | Dos fuentes de verdad se desincronizan. **El peso actual se deriva del último registro de peso.** Editarlo en el perfil crea o actualiza el registro de hoy.                                                                                                                                |
| 4   | "Registrar edad"                                       | Una edad guardada caduca. Se pide la edad, pero se guarda el **año de nacimiento** (derivado) y la edad se calcula. Precisión de ±1 año, suficiente para estimar objetivos, y más privado que una fecha exacta.                                                                             |
| 5   | "Objetivos sugeridos" vs "sin recomendaciones médicas" | Se usa una fórmula pública estándar (Mifflin-St Jeor) con aviso explícito ("estimación orientativa, no es consejo médico"). Los objetivos siempre son editables. La fórmula necesita **sexo** y **nivel de actividad**: se piden como campos opcionales que solo sirven para la estimación. |
| 6   | Unidades variadas vs modelo simple                     | Cada alimento tiene **una unidad base** (`g`, `ml` o `unit`) y, opcionalmente, el tamaño de una "unidad" y de una "porción". No se convierte g↔ml en la app; esa conversión ocurre una sola vez en el script de datos usando la densidad publicada por USDA.                                |
| 7   | "Eliminar datos" vs sincronización futura              | El borrado individual es **lógico** (`deletedAt`, tombstone) para que un futuro sync propague borrados. "Eliminar todos mis datos" sí es **físico**.                                                                                                                                        |
| 8   | Local-first en la web vs desalojo de almacenamiento    | Safari puede borrar el almacenamiento de sitios no instalados tras 7 días sin uso, y cualquier navegador puede hacerlo bajo presión de espacio. Mitigación: `navigator.storage.persist()`, invitar a instalar y **recordatorio de backup**.                                                 |
| 9   | Categorías "cambiables" vs MVP simple                  | El MVP usa cuatro categorías fijas, pero cada registro guarda la categoría como texto (`meal: string`). Añadir categorías personalizadas después no requiere migración.                                                                                                                     |
| 10  | Nombre del proyecto                                    | **"OPENFIT" es una marca registrada en EE. UU.** (OPENFIT, LLC, reg. 5713646, software de fitness). Se usa como nombre de trabajo, centralizado en un solo lugar. **Recomiendo elegir otro nombre antes de publicar.**                                                                      |
| 11  | "Base nutricional propia" vs traducciones              | USDA publica en inglés. La base inicial se cura a mano con nombres en español e inglés y sinónimos regionales (jitomate/tomate, cacahuate/cacahuete). El catálogo ampliado de USDA queda solo en inglés en el MVP.                                                                          |
| 12  | CSV "cuando tenga sentido"                             | CSV solo para **exportar** (registros, totales diarios, peso, alimentos propios). La restauración completa usa JSON. No hay importación CSV en el MVP.                                                                                                                                      |

### Alcance

- **Dentro:** todo lo listado en la sección 2.
- **Fuera:** servidor, cuentas, sync, IA, escáner de códigos, social, anuncios, suscripciones,
  consejos médicos, micronutrientes y unidades imperiales (ver secciones 15 y 19).

---

## 2. Definición final del MVP

| #     | Funcionalidad         | Decisión concreta                                                                                                                               |
| ----- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | PWA instalable        | Manifest + service worker propio + iconos + aviso de actualización.                                                                             |
| 2     | 100 % local           | IndexedDB como fuente de verdad. Cero peticiones de red con datos personales.                                                                   |
| 3     | Perfil                | Edad (→ año de nacimiento), altura, peso actual (→ registro de peso), peso objetivo, sexo (opcional), actividad.                                |
| 4     | Objetivos             | kcal, proteína, carbohidratos y grasas diarios. Sugerencia automática editable.                                                                 |
| 5     | Base pequeña          | ~95 alimentos comunes curados desde USDA (CC0), en ES/EN, con unidad y porción.                                                                 |
| 6     | Búsqueda              | Local, sin acentos, multilenguaje, con prioridad para recientes y alimentos propios.                                                            |
| 7     | Alimentos propios     | Nombre, marca, cantidad base (g/ml/unidad), kcal y macros, tamaño de unidad y porción.                                                          |
| 8     | Cantidades            | g, kg, ml, l, unidad y porción, con conversiones centralizadas y testeadas.                                                                     |
| 9     | Categorías            | Desayuno, comida, cena y snacks.                                                                                                                |
| 10–13 | Calorías y macros     | Totales diarios, por categoría y por registro; progreso frente al objetivo.                                                                     |
| 14    | Historial             | Navegar por días (anterior/siguiente, "Hoy") y calendario mensual con días registrados.                                                         |
| 15    | Peso                  | Registro por fecha (uno por día), lista y gráfica simple con línea del objetivo.                                                                |
| 16    | Offline completo      | Toda la app precacheada. Funciona en modo avión desde la primera carga completa.                                                                |
| 17    | Backup JSON           | Archivo con `schemaVersion`, incluye tombstones.                                                                                                |
| 18    | Restauración JSON     | Modo **reemplazar** (por defecto) o **combinar** (gana el cambio más reciente). Validación completa antes de escribir, en una sola transacción. |
| 19    | CSV                   | Registros, totales diarios, peso y alimentos propios.                                                                                           |
| 20    | Responsive            | Diseñado para 375–430 px; barra inferior en móvil y navegación lateral en escritorio.                                                           |
| 21    | ES / EN               | Diccionarios tipados; detección automática; selector manual.                                                                                    |
| +     | Comidas reutilizables | Plantillas creadas desde cero o desde una categoría del día; se registran con una acción.                                                       |
| +     | Eliminar datos        | Borrado total con doble confirmación.                                                                                                           |
| +     | Catálogos opcionales  | Paquete USDA SR Legacy (~7 700 alimentos, inglés) descargable bajo demanda.                                                                     |

**Criterio de "hecho":** la _Definition of Done_ de `PLAN.md`, verificada en un navegador real
(incluido el modo offline y la persistencia tras recargar).

---

## 3. Comparación de stacks

Tres alternativas, todas con **TypeScript + Vite** (Vite es el estándar de facto, rápido y sin
lock-in: produce archivos estáticos).

| Criterio                    | A. **Svelte 5**                                                               | B. **Preact + Signals**                                                          | C. **Lit / Web Components**                                  |
| --------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Runtime base (gzip, aprox.) | ~10–15 KB, crece poco por componente (compilado)                              | ~5 KB (+1–2 KB signals)                                                          | ~6 KB                                                        |
| Código por pantalla         | **Bajo**: `bind:value`, estado reactivo y CSS con scope integrados            | Medio: JSX, hooks y manejo manual de formularios                                 | Alto: decoradores/propiedades, eventos manuales y Shadow DOM |
| Velocidad                   | Excelente (sin VDOM)                                                          | Excelente                                                                        | Excelente                                                    |
| PWA                         | Sin diferencia (SW propio)                                                    | Sin diferencia                                                                   | Sin diferencia                                               |
| IndexedDB                   | Promesas + runes; no hace falta una librería de estado                        | Signals + efectos; cuidado con cierres obsoletos                                 | Controladores reactivos manuales                             |
| Curva de aprendizaje        | Baja: plantillas parecidas a HTML                                             | Baja si ya se conoce React; los hooks tienen trampas                             | Media: estándares web + particularidades de Lit              |
| Ecosistema                  | Mediano (suficiente; casi no se necesita)                                     | Hereda el de React, con la tentación de añadir dependencias pesadas vía `compat` | Pequeño                                                      |
| Contribuciones OSS          | Buena: popular y fácil de leer                                                | La mayor base de desarrolladores (React)                                         | Menor                                                        |
| Mantenibilidad              | Alta: menos código, menos estado accidental                                   | Media-alta                                                                       | Media (más boilerplate)                                      |
| Longevidad                  | Proyecto maduro (2016), mantenedores financiados; Svelte 5 estable desde 2024 | Maduro y estable                                                                 | Muy alta: los estándares web no caducan                      |
| Complejidad                 | Baja (sin SvelteKit)                                                          | Baja-media                                                                       | Media                                                        |

### Por qué no elegir automáticamente React/Preact

La app se compone casi toda de **formularios, listas y totales derivados**. En ese terreno, el
binding bidireccional y la reactividad compilada de Svelte eliminan mucho código repetitivo. El
runtime algo mayor que el de Preact se compensa con componentes más pequeños.

---

## 4. Stack recomendado

**Svelte 5 (runes) + TypeScript + Vite, sin SvelteKit.**

- **Sin SvelteKit:** no hay SSR ni rutas de servidor. Una SPA estática con **router por hash**
  funciona en cualquier hosting estático y en cualquier subruta (GitHub Pages, NAS, `nginx`, etc.)
  sin configurar reescrituras.
- **Sin librerías de UI ni de CSS:** CSS propio con tokens (variables) y componentes pequeños.
- **Sin librería de IndexedDB:** un envoltorio propio de ~120 líneas (ver sección 6).
- **Sin librería de i18n, gráficas, router ni fechas:** se usan `Intl.*` y SVG a mano.
- **Service worker propio** (~80 líneas) con un plugin de Vite de ~60 líneas que genera la lista de
  precache. Se descarta Workbox/vite-plugin-pwa: aportan más de lo necesario.

### Dependencias

**Runtime: ninguna** (Svelte se compila dentro del bundle).

| Dev dependency                                                                 | Motivo                                                                          |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `svelte`, `@sveltejs/vite-plugin-svelte`, `vite`                               | Compilación y servidor de desarrollo.                                           |
| `typescript` (6.0.x), `svelte-check`                                           | Tipos. TS 7 todavía no es compatible con `svelte-check` ni `typescript-eslint`. |
| `vitest`                                                                       | Tests; comparte la configuración con Vite.                                      |
| `fake-indexeddb`                                                               | IndexedDB en Node para probar persistencia, migraciones y backups.              |
| `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-svelte`, `globals` | Lint.                                                                           |
| `prettier`, `prettier-plugin-svelte`                                           | Formato consistente para contribuciones.                                        |
| `@types/node`                                                                  | Tipos para los scripts de Node.                                                 |

Los scripts (`scripts/*.ts`) se ejecutan con **Node ≥ 22.18**, que entiende TypeScript de forma
nativa, sin `tsx` ni `ts-node`.

**Runtime (solo en las apps nativas):** `@capacitor/core`, `@capacitor/app`, `@capacitor/filesystem`
y `@capacitor/share`. Se cargan únicamente en el build `--mode native`; el bundle web no los incluye.
`playwright-core` (dev) ejecuta la prueba de humo en el Chrome instalado, sin descargar navegadores.

---

## 4b. Apps nativas (Android e iOS)

### Opciones evaluadas

| Opción                            | Veredicto                                                                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Solo PWA**                      | Descartada como única vía: no llega a las tiendas, la instalación en iOS es poco descubrible y Safari puede borrar el almacenamiento de sitios sin uso. |
| **Capacitor** (WebView + plugins) | ✅ **Elegida.** Reutiliza el 100 % del código, tres plugins pequeños y mantenidos, proyectos nativos generados y versionados.                           |
| React Native / Flutter            | Descartadas: duplicarían la app entera y contradicen "un solo código, pocas dependencias".                                                              |
| Tauri Mobile                      | Interesante, pero menos maduro en iOS y sin ventaja clara sobre Capacitor para una app de formularios.                                                  |

### Qué añaden las apps (y nada más)

| Necesidad                                               | Solución                                                                                                                                                                                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Exportar sin "descargas" del navegador                  | Hoja de compartir del sistema (`@capacitor/share`): Archivos, Drive, correo…                                                                                                                                                         |
| Botón atrás de Android                                  | Cierra la hoja abierta → retrocede → Diario → minimiza (`@capacitor/app`).                                                                                                                                                           |
| Protección frente al borrado del WebView por el sistema | **Copia privada** de todos los datos en el sandbox de la app (`@capacitor/filesystem`), reescrita tras cada cambio y al pasar a segundo plano; se restaura sola si IndexedDB aparece vacío. Se borra con "Eliminar todos mis datos". |
| Privacidad exigible por el sistema                      | Android sin permiso `INTERNET` y con `allowBackup=false`; manifiesto de privacidad de iOS sin datos recogidos ni rastreo.                                                                                                            |
| Márgenes seguros (notch, barra de gestos)               | Plugin System Bars de Capacitor 8 con `insetsHandling: css`; el CSS usa `--safe-top`/`--safe-bottom`.                                                                                                                                |
| Iconos y pantallas de arranque                          | Generados desde el mismo logo (`npm run icons` + `@capacitor/assets`).                                                                                                                                                               |

### Diferencias del build nativo

`vite build --mode native` omite el service worker (los archivos viajan dentro del paquete) y
`src/platform/index.ts` carga `native.ts` solo en ese modo. Los catálogos opcionales se incluyen
en el paquete y se "instalan" sin red.

### Verificado

Android 15 (emulador Pixel 8, API 35): arranque sin permisos, siembra del catálogo, registro de
alimentos, botón atrás, hoja de compartir con el backup, instalación del paquete USDA sin red,
tema oscuro con barras del sistema, y recuperación automática tras borrar IndexedDB. iOS: proyecto
generado y configurado; requiere macOS para compilar.

### Riesgos añadidos

| Riesgo                                    | Mitigación                                                                                                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rechazo en tiendas por "app web envuelta" | La app aporta funciones nativas reales (compartir, copia privada, atrás) y la política de Apple exige experiencia acorde a la plataforma: márgenes seguros, tema, rendimiento. |
| Capacitor deja de mantenerse              | El código nativo se limita a `src/platform/native.ts` (~120 líneas); la PWA sigue completa sin él.                                                                             |
| Nombre y `appId`                          | Igual que la marca: decidir el nombre definitivo **antes** de publicar; el `appId` no puede cambiar después.                                                                   |

---

## 4c. Revisión de producto (2026-09-17)

Cambios pedidos tras probar el MVP, con la decisión tomada en cada caso.

| Petición                                                                             | Decisión                                                                                                                                                                                                                                                                                                                                                                                                                    | Por qué                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Descargar alimentos no sirve; no quiero que el usuario tenga que crear sus comidas" | El catálogo USDA completo (7 694 alimentos) se instala **solo al primer arranque** y viaja con la app (precache en la PWA, ~230 KB gzip; dentro del paquete en Android/iOS). Se generan **nombres en español** con un glosario de ~600 términos (`scripts/lib/glossary.ts`), cobertura media del 76 % de las palabras. La base curada sigue teniendo prioridad en la búsqueda. Crear alimentos propios pasa a ser opcional. | La descarga manual era un paso que nadie iba a dar, y sin ella el buscador parecía vacío. El presupuesto de precache sube de 250 a 400 KB; el arranque inicial sigue por debajo de 60 KB. |
| Edad por fecha de nacimiento                                                         | `Profile.birthDate` (`YYYY-MM-DD`) sustituye a `birthYear`; la edad se calcula al día. Migración v2 de IndexedDB y de backups (año → 1 de julio de ese año).                                                                                                                                                                                                                                                                | Una edad guardada caduca; la fecha permite cálculos exactos y no drifta.                                                                                                                  |
| Solo hombre o mujer                                                                  | `Profile.sex` obligatorio (`female`                                                                                                                                                                                                                                                                                                                                                                                         | `male`); el onboarding ya no se puede omitir (la app se construye sobre altura, peso, sexo y fecha). Datos antiguos sin sexo migran a `male`.                                             | Lo determinan la estimación calórica (Mifflin-St Jeor) y la figura corporal. |
| Color de acento                                                                      | Seis acentos (`Prefs.accent`) definidos como variables CSS por `data-accent`, con variante clara y oscura validadas en contraste; se cachea en `localStorage` para evitar el parpadeo inicial.                                                                                                                                                                                                                              | Personalización sin peso: son 30 líneas de CSS por acento.                                                                                                                                |
| Modelo de persona con peso y altura                                                  | Silueta SVG (`src/core/figure.ts`, geometría pura y testeada) cuya altura sigue la estatura y cuya anchura sigue el IMC, con proporciones distintas por sexo y el peso objetivo como contorno punteado. Aparece en el onboarding, el perfil y la pantalla de peso.                                                                                                                                                          | Refuerza el objetivo sin añadir métricas corporales complejas (fuera del MVP). Es una representación, no un modelo médico.                                                                |
| Libras o kilos                                                                       | `Prefs.weightUnit`; los pesos se **almacenan siempre en kg** y se convierten solo en formularios, pantalla de peso, gráfica y figura. Los CSV siguen en kg.                                                                                                                                                                                                                                                                 | Una sola unidad interna evita errores; la preferencia es solo de presentación.                                                                                                            |

Se mantiene fuera: unidades imperiales de altura (pies/pulgadas) y catálogos con marcas (Open Food Facts), por las razones de las secciones 17 y 19.

---

## 5. Arquitectura local-first

```
┌──────────────────────────────────────────────────────────────┐
│  UI  (src/screens, src/components)  ·  Svelte 5              │
│    lee:   liveQuery(() => repo.listX(...))                   │
│    escribe: repo.saveX(...)                                  │
├──────────────────────────────────────────────────────────────┤
│  Estado de app (src/state): router, reloj, prefs, toasts     │
├──────────────────────────────────────────────────────────────┤
│  Repositorios (src/db/repos)  ← ÚNICO acceso a IndexedDB     │
│    · sellan id / createdAt / updatedAt / deletedAt           │
│    · emiten "cambio" → bus local + BroadcastChannel          │
│                                  ╲                           │
│                                   ╲→ [futuro] SyncProvider   │
├──────────────────────────────────────────────────────────────┤
│  IndexedDB "openfit" (src/db/schema.ts + migraciones)        │
└──────────────────────────────────────────────────────────────┘
        ▲
        │ usa (funciones puras, sin DOM, 100 % testeadas)
┌──────────────────────────────────────────────────────────────┐
│  Core (src/core): unidades, nutrición, objetivos, fechas,    │
│  búsqueda, CSV, formato de backup + migraciones + merge LWW  │
└──────────────────────────────────────────────────────────────┘
```

### Reglas

1. **La UI nunca toca IndexedDB.** Todo pasa por `src/db/repos`.
2. **Toda escritura** sella marcas de tiempo y emite un evento de cambio. Las consultas reactivas
   (`liveQuery`) se vuelven a ejecutar, y las demás pestañas se enteran vía `BroadcastChannel`.
3. **El core es puro.** Sin `window`, sin IndexedDB y sin fechas implícitas. Es donde vive la lógica
   que importa (y la mayoría de los tests).
4. **Los totales no se guardan: se calculan.** Cada registro guarda una _instantánea_ inmutable de los
   datos nutricionales del alimento, de modo que editar o borrar un alimento no altera el historial.
5. **Ninguna petición de red** lleva datos personales. Las únicas peticiones posibles son a la propia
   app (actualizaciones y catálogos opcionales).

### Puntos de extensión para el self-hosting (sin construirlo)

Un futuro `SyncProvider` necesita tres cosas, y **las tres ya existen**:

1. **Qué cambió:** índice `updatedAt` en cada store sincronizable, más el bus de cambios.
2. **Qué se borró:** tombstones (`deletedAt`).
3. **Cómo resolver conflictos:** `mergeRecords()` (last-writer-wins por `updatedAt`), que ya usa la
   restauración en modo "combinar".

El protocolo futuro puede ser tan simple como `pull(since) → registros` y `push(registros)`, con el
mismo formato de registro que el backup. No se crea todavía ninguna interfaz `SyncProvider`: sería
una abstracción sin uso.

```
PWA ─→ IndexedDB (verdad) ─→ [opcional] SyncProvider ─→ servidor elegido por el usuario
```

---

## 6. IndexedDB: elección y estructura

### Elección

| Opción                                   | Tamaño         | Veredicto                                                                                                |
| ---------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------- |
| `localStorage`                           | 0              | ❌ Síncrono, solo strings, ~5 MB. Solo sirve para preferencias triviales, y ni eso: todo va a IndexedDB. |
| **IndexedDB nativo + envoltorio propio** | ~1 KB          | ✅ **Elegido.** Las consultas son simples (por clave, por índice de fecha, rangos).                      |
| `idb` (Jake Archibald)                   | ~1,2 KB        | Buena alternativa; no aporta lo suficiente para justificar una dependencia.                              |
| Dexie                                    | ~25–30 KB gzip | Útil para consultas complejas y `liveQuery`; hoy no se necesita. Se reevaluará si las consultas crecen.  |

El envoltorio (`src/db/idb.ts`) ofrece: apertura con migraciones versionadas, `transaction()` con
promesa que se resuelve al hacer _commit_, y utilidades `get/getAll/put/delete/clear/byIndex`.

### Stores (versión de esquema 1)

| Store      | keyPath | Índices                       | Contenido                                                                        | ¿En backup?               | ¿Sync futuro? |
| ---------- | ------- | ----------------------------- | -------------------------------------------------------------------------------- | ------------------------- | ------------- |
| `meta`     | `key`   | —                             | Datos **del dispositivo**: `deviceId`, versión del catálogo base, `lastBackupAt` | No                        | No            |
| `settings` | `id`    | `updatedAt`                   | Singletons del usuario: `profile`, `prefs`                                       | Sí                        | Sí            |
| `foods`    | `id`    | `updatedAt`                   | Alimentos personalizados                                                         | Sí                        | Sí            |
| `meals`    | `id`    | `updatedAt`                   | Comidas reutilizables (plantillas)                                               | Sí                        | Sí            |
| `entries`  | `id`    | `date`, `updatedAt`, `foodId` | Registros del diario                                                             | Sí                        | Sí            |
| `weights`  | `id`    | `date`, `updatedAt`           | Historial de peso                                                                | Sí                        | Sí            |
| `catalog`  | `id`    | `pack`                        | **Base nutricional pública** (no personal)                                       | Solo la lista de paquetes | No            |

**Relaciones:** `entries.foodId → foods.id | catalog.id` (referencia débil: el registro lleva su
instantánea) y `meals.items[].foodId` (igual). No hay claves foráneas ni borrados en cascada.

### Versionado y migraciones

- `DB_VERSION = migrations.length`. Cada migración es una función `(db, tx) => void` que se ejecuta
  dentro de la transacción `versionchange`, así que **es atómica**: si falla, la base queda en la
  versión anterior sin perder datos.
- **Regla:** una migración publicada **nunca se modifica**; siempre se añade una nueva.
- Las migraciones de datos (transformar registros) usan cursores dentro de esa misma transacción.
- Si otra pestaña tiene abierta una versión antigua, se cierra la conexión (`onversionchange`) y se
  pide recargar.
- Los tests (`fake-indexeddb`) cubren la creación desde cero y una actualización simulada v1→v2 con
  datos existentes.
- El **backup** tiene su propia cadena de migraciones (`migrateBackup`), numerada igual que el esquema.

---

## 7. Modelo inicial de datos

```ts
type Unit = 'g' | 'kg' | 'ml' | 'l' | 'unit' | 'serving';
type BaseUnit = 'g' | 'ml' | 'unit';
type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snacks'; // se guarda como string

interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Campos de sincronización comunes a todo dato del usuario. */
interface Synced {
  id: string; // UUID, o id determinista en singletons y peso
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms; se actualiza en cada escritura
  deletedAt?: number | null; // tombstone
}

/** Datos nutricionales: lo que se necesita para calcular macros de una cantidad. */
interface FoodFacts {
  name: string;
  names?: { es?: string; en?: string }; // traducciones (catálogo)
  brand?: string;
  baseAmount: number; // p. ej. 100
  baseUnit: BaseUnit; // p. ej. 'g'
  macros: Macros; // por baseAmount de baseUnit
  unitSize?: number; // 1 "unidad" en baseUnit (p. ej. huevo = 50 g)
  servingSize?: number; // 1 "porción" en baseUnit (p. ej. arroz = 158 g)
}

interface CatalogFood extends FoodFacts {
  // store: catalog
  id: string; // "base:egg", "usda:171287"
  pack: string; // "base", "usda-sr-legacy"
  aliases?: string[]; // sinónimos para la búsqueda
  sourceId?: string; // p. ej. FDC ID
}

interface CustomFood extends FoodFacts, Synced {} // store: foods

interface Entry extends Synced {
  // store: entries
  date: string; // "YYYY-MM-DD" local
  meal: MealSlot | string;
  foodId: string;
  food: FoodFacts; // instantánea inmutable
  amount: number;
  unit: Unit;
}

interface MealTemplate extends Synced {
  // store: meals
  name: string;
  items: { foodId: string; food: FoodFacts; amount: number; unit: Unit }[];
}

interface WeightEntry extends Synced {
  date: string;
  kg: number;
} // store: weights

interface Profile extends Synced {
  // store: settings, id "profile"
  birthYear: number | null;
  heightCm: number | null;
  sex: 'male' | 'female' | null; // solo para estimar
  activity: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  targetWeightKg: number | null;
  goals: Macros; // objetivos diarios
}

interface Prefs extends Synced {
  // store: settings, id "prefs"
  locale: 'es' | 'en' | null; // null = automático
  theme: 'system' | 'light' | 'dark';
}
```

### Análisis del modelo `Food` propuesto en el plan

| Campo propuesto                         | Decisión                                                                                                                                                                                             |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `servingSize` / `servingUnit`           | Se sustituye por `baseAmount` + `baseUnit` (en qué cantidad están expresados los nutrientes) y `unitSize` / `servingSize` (tamaños opcionales). Es lo mínimo para soportar g/kg/ml/l/unidad/porción. |
| `calories, protein, carbohydrates, fat` | Se agrupan en `macros` para sumar y escalar con una sola función.                                                                                                                                    |
| `fiber, sugar, sodium`                  | **Fuera del MVP.** Se podrán añadir como campos opcionales sin migración (IndexedDB no tiene esquema de columnas).                                                                                   |
| `source`, `sourceId`                    | Solo en el catálogo (`pack`, `sourceId`).                                                                                                                                                            |
| `createdAt`, `updatedAt`                | Solo en datos del usuario (`Synced`); el catálogo se versiona por paquete.                                                                                                                           |

### Cálculo

```
cantidadEnBase = convertir(cantidad, unidad → baseUnit)   // null si es incompatible
factor         = cantidadEnBase / baseAmount
macros         = food.macros × factor
```

- `g↔kg` y `ml↔l` se convierten siempre. `unit` requiere `unitSize` (o `baseUnit = 'unit'`) y
  `serving` requiere `servingSize`.
- Se redondea **solo al mostrar** (kcal a enteros; gramos a 0–1 decimales).

---

## 8. Estrategia de IDs pensando en sync

| Entidad                        | ID                        | Motivo                                                                                                 |
| ------------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------ |
| Alimentos, comidas y registros | `crypto.randomUUID()`     | Únicos sin coordinación entre dispositivos. Nativo, sin dependencias.                                  |
| Perfil y preferencias          | `"profile"`, `"prefs"`    | Singletons: dos dispositivos editan **el mismo** registro, así que el merge es natural.                |
| Peso                           | `"weight:YYYY-MM-DD"`     | Un peso por día: dos dispositivos que registran el mismo día convergen en un solo registro.            |
| Catálogo                       | `"<pack>:<id de origen>"` | Estable entre instalaciones y reinstalaciones. Los registros que lo referencian siguen siendo válidos. |
| Dispositivo                    | `meta.deviceId` (UUID)    | Futuro desempate de conflictos y diagnóstico. No sale del dispositivo.                                 |

- Nunca se usan autoincrementales.
- `updatedAt` usa el reloj del dispositivo. Riesgo de desfase de reloj en sync: se documenta. Si
  llegara a importar, se puede añadir un reloj lógico híbrido (HLC) sin cambiar los IDs.
- El borrado es lógico (`deletedAt`) y restaurar = limpiar `deletedAt` + nuevo `updatedAt`
  (esto habilita "Deshacer").

---

## 9. Backup y restauración

### Formato

```json
{
  "format": "openfit-backup",
  "schemaVersion": 1,
  "app": { "name": "OpenFit", "version": "0.1.0" },
  "exportedAt": "2026-09-16T20:15:00.000Z",
  "data": {
    "settings": [ { "id": "profile", ... }, { "id": "prefs", ... } ],
    "foods":    [ ... ],
    "meals":    [ ... ],
    "entries":  [ ... ],
    "weights":  [ ... ],
    "packs":    [ "usda-sr-legacy" ]
  }
}
```

- Incluye **tombstones**: así el modo "combinar" propaga borrados, igual que lo hará un sync.
- No incluye el catálogo (datos públicos, reinstalables); solo la lista de paquetes instalados.
- Nombre de archivo: `openfit-backup-YYYY-MM-DD.json`.

### Exportar

`Blob` + enlace de descarga. En móviles con `navigator.canShare({ files })` se ofrece también
"Compartir", útil en iOS para guardarlo en Archivos. Se guarda `meta.lastBackupAt`.

### Restaurar

1. Leer el archivo → `JSON.parse`.
2. Validar `format`. Si `schemaVersion` es **mayor** que la soportada, se rechaza con el mensaje
   "Actualiza la app".
3. `migrateBackup()` lo lleva a la versión actual.
4. **Validar cada registro** (tipos, campos obligatorios y números finitos). Ante cualquier error se
   rechaza el archivo completo **sin tocar nada**.
5. Mostrar un resumen (N registros, N alimentos, rango de fechas) y elegir modo:
   - **Reemplazar** (por defecto): borra los datos personales y escribe los del backup.
   - **Combinar:** `mergeRecords()` por `id`; gana el `updatedAt` mayor y, en empate, el local.
6. Todo en **una sola transacción**: si algo falla, no cambia nada.

### Fomentar backups

- En Ajustes → Datos: "Último backup: hace N días".
- En el Diario: aviso discreto y descartable si hay datos y nunca se hizo un backup, o si pasaron
  más de 14 días.
- Petición de almacenamiento persistente al completar el onboarding. Su estado se muestra en Ajustes.

### Eliminar

"Eliminar todos mis datos": doble confirmación, con la sugerencia de exportar antes. Borra los stores
personales y `meta`. Conserva el catálogo público y vuelve al onboarding.

### CSV (solo exportación)

| Archivo            | Columnas                                                                                      |
| ------------------ | --------------------------------------------------------------------------------------------- |
| `entries.csv`      | date, meal, food, brand, amount, unit, kcal, protein_g, carbs_g, fat_g                        |
| `daily-totals.csv` | date, kcal, protein_g, carbs_g, fat_g, kcal_goal, protein_goal_g, carbs_goal_g, fat_goal_g    |
| `weight.csv`       | date, weight_kg                                                                               |
| `custom-foods.csv` | name, brand, base_amount, base_unit, kcal, protein_g, carbs_g, fat_g, unit_size, serving_size |

RFC 4180, UTF-8 con BOM (para Excel), y protección contra _CSV injection_ en celdas de texto que
empiezan por `= + - @`.

---

## 10. Base nutricional

### Evaluación de fuentes

| Fuente                                | Licencia                                                  | Redistribución                         | Atribución                 | Tamaño                             | Calidad                    | Cobertura                                     | Estructura                               |
| ------------------------------------- | --------------------------------------------------------- | -------------------------------------- | -------------------------- | ---------------------------------- | -------------------------- | --------------------------------------------- | ---------------------------------------- |
| **USDA FoodData Central – SR Legacy** | **CC0 1.0 / dominio público**                             | Libre                                  | Solicitada, no obligatoria | CSV de 6 MB (zip), 7 793 alimentos | Alta (laboratorio, curada) | EE. UU., alimentos genéricos                  | CSV relacional (food, nutrient, portion) |
| USDA FDC – Foundation Foods           | CC0                                                       | Libre                                  | Solicitada                 | Pequeña (cientos)                  | Muy alta                   | Genéricos                                     | Igual que SR                             |
| **Open Food Facts**                   | **ODbL** (base) + DbCL (contenidos) + CC-BY-SA (imágenes) | Sí, con **share-alike**                | **Obligatoria**            | Varios GB, millones de productos   | Variable (colaborativa)    | Internacional, productos con código de barras | JSONL/CSV/Parquet                        |
| CIQUAL (ANSES, Francia)               | Licencia abierta según data.gouv.fr                       | Revisar condiciones de la versión 2025 | Sí                         | ~3 500 alimentos                   | Alta                       | Francia/Europa                                | XLSX/XML                                 |
| BEDCA (España), SMAE (México)         | No verificada / restrictiva                               | **No usar sin permiso escrito**        | —                          | —                                  | Alta                       | Local                                         | —                                        |

### Decisión

1. **Base inicial = selección curada de USDA SR Legacy (CC0).** Unos 95 alimentos, con nombres en
   español e inglés, sinónimos regionales y tamaños de unidad/porción tomados de las porciones de
   USDA. Los líquidos se expresan por 100 ml usando la densidad derivada de la porción "1 cup" de
   USDA.
2. **Paquete opcional "USDA SR Legacy completo"** (solo inglés, por 100 g), descargable bajo demanda.
3. **Open Food Facts: post-MVP**, siempre como **paquete separado bajo ODbL** o como búsqueda online
   _opt-in_ por código de barras (solo se enviaría el código, nunca datos personales).

### Pipeline

```
data/base-foods.csv            (curado a mano: slug, fdc_id, nombres, sinónimos, unidad/porción)
        +
USDA SR Legacy CSV             (descargado por el script; no se versiona en git)
        │
        ▼
scripts/build-catalog.ts       (parseo, selección de nutrientes 1008/1003/1004/1005,
        │                       conversión a ml, redondeo, validación)
        ├─→ src/catalog/base-foods.json         (~95 alimentos, se empaqueta con la app)
        └─→ public/packs/usda-sr-legacy.json    (paquete opcional, NO precacheado)
            public/packs/index.json             (lista de paquetes disponibles)
        │
        ▼
IndexedDB `catalog` (sembrado en el primer arranque; paquetes instalados bajo demanda)
```

### Formato de paquete (compacto)

```json
{
  "format": "openfit-pack", "version": 1,
  "id": "usda-sr-legacy", "name": "USDA SR Legacy",
  "license": "CC0-1.0", "attribution": "U.S. Department of Agriculture, ...",
  "source": "https://fdc.nal.usda.gov/",
  "fields": ["id", "name", "kcal", "protein", "carbs", "fat"],
  "foods": [["171287", "Egg, whole, raw, fresh", 143, 12.6, 0.7, 9.5], ...]
}
```

- **Instalar** = `fetch` + validación + `put` masivo en una transacción.
- **Quitar** = borrar por índice `pack`. Los registros no se rompen gracias a su instantánea.
- La base se **re-siembra** si cambia su versión con una actualización de la app.
- La búsqueda carga el catálogo en memoria una vez por sesión. Con ~8 000 alimentos, filtrar cuesta
  milisegundos.

---

## 11. Mantener pequeño el bundle

| Técnica                                                                       | Ahorro                             |
| ----------------------------------------------------------------------------- | ---------------------------------- |
| Svelte compilado, sin librería de componentes ni framework CSS                | Decenas de KB                      |
| Fuentes del sistema (sin webfonts)                                            | ~20–100 KB y peticiones externas   |
| Iconos SVG inline dibujados a mano (~10 iconos)                               | Sin librería de iconos             |
| Gráfica de peso en SVG propio                                                 | Sin Chart.js (~70 KB)              |
| Envoltorio IndexedDB propio                                                   | Sin Dexie (~25–30 KB)              |
| i18n con `Intl` y diccionarios planos                                         | Sin i18next (~15 KB)               |
| Router por hash propio                                                        | Sin router                         |
| Carga diferida de pantallas secundarias (peso, ajustes, editores, onboarding) | Menos JS inicial                   |
| Base de alimentos en un _chunk_ separado, cargado solo al sembrar             | No infla el JS inicial             |
| Paquetes grandes fuera del precache                                           | La instalación sigue siendo ligera |

**Presupuesto (verificado en CI con `npm run size`):**

- JS + CSS inicial ≤ **60 KB gzip**.
- Precache total (sin paquetes opcionales) ≤ **250 KB gzip**.

---

## 12. Estructura del repositorio

```
openfit/
├─ .github/                  CI, plantillas de issues y PR
├─ data/
│  └─ base-foods.csv         selección curada (fuente de la base inicial)
├─ deploy/
│  └─ nginx.conf             hosting estático opcional (Docker)
├─ docs/
│  ├─ DESIGN.md              este documento
│  ├─ ARCHITECTURE.md        guía técnica para contribuir
│  └─ DATA.md                base nutricional, formatos y licencias
├─ public/                   manifest, iconos, packs opcionales
├─ scripts/
│  ├─ build-catalog.ts       USDA → base-foods.json / packs
│  ├─ generate-icons.ts      iconos PNG sin dependencias
│  ├─ check-size.ts          presupuesto de tamaño
│  └─ pwa-plugin.ts          plugin de Vite que genera sw.js
├─ src/
│  ├─ core/                  lógica pura + tests (unidades, nutrición, objetivos, fechas,
│  │                         búsqueda, CSV, backup)
│  ├─ db/                    envoltorio IndexedDB, esquema, migraciones, repos + tests
│  ├─ catalog/               base-foods.json + parseo de paquetes
│  ├─ i18n/                  es.ts, en.ts, t()
│  ├─ state/                 router, liveQuery, reloj, prefs, toasts
│  ├─ pwa/                   registro del SW + plantilla sw.js
│  ├─ components/            UI reutilizable
│  ├─ screens/               una pantalla por archivo
│  ├─ App.svelte, main.ts, app.css
├─ Dockerfile                opcional: sirve la PWA estática
└─ README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, CHANGELOG, LICENSE
```

**Qué se descartó de la propuesta del plan y por qué:**

- `/features`: con ~12 pantallas, una carpeta por pantalla es ruido; `screens/` + `components/`
  basta.
- `/services`: los repos son los servicios.
- `/utils`: cajón de sastre; su contenido va a `core/` con nombres concretos.
- `/types`: los tipos viven junto a su dominio (`core/types.ts`).
- `/tests`: los tests van **junto al código** (`*.test.ts`), así son más fáciles de encontrar.

---

## 13. Mapa de pantallas

| Ruta (hash)                   | Pantalla                   | Contenido                                                                                                                                   |
| ----------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `#/welcome`                   | Onboarding                 | 1. Bienvenida + privacidad + idioma + "Restaurar backup". 2. Perfil. 3. Objetivos sugeridos (editables).                                    |
| `#/` · `#/day/:fecha`         | **Diario** (inicio)        | Navegador de fecha, resumen (kcal + 3 macros), 4 categorías con registros y subtotal, botón principal "+ Añadir alimento", aviso de backup. |
| `#/add?date&meal`             | **Añadir alimento**        | Buscador con foco automático; pestañas Recientes / Mis alimentos / Comidas; resultados. Hoja de cantidad.                                   |
| _(hoja)_                      | Cantidad / editar registro | Cantidad, unidad, categoría, vista previa de macros; Guardar / Eliminar.                                                                    |
| _(hoja)_                      | Calendario                 | Mes con los días registrados marcados.                                                                                                      |
| `#/library`                   | Biblioteca                 | Pestañas: Mis alimentos · Mis comidas.                                                                                                      |
| `#/foods/new` · `#/foods/:id` | Editor de alimento         | Formulario con validación y vista de kcal según macros.                                                                                     |
| `#/meals/new` · `#/meals/:id` | Editor de comida           | Nombre + elementos (buscador en hoja) + totales.                                                                                            |
| `#/weight`                    | Peso                       | Gráfica (1 M / 3 M / 1 A / Todo), alta rápida y lista con borrado.                                                                          |
| `#/settings`                  | Ajustes                    | Perfil, objetivos, idioma, tema, catálogos, datos, instalar, acerca de.                                                                     |
| `#/settings/profile`          | Perfil                     | Formulario de perfil.                                                                                                                       |
| `#/settings/goals`            | Objetivos                  | Objetivos + "Calcular sugerencia".                                                                                                          |
| `#/settings/data`             | Datos                      | Exportar/restaurar backup, CSV, almacenamiento persistente, eliminar todo.                                                                  |
| `#/settings/catalogs`         | Catálogos                  | Base (siempre instalada) + paquetes opcionales.                                                                                             |
| `#/settings/about`            | Acerca de                  | Privacidad, licencias, atribución USDA, versión.                                                                                            |

### Componentes

`AppNav` (barra inferior / lateral) · `PageHeader` · `Sheet` (`<dialog>` nativo) ·
`ConfirmHost` (confirmaciones por promesa) · `Toasts` (con "Deshacer") · `DailySummary` ·
`MacroBar` · `DateNav` · `Calendar` · `MealSection` · `EntryRow` · `FoodSearch` · `FoodRow` ·
`QuantitySheet` · `NumberField` · `WeightChart` · `EmptyState` · `Icon`.

### Estados vacíos

| Lugar                          | Mensaje y acción                                                       |
| ------------------------------ | ---------------------------------------------------------------------- |
| Categoría sin registros        | "Sin alimentos" + botón `+` de la categoría                            |
| Día sin registros              | Resumen en 0 con objetivos visibles (sin pantalla vacía aparte)        |
| Búsqueda sin resultados        | "No encontramos «x»" + "Crear alimento «x»" (con el nombre precargado) |
| Recientes vacíos               | "Aquí aparecerán los alimentos que registres"                          |
| Mis alimentos / comidas vacíos | Explicación en una línea + "Crear"                                     |
| Peso sin registros             | Formulario visible + "Registra tu primer peso para ver la gráfica"     |
| Gráfica con 1 punto            | Punto único y valor, sin línea                                         |

### Errores

| Situación                                                       | Tratamiento                                                                         |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| IndexedDB no disponible (p. ej. navegación privada restrictiva) | Pantalla completa explicando el motivo; no se puede usar la app sin almacenamiento. |
| Otra pestaña con una versión antigua abierta                    | Aviso "Cierra otras pestañas o recarga".                                            |
| Backup inválido o de una versión más nueva                      | Mensaje concreto; no se modifica nada.                                              |
| Descarga de un paquete sin conexión o fallida                   | Mensaje + reintentar; el catálogo no cambia.                                        |
| Cuota de almacenamiento excedida                                | Mensaje sugiriendo exportar y quitar paquetes opcionales.                           |
| Entrada numérica inválida                                       | Validación en línea; el botón Guardar queda deshabilitado.                          |
| Error inesperado                                                | Toast "Algo salió mal" + detalle en la consola. **Sin reporte remoto.**             |

---

## 14. Flujo de navegación y UX

```
Primera apertura
  └─ #/welcome ─ Empezar ─→ Perfil ─→ Objetivos ─→ #/ (Diario)
               └ Restaurar backup ─→ #/ (Diario)
               └ Omitir perfil ─→ objetivos por defecto ─→ #/

Flujo principal (≤ 3 toques con recientes)
  #/ Diario ── [+ Añadir] o [+ de la categoría] ──→ #/add
      ▲                                              │ toca un alimento
      │                                              ▼
      └──────── Guardar (vuelve y actualiza) ──── Hoja de cantidad
                                                     (cantidad y unidad prellenadas
                                                      con el último uso)

  #/add ─ pestaña Comidas ─→ hoja "Registrar comida" ─→ Añadir N alimentos ─→ #/
  #/add ─ sin resultados ─→ Crear alimento «x» ─→ #/foods/new ─→ vuelve a #/add

Diario
  ‹ / › cambia de día · toque en la fecha → Calendario · "Hoy" vuelve a hoy
  toque en un registro → hoja de edición (cantidad / categoría / eliminar → toast Deshacer)
  menú de categoría → "Guardar como comida"

Navegación principal (barra inferior en móvil, lateral en ≥ 900 px)
  Diario · Biblioteca · Peso · Ajustes
```

### Principios de UI

- **Una sola acción primaria por pantalla** (botón de acento).
- Paleta neutra (piedra/gris) + **un acento verde**. Los macros usan tres tonos apagados, solo en
  barras y puntos.
- Tipografía del sistema, escala corta (12/14/16/20/28/40), números tabulares.
- Espaciado en múltiplos de 4 px; áreas táctiles ≥ 44 px.
- Tema claro/oscuro automático, con selector manual.
- Sin sombras pesadas, sin gradientes y sin animaciones salvo transiciones de 150 ms (respetando
  `prefers-reduced-motion`).
- Accesibilidad: etiquetas reales, `role="progressbar"` con valores, foco gestionado por `<dialog>`,
  contraste AA y navegación por teclado.

---

## 15. Roadmap por milestones

| Milestone                | Contenido                                                                                                                          | Estado   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | -------- |
| **M0 · Diseño**          | Este documento                                                                                                                     | ✅       |
| **M1 · Fundaciones**     | Repo, tooling, CI, core (unidades, nutrición, fechas, CSV), IndexedDB + migraciones, i18n, router, shell PWA                       | ✅       |
| **M2 · Diario**          | Onboarding, perfil, objetivos, catálogo base + búsqueda, añadir/editar/borrar registros, resumen, navegación por días y calendario | ✅       |
| **M3 · Biblioteca**      | Alimentos propios y comidas reutilizables                                                                                          | ✅       |
| **M4 · Peso**            | Registro, lista y gráfica                                                                                                          | ✅       |
| **M5 · Datos**           | Backup/restauración (reemplazar/combinar), CSV, eliminar todo, recordatorio de backup, almacenamiento persistente                  | ✅       |
| **M6 · Release 0.1.0**   | Paquetes opcionales, accesibilidad, verificación offline, presupuesto de tamaño, docs                                              | ✅       |
| **M6b · Apps nativas**   | Capacitor: proyectos Android e iOS, compartir, botón atrás, copia privada, iconos/splash, workflow de APK                          | ✅       |
| M7 · Comodidad           | Añadir kcal rápidas, copiar día/categoría, categorías personalizadas, unidades imperiales, fibra/azúcar/sodio                      | Post-MVP |
| M8 · Catálogo ampliado   | Paquetes regionales, Open Food Facts (paquete ODbL) y escáner de códigos _opt-in_                                                  | Post-MVP |
| M9 · Self-hosting        | Especificación del protocolo de sync, `SyncProvider`, servidor de referencia (`docker compose up -d`)                              | Post-MVP |
| M10 · Seguridad de datos | Backups cifrados con contraseña (WebCrypto) y backup automático a una carpeta (File System Access)                                 | Post-MVP |

---

## 16. Riesgos técnicos

| Riesgo                                                                                    | Impacto                           | Mitigación                                                                                            |
| ----------------------------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Desalojo del almacenamiento (Safari ITP 7 días, limpieza del usuario, presión de espacio) | **Pérdida de datos**              | `storage.persist()`, invitar a instalar, recordatorio de backup y estado visible en Ajustes           |
| Diferencias entre implementaciones de IndexedDB                                           | Errores raros                     | Envoltorio mínimo, transacciones cortas, tests con `fake-indexeddb` y verificación en navegador real  |
| Service worker que sirve una versión vieja                                                | Usuarios atascados                | Cachés versionadas, `sw.js` sin caché HTTP, aviso "Actualizar" y limpieza de cachés antiguas          |
| Migración defectuosa                                                                      | Base inaccesible                  | Migraciones atómicas, prohibido editar migraciones publicadas, tests v1→v2                            |
| Zonas horarias / DST                                                                      | Registros en el día equivocado    | Fechas como `YYYY-MM-DD` locales; aritmética de fechas a mediodía local                               |
| Precisión decimal                                                                         | Totales con decimales raros       | Cálculo en coma flotante, redondeo solo al mostrar                                                    |
| Búsqueda lenta con catálogos grandes                                                      | UI lenta                          | Normalización precalculada, límite de resultados; índice por prefijos si se superan ~50 000 alimentos |
| Cambios en el tooling (p. ej. TS 7 aún no soportado)                                      | Builds rotos                      | Versiones fijadas, lockfile y Dependabot                                                              |
| iOS sin `beforeinstallprompt`                                                             | Instalación poco descubrible      | Instrucciones específicas en Ajustes                                                                  |
| Varias pestañas abiertas                                                                  | Datos desactualizados en pantalla | `BroadcastChannel` + `onversionchange`                                                                |
| Desfase de reloj (sync futuro)                                                            | Conflictos mal resueltos          | Documentado; HLC como mejora futura                                                                   |
| Cuota excedida al instalar paquetes                                                       | Instalación fallida               | Transacción atómica + mensaje claro                                                                   |

---

## 17. Riesgos de licencias de datasets

| Riesgo                                             | Evaluación                                                                             | Acción                                                                                            |
| -------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| USDA FDC                                           | CC0 / dominio público. USDA solicita citar la fuente.                                  | Atribución en Acerca de, en `docs/DATA.md` y en cada paquete.                                     |
| Open Food Facts                                    | **ODbL: share-alike** para bases derivadas; atribución obligatoria; imágenes CC-BY-SA. | Nunca mezclarlo con la base CC0. Paquete propio bajo ODbL, con atribución y enlace. Sin imágenes. |
| Marcas en nombres de productos (OFF/USDA Branded)  | Uso descriptivo aceptable; las marcas siguen siendo de terceros.                       | No usar logos. Base inicial sin marcas.                                                           |
| Tablas nacionales (BEDCA, SMAE, INCAP)             | Licencias restrictivas o no verificadas                                                | No usar sin permiso escrito.                                                                      |
| CIQUAL                                             | Licencia abierta según data.gouv.fr                                                    | Revisar las condiciones exactas antes de crear un paquete.                                        |
| Datos curados del proyecto (traducciones, tamaños) | Obra propia                                                                            | Publicarlos bajo **CC0** para no añadir fricción; el código va bajo MIT.                          |
| **Nombre "OpenFit"**                               | **Marca registrada de un tercero** en software de fitness                              | Renombrar antes de publicar. El nombre vive en `src/config.ts`, el manifest y `package.json`.     |

---

## 18. Decisiones que dificultarían el self-hosting

| Decisión peligrosa                                  | Qué hacemos en su lugar                                                        |
| --------------------------------------------------- | ------------------------------------------------------------------------------ |
| IDs autoincrementales                               | UUID e IDs deterministas                                                       |
| Borrado físico de registros                         | Tombstones (`deletedAt`)                                                       |
| No registrar cuándo cambió algo                     | `updatedAt` indexado en todos los stores sincronizables                        |
| Guardar totales derivados                           | Totales calculados al leer; instantánea inmutable por registro                 |
| Singletons con ID aleatorio                         | `"profile"` y `"prefs"` fijos                                                  |
| UI escribiendo directamente en la base              | Repos centralizados que emiten cambios                                         |
| Mezclar datos del dispositivo con datos del usuario | `meta` (local) separado de `settings` (sincronizable)                          |
| Mezclar catálogo público con datos personales       | Store `catalog` separado, nunca sincronizado                                   |
| Datos importantes en `localStorage`                 | Todo en IndexedDB                                                              |
| Backup sin versión ni validación                    | `schemaVersion`, migraciones y el mismo formato de registro que usaría el sync |
| Rutas absolutas o dependencia del dominio           | `base: './'` + router por hash: la app funciona en cualquier subruta           |
| URL de servidor o autenticación en el core          | Nada de red en el core; un futuro `SyncProvider` sería un módulo aparte        |
| CSP que impida conectar con un servidor propio      | CSP documentada y configurable en el hosting                                   |

---

## 19. Funcionalidades que eliminaría para mantener la app ligera

| Funcionalidad                                         | Motivo                                                          | ¿Vuelve?                         |
| ----------------------------------------------------- | --------------------------------------------------------------- | -------------------------------- |
| Micronutrientes (fibra, azúcar, sodio, vitaminas)     | Formularios más largos y datos incompletos                      | M7 (campos opcionales)           |
| Escáner de códigos de barras                          | Cámara + dataset enorme o red                                   | M8, _opt-in_                     |
| Recetas con raciones                                  | Las comidas reutilizables cubren el caso común                  | Quizá                            |
| Categorías de comida personalizables                  | UI de gestión; el modelo ya lo permite                          | M7                               |
| Unidades imperiales (lb, oz, tazas)                   | Más superficie de pruebas; las conversiones están centralizadas | M7                               |
| Estadísticas semanales/mensuales y gráficas de macros | Riesgo de dashboard corporativo                                 | Quizá (una vista simple)         |
| Agua, pasos, ejercicio, ayuno                         | Otro producto (el terreno de OpenGym)                           | No                               |
| Notificaciones push                                   | Requieren servidor push                                         | No (quizá recordatorios locales) |
| Multi-perfil                                          | Complejidad de datos                                            | No en el corto plazo             |
| Importar CSV / MyFitnessPal                           | Formatos cambiantes                                             | Quizá                            |
| Temas personalizados y animaciones                    | Peso sin valor funcional                                        | No                               |
| Fotos de comida                                       | Almacenamiento pesado                                           | No                               |
