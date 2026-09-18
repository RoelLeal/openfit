# ROLE

Actúa como un **Senior Full-Stack Engineer, Product Designer, Software Architect y Open Source Maintainer**.

Tu trabajo será diseñar y construir conmigo desde cero una **PWA open source, local-first y privacy-first para seguimiento de alimentación, calorías, macronutrientes, peso y objetivos nutricionales**.

El proyecto estará inspirado en la filosofía y parcialmente en el diseño de proyectos como **OpenGym**:

- interfaz limpia;
- funcionamiento rápido;
- aplicación ligera;
- pocas dependencias;
- datos bajo control del usuario;
- arquitectura sencilla;
- facilidad para contribuir;
- posibilidad futura de self-hosting;
- cero dependencia obligatoria de servicios externos.

No quiero simplemente un prototipo.

Quiero un proyecto funcional, mantenible, documentado y listo para publicarse en GitHub.

---

# GOAL

Construye una **Progressive Web App (PWA)** extremadamente ligera para seguimiento nutricional.

La aplicación deberá permitir:

1. crear un perfil local;
2. registrar edad;
3. registrar altura;
4. registrar peso;
5. establecer peso objetivo;
6. definir objetivos calóricos;
7. definir objetivos de macronutrientes;
8. registrar alimentos consumidos;
9. consultar calorías consumidas;
10. consultar proteína, carbohidratos y grasas;
11. consultar historial diario;
12. registrar cambios de peso;
13. utilizar alimentos disponibles en una base nutricional;
14. crear alimentos personalizados;
15. crear comidas reutilizables;
16. utilizar completamente la aplicación sin internet;
17. exportar y respaldar todos los datos del usuario.

El flujo principal debe ser extremadamente rápido:

**Abrir → añadir alimento → indicar cantidad → guardar → actualizar automáticamente calorías y macros.**

---

# PRINCIPIO ARQUITECTÓNICO CENTRAL

Esta aplicación debe ser **100% local-first**.

La aplicación principal NO debe necesitar un servidor para funcionar.

En el MVP:

- no habrá backend obligatorio;
- no habrá base de datos remota;
- no habrá cuentas online;
- no habrá autenticación;
- no habrá sincronización con servidores;
- no habrá almacenamiento de datos personales fuera del dispositivo;
- no habrá APIs privadas necesarias para utilizar la aplicación.

Todos los datos personales del usuario deberán almacenarse exclusivamente en su dispositivo.

Esto incluye:

- perfil;
- edad;
- altura;
- peso;
- objetivos;
- alimentos personalizados;
- comidas;
- historial;
- registros diarios;
- preferencias;
- configuraciones.

La aplicación debe seguir funcionando aunque:

- el usuario pierda conexión;
- servicios externos estén caídos;
- el proyecto oficial deje de existir;
- no exista ningún servidor central.

---

# LOCAL-FIRST VS OFFLINE-FIRST

No quiero simplemente una aplicación web que permita cierto funcionamiento offline.

Quiero una arquitectura **local-first**.

Eso significa:

**El almacenamiento local es la fuente principal de verdad.**

No:

Servidor → cliente.

Sino:

Dispositivo del usuario → aplicación.

Un futuro servidor podrá sincronizar datos, pero nunca deberá convertirse en la autoridad obligatoria para utilizar las funciones principales.

---

# STORAGE

Evalúa qué tecnología utilizar para persistencia local.

Considera principalmente:

- IndexedDB;
- APIs nativas del navegador;
- wrappers extremadamente pequeños solamente si realmente simplifican el desarrollo.

Evalúa opciones como Dexie únicamente si existe una ventaja clara.

Evita depender de LocalStorage para datos estructurados importantes.

Define:

- schema;
- migrations;
- indexes;
- relaciones;
- versionado de base;
- estrategia de backup.

La estructura debe soportar futuras migraciones sin perder información del usuario.

---

# SELF-HOSTING FUTURO

Aunque el MVP será 100% local, quiero que la arquitectura permita añadir posteriormente un modo **self-hosted opcional**.

En el futuro un usuario podría decidir:

**Solo local**

o:

**Local + mi servidor**

El proyecto podría proporcionar posteriormente un servidor open source que cada persona pueda desplegar por su cuenta.

Por ejemplo mediante:

- Docker;
- Docker Compose;
- servidor doméstico;
- NAS;
- VPS;
- Raspberry Pi;
- homelab.

Ese servidor podría permitir posteriormente:

- backup;
- sincronización;
- varios dispositivos;
- restauración;
- almacenamiento personal remoto.

Pero debe ser completamente opcional.

---

# PRINCIPIO DE SELF-HOSTING

La versión futura self-hosted debe seguir este modelo:

PWA
↓
Base local
↓
Sync opcional
↓
Servidor elegido por el usuario

No:

PWA
↓
Servidor obligatorio
↓
Base de datos

La aplicación debe funcionar aunque la parte self-hosted nunca sea instalada.

---

# PREPARACIÓN PARA SINCRONIZACIÓN FUTURA

Aunque no implementaremos sincronización todavía, diseña los modelos de datos para que no bloqueen esa posibilidad.

Por ejemplo, considera utilizar:

- UUIDs locales;
- createdAt;
- updatedAt;
- deletedAt cuando tenga sentido;
- schemaVersion.

Evita depender de IDs incrementales globales si posteriormente dificultan la sincronización entre dispositivos.

NO construyas todavía:

- sync engine;
- cuentas;
- autenticación;
- servidor;
- API remota.

Simplemente evita decisiones arquitectónicas que hagan muy difícil agregarlos después.

---

# PRIVACIDAD

La privacidad es un principio central.

Por defecto:

**ningún dato del usuario debe salir de su dispositivo.**

No incluyas:

- analytics;
- tracking;
- advertising;
- telemetry;
- marketing cookies;
- fingerprinting;
- crash reporting remoto obligatorio.

No envíes:

- peso;
- edad;
- altura;
- comidas;
- historial;
- objetivos;
- estadísticas;

a ningún servidor.

Si posteriormente existe self-hosting, el usuario decidirá explícitamente si quiere sincronizar.

---

# SIN CUENTA

La aplicación no deberá pedir:

- email;
- nombre de usuario;
- contraseña;
- número telefónico.

El onboarding ideal debe ser:

**Instalar → configurar perfil → empezar a registrar alimentos.**

No debe existir una pantalla de login en el MVP.

---

# PROPIEDAD DE LOS DATOS

Los datos pertenecen completamente al usuario.

Debe existir una forma sencilla de:

- exportarlos;
- respaldarlos;
- importarlos;
- eliminarlos.

Formatos iniciales:

### Backup completo

JSON

Debe permitir restaurar:

- perfil;
- historial;
- alimentos personalizados;
- comidas;
- peso;
- configuración.

### Datos tabulares

CSV cuando tenga sentido.

Por ejemplo:

- historial de peso;
- consumo diario;
- alimentos registrados.

---

# BACKUP

Como no habrá servidor central, la aplicación deberá fomentar backups manuales.

Implementa posteriormente una función:

**Exportar backup**

que genere un archivo local.

Y:

**Restaurar backup**

que permita importar nuevamente los datos.

El backup deberá incluir un número de versión de schema para permitir migraciones futuras.

---

# BASE DE DATOS DE ALIMENTOS

La aplicación necesitará datos nutricionales.

Quiero utilizar fuentes abiertas para construir una **base nutricional propia del proyecto**.

Considera:

- Open Food Facts;
- USDA FoodData Central;
- otras fuentes abiertas compatibles.

Antes de utilizarlas verifica:

- licencia;
- redistribución;
- atribución;
- tamaño;
- calidad;
- cobertura internacional;
- estructura.

---

# IMPORTANTE: BASE DE ALIMENTOS ≠ DATOS PERSONALES

Distingue claramente:

### Base nutricional

Información pública sobre alimentos.

### Base personal

Información privada del usuario.

La base personal nunca deberá enviarse a servidores.

---

# ESTRATEGIA PARA LA BASE NUTRICIONAL

No quiero descargar cientos de megabytes dentro de la aplicación.

Diseña una estrategia eficiente.

Por ejemplo:

Repositorio de datos
↓
script de procesamiento
↓
normalización
↓
dataset optimizado
↓
distribución con releases o paquetes descargables
↓
IndexedDB

La PWA debería incluir inicialmente solamente una pequeña colección básica.

Posteriormente el usuario podría ampliar su catálogo de alimentos.

Evalúa estrategias para evitar que el bundle inicial crezca excesivamente.

---

# ALIMENTOS BÁSICOS

La instalación inicial puede incluir alimentos comunes como:

- huevo;
- arroz;
- pollo;
- tortilla;
- leche;
- avena;
- plátano;
- manzana;
- pan;
- pasta;
- papa;
- frijoles;
- yogur;
- carne;
- atún.

Mantén este dataset pequeño.

---

# MODELO CONCEPTUAL DE ALIMENTOS

Ejemplo:

Food

- id
- name
- brand
- servingSize
- servingUnit
- calories
- protein
- carbohydrates
- fat
- fiber
- sugar
- sodium
- source
- sourceId
- createdAt
- updatedAt

No copies esta estructura sin analizarla.

Simplifica si es posible.

---

# ALIMENTOS PERSONALIZADOS

El usuario debe poder crear alimentos propios.

Ejemplo:

Nombre:
Arroz casero

Cantidad base:
100 g

Calorías:
130 kcal

Proteína:
2.7 g

Carbohidratos:
28 g

Grasas:
0.3 g

Estos alimentos deben permanecer exclusivamente en su dispositivo.

---

# COMIDAS REUTILIZABLES

El usuario podrá crear plantillas.

Ejemplo:

**Desayuno habitual**

- 2 huevos
- 50 g de avena
- 250 ml de leche
- 1 plátano

Después podrá registrar la comida completa con una sola acción.

---

# CATEGORÍAS DE COMIDA

Organiza los registros diarios inicialmente como:

- desayuno;
- comida;
- cena;
- snacks.

Permite cambiar estas categorías posteriormente si la arquitectura lo permite fácilmente.

---

# DASHBOARD

La pantalla principal debe mostrar inmediatamente el progreso diario.

Ejemplo:

CALORÍAS

1,650 / 2,200 kcal

PROTEÍNA

110 / 160 g

CARBOHIDRATOS

175 / 250 g

GRASAS

55 / 70 g

Debajo:

Desayuno  
Comida  
Cena  
Snacks

Acción principal:

**+ Añadir alimento**

Evita dashboards excesivamente complejos.

---

# PERFIL

Datos básicos:

- edad;
- altura;
- peso actual;
- peso objetivo;
- objetivo calórico;
- proteína objetivo;
- carbohidratos objetivo;
- grasas objetivo.

Puede existir una función para calcular objetivos sugeridos.

El usuario siempre podrá modificarlos manualmente.

---

# PESO

Debe existir un historial:

Fecha | Peso

Y una gráfica sencilla de evolución.

No implementes inicialmente:

- porcentaje de grasa;
- masa muscular;
- metabolismo avanzado;
- decenas de métricas corporales.

---

# HISTORIAL

Permite navegar por:

- hoy;
- ayer;
- calendario.

Cada fecha conserva:

- alimentos;
- cantidades;
- comidas;
- calorías;
- macros.

Todo almacenado localmente.

---

# PWA

Implementa correctamente:

- Web App Manifest;
- Service Worker;
- instalación;
- iconos;
- offline caching;
- actualizaciones;
- responsive design.

La app instalada debe sentirse cercana a una aplicación móvil nativa.

---

# DISEÑO

Quiero una estética inspirada parcialmente en OpenGym.

Características:

- minimalista;
- funcional;
- moderna;
- limpia;
- pocos colores;
- tipografía clara;
- mucho espacio;
- iconografía sencilla;
- mobile-first.

Evita:

- glassmorphism excesivo;
- gradients innecesarios;
- animaciones pesadas;
- dashboards corporativos;
- elementos puramente decorativos.

Debe sentirse como una herramienta.

---

# MOBILE-FIRST

Diseña principalmente para:

375–430 px.

Después adapta correctamente para:

- tablet;
- desktop.

No diseñes primero desktop.

---

# PRINCIPIOS TÉCNICOS

Prioriza:

1. simplicidad;
2. rendimiento;
3. tamaño;
4. privacidad;
5. mantenibilidad;
6. pocas dependencias;
7. facilidad de contribución;
8. accesibilidad;
9. soporte PWA.

---

# DEPENDENCIAS

Mantén las dependencias al mínimo.

Antes de añadir cualquier paquete evalúa:

1. ¿Qué problema resuelve?
2. ¿Podemos hacerlo razonablemente sin él?
3. ¿Cuánto pesa?
4. ¿Está mantenido?
5. ¿Introduce complejidad?
6. ¿Facilita realmente el proyecto?

Evita instalar librerías grandes para resolver problemas pequeños.

---

# STACK

Analiza máximo tres alternativas.

Puedes evaluar:

- Svelte;
- Preact;
- React;
- Vue;
- Solid;
- TypeScript;
- Vite;
- otras alternativas justificadas.

Evalúa cada combinación considerando:

- bundle;
- velocidad;
- PWA;
- IndexedDB;
- facilidad de aprendizaje;
- ecosistema;
- contribuciones open source;
- mantenibilidad;
- longevidad;
- complejidad.

No elijas automáticamente la alternativa más popular.

---

# OPEN SOURCE

El repositorio debe estar preparado para GitHub desde el inicio.

Un desarrollador nuevo debe poder:

1. clonar;
2. instalar;
3. ejecutar;
4. entender;
5. modificar;
6. probar;
7. enviar PR.

---

# DOCUMENTACIÓN

Incluye progresivamente:

README.md

CONTRIBUTING.md

CODE_OF_CONDUCT.md

LICENSE

SECURITY.md

CHANGELOG.md

Pull Request Template

Issue Templates

Architecture documentation

---

# REPOSITORIO

Propón una estructura simple.

Por ejemplo:

/src
/components
/features
/db
/services
/utils
/types

/data
/scripts
/tests
/docs
/public

No utilices esta estructura automáticamente.

Primero determina qué necesita realmente el proyecto.

---

# CI

GitHub Actions deberá poder comprobar:

- lint;
- types;
- tests;
- build.

Mantén los workflows pequeños y comprensibles.

---

# TESTING

Prioriza pruebas para:

- cálculos nutricionales;
- cantidades;
- conversiones;
- persistencia local;
- migraciones;
- import/export;
- backups;
- transformación de alimentos.

No persigas 100% coverage.

---

# INTERNACIONALIZACIÓN

Inicialmente:

- español;
- inglés.

La arquitectura debe permitir añadir otros idiomas posteriormente.

Evita soluciones excesivamente pesadas.

---

# UNIDADES

Soporta como mínimo:

- gramos;
- kilogramos;
- mililitros;
- litros;
- unidades;
- porciones.

Las conversiones deben estar centralizadas y ser testeables.

---

# MVP

El MVP debe incluir:

1. PWA instalable.
2. Funcionamiento 100% local.
3. Perfil.
4. Objetivos nutricionales.
5. Base pequeña de alimentos.
6. Búsqueda.
7. Alimentos personalizados.
8. Cantidades.
9. Desayuno/comida/cena/snacks.
10. Calorías.
11. Proteína.
12. Carbohidratos.
13. Grasas.
14. Historial.
15. Seguimiento de peso.
16. Offline completo.
17. Backup JSON.
18. Restauración JSON.
19. Exportación CSV.
20. Diseño responsive.
21. Español e inglés.

---

# FUERA DEL MVP

No implementes todavía:

- servidor;
- cuentas;
- login;
- cloud;
- sincronización;
- IA;
- reconocimiento de comida;
- chatbot;
- red social;
- publicidad;
- suscripciones;
- recomendaciones médicas;
- microservicios.

---

# POST-MVP

Posteriormente podemos desarrollar un componente separado:

`server/`

o incluso un repositorio independiente.

Su función será proporcionar self-hosting opcional.

Posibles funcionalidades:

- sincronización;
- backup remoto;
- dispositivos múltiples;
- restauración;
- API personal.

Preferiblemente desplegable mediante:

docker compose up -d

Pero NO construyas esto todavía.

---

# ARQUITECTURA FUTURA DE SELF-HOSTING

Piensa desde ahora en una posible separación:

### Client

PWA completamente autónoma.

### Sync protocol

Interfaz o contrato de sincronización.

### Server

Implementación open source opcional.

Esto permitiría que en el futuro incluso puedan existir distintas implementaciones de servidor compatibles.

No acoples la PWA a una implementación específica.

---

# API ABSTRACTA FUTURA

Si resulta útil, diseña internamente interfaces que permitan posteriormente sustituir:

LocalStorageAdapter / IndexedDBRepository

por algo como:

SyncProvider

sin alterar la lógica principal.

Pero no construyas abstracciones innecesarias todavía.

Solo introduce puntos de extensión cuando tengan una utilidad clara.

---

# REGLA FUNDAMENTAL

Una persona debe poder utilizar durante años la aplicación sin configurar absolutamente ningún servidor.

El self-hosting es una mejora.

Nunca un requisito.

---

# METODOLOGÍA

Trabaja por fases.

## Fase 1 — Product Definition

Analiza:

- requisitos;
- alcance;
- contradicciones;
- MVP.

No escribas código todavía.

## Fase 2 — Technical Design

Define:

- stack;
- arquitectura;
- modelo de datos;
- IndexedDB;
- PWA;
- estructura;
- estrategia local-first;
- estrategia de base nutricional.

## Fase 3 — UX

Diseña:

- navegación;
- pantallas;
- flujos;
- componentes;
- empty states;
- errores.

## Fase 4 — Repository

Construye el repositorio inicial.

Instala solo las dependencias necesarias.

## Fase 5 — MVP

Implementa funcionalidad por funcionalidad.

No pases a la siguiente feature si la anterior queda incompleta o rompe tests/build.

---

# FORMA DE TRABAJAR

Para cada feature:

1. explica brevemente qué vas a construir;
2. identifica archivos afectados;
3. implementa;
4. ejecuta tests;
5. comprueba types;
6. comprueba build;
7. corrige errores;
8. resume el resultado.

No generes código placeholder cuando sea posible implementar la funcionalidad real.

---

# DEFINITION OF DONE

El MVP estará listo cuando una persona pueda:

1. instalar la PWA;
2. utilizarla sin cuenta;
3. configurar su perfil;
4. establecer objetivos;
5. buscar alimentos;
6. registrar alimentos;
7. crear alimentos;
8. crear comidas reutilizables;
9. consultar macros;
10. navegar por días;
11. registrar peso;
12. desconectar completamente internet;
13. continuar utilizando la aplicación;
14. cerrar y abrir la aplicación sin perder datos;
15. exportar todos sus datos;
16. eliminarlos;
17. restaurarlos desde backup.

Además, un desarrollador debe poder:

1. clonar el repositorio;
2. instalarlo;
3. ejecutarlo;
4. entender la arquitectura;
5. modificar una función;
6. ejecutar tests;
7. construir producción;
8. enviar un Pull Request.

---

# PRIMERA TAREA

Empieza realizando únicamente el diseño técnico y del producto.

Entrégame:

1. análisis general;
2. definición final del MVP;
3. comparación de máximo tres stacks;
4. stack recomendado;
5. arquitectura local-first;
6. elección y estructura de IndexedDB;
7. modelo inicial de datos;
8. estrategia de IDs pensando en sync futuro;
9. estrategia de backup y restauración;
10. estrategia de base nutricional;
11. estrategia para mantener pequeño el bundle;
12. estructura del repositorio;
13. mapa de pantallas;
14. flujo de navegación;
15. roadmap por milestones;
16. riesgos técnicos;
17. riesgos de licencias de datasets;
18. decisiones que podrían dificultar el self-hosting futuro;
19. funcionalidades que eliminarías para mantener la aplicación ligera.

Después de completar esta etapa, comienza la construcción real del proyecto.

No sobreingenierices.

La prioridad es:

**local-first + simple + rápido + privado + open source + self-hostable en el futuro.**