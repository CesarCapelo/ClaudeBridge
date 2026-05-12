/* ════════════════════════════════════════════════════════════════════════
   ClaudeBridge — frontend
   ════════════════════════════════════════════════════════════════════════ */
'use strict';

(function() {

  /* ════════════════════════════════════════════════════════════════════
     BOOT SCREEN
     - Barra de carga 3.5s.
     - Al terminar la barra: el hint pulsa invitando a interactuar.
     - Sin auto-cierre: queda esperando hasta clic o tecla.
     ════════════════════════════════════════════════════════════════════ */
  (function bootScreen() {
    const boot = document.getElementById('boot-screen');
    if (!boot) return;
    let dismissed = false;
    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      boot.classList.add('fading');
      setTimeout(() => { if (boot.parentNode) boot.parentNode.removeChild(boot); }, 750);
      document.removeEventListener('click',   dismiss);
      document.removeEventListener('keydown', dismiss);
    }
    /* Al completar la barra (3.5s), cambia el hint a "ready" */
    setTimeout(() => {
      if (dismissed) return;
      const hint = boot.querySelector('.boot-hint');
      const fill = boot.querySelector('.boot-progress-fill');
      if (fill) fill.classList.add('done');
      if (hint) {
        hint.textContent = 'Pulsa cualquier tecla o haz clic para entrar';
        hint.classList.add('ready');
      }
    }, 3500);
    /* Cierre solo manual */
    document.addEventListener('click',   dismiss);
    document.addEventListener('keydown', dismiss);
  })();

  const $ = (sel, root = document) => root.querySelector(sel);

  /* ── Refs DOM ─────────────────────────────────────────────────────── */
  const clockEl       = $('#clock');
  const desktopEl     = $('#desktop');
  const dockEl        = $('#dock');
  const dropZone      = $('#drop-zone');
  const snapPreview   = $('#snap-preview');
  const btnNew        = $('#btn-new-terminal');
  const btnSwarm      = $('#btn-swarm');
  const btnPrompts    = $('#btn-prompts');     /* puede ser null: ahora va por menú */
  const btnBroadcast  = $('#btn-broadcast');
  const btnTheme      = $('#btn-theme');
  const themeIcon     = $('#theme-icon');
  const broadcastInd  = $('#broadcast-indicator');
  const modal         = $('#modal-overlay');
  const modalTitle    = $('#modal-title');
  const modalSub      = $('#modal-subtitle');
  const modalPath     = $('#modal-path');
  const btnPickFolder = $('#btn-pick-folder');
  const btnSaveBm     = $('#btn-save-bookmark');
  const bookmarksEl   = $('#bookmarks-chips');
  const btnCancel     = $('#modal-cancel');
  const btnOk         = $('#modal-ok');
  const toastBox      = $('#toast-container');
  const helpOverlay   = $('#help-overlay');
  const btnHelpClose  = $('#help-close');
  const promptsOverlay= $('#prompts-overlay');
  const promptsGrid   = $('#prompts-grid');
  const btnPromptsClose = $('#prompts-close');
  const ctxMenu       = $('#ctx-menu');
  /* Workspace profiles */
  const btnProfiles      = $('#btn-profiles');   /* puede ser null: ahora va por menú */
  const profilesOverlay  = $('#profiles-overlay');
  const profilesClose    = $('#profiles-close');
  const profilesList     = $('#profiles-list');
  const profileNameInput = $('#profile-name-input');
  const btnProfileSave   = $('#btn-profile-save');
  const profilesCurCount = $('#profiles-current-count');

  /* ── Estado ───────────────────────────────────────────────────────── */
  const terminals = new Map();
  let topZ          = 100;
  let focusedId     = null;
  let dragging      = null;
  let resizing      = null;
  let swarmMode     = false;
  let broadcastMode = false;
  let nextNum       = 1;
  let snapTarget    = null;
  let ctxTermId     = null;
  let terminalMeta  = {};  // { [id]: { label, color } }

  const FIXED_CMD = 'claude';
  const HOME      = document.body.dataset.home || '';

  /* localStorage keys */
  const LS = {
    bookmarks: 'cb_bookmarks',
    positions: 'cb_positions',
    theme:     'cb_theme',
    meta:      'cb_terminal_meta',
  };

  /* ════════════════════════════════════════════════════════════════════
     PROMPTS PROFESIONALES (label corto → prompt grande)
     ════════════════════════════════════════════════════════════════════ */
  const PROMPTS = [
    {
      icon: '♻️', title: 'Refactoriza esto',
      desc: 'Auditoría completa de refactoring con plan priorizado por impacto/riesgo.',
      prompt: `Realiza una auditoría de refactorización completa del código en esta carpeta.

1. ANÁLISIS PREVIO
- Mapea la arquitectura: módulos principales, dependencias, capas (UI, lógica, datos, infra).
- Identifica los archivos con mayor complejidad ciclomática y los acoplamientos más fuertes.
- Detecta code smells: funciones >50 líneas, clases con múltiples responsabilidades, condicionales anidados de >3 niveles, duplicación (DRY), nombres no descriptivos, parámetros booleanos delatores, dependencias hard-coded, magic numbers, mutación de estado compartido.

2. PROPUESTA DE REFACTORING
Para cada problema:
- Refactorización concreta (patrón aplicable: Strategy, Factory, Adapter, etc. — sin sobreingeniería).
- Impacto: alto / medio / bajo.
- Riesgo de regresión: alto / medio / bajo.
- Esfuerzo: S / M / L.
- Justificación: por qué mejora mantenibilidad, testeabilidad o legibilidad.

3. PLAN DE EJECUCIÓN
Ordena por ratio impacto/riesgo. Para cada paso indica:
- Tests que deberían existir antes de tocar.
- Cómo verificar que no hay regresión.
- Si conviene commits separados.

4. NO REFACTORICES NADA TODAVÍA. Espera mi aprobación del plan. Si hay ambigüedades sobre la intención del código, pregúntame antes de asumir.

Sé conciso pero completo. Asume nivel senior, no expliques conceptos básicos.`
    },
    {
      icon: '🛡️', title: 'Audita seguridad',
      desc: 'Análisis OWASP Top 10 + secretos + dependencias vulnerables. Genera SECURITY_AUDIT.md.',
      prompt: `Realiza una auditoría de seguridad completa de este proyecto siguiendo OWASP Top 10 y best practices del stack detectado.

1. INVENTARIO
- Entry points externos: endpoints HTTP, webhooks, file uploads, deserialización, comandos shell, queries SQL, etc.
- Datos sensibles: credenciales, tokens, PII, secretos de API.
- Dependencias y versiones (package.json, requirements.txt, pom.xml, etc.) — flagea las que tengan CVEs conocidos.

2. ANÁLISIS POR CATEGORÍA
Para cada hallazgo: archivo:línea, severidad (Critical/High/Medium/Low), explicación, fix sugerido:
a) Inyección (SQL, NoSQL, command, LDAP, XPath, template)
b) Autenticación y sesiones (cookies seguras, tokens, expiración, rotación, MFA)
c) Exposición de datos (logs, errores con stacktrace, HTTPS forzado, encriptación at-rest)
d) XXE, SSRF, deserialización insegura
e) Broken Access Control (autorización a nivel de objeto/función)
f) Misconfiguración (headers HTTP, CORS, CSP, defaults inseguros)
g) XSS (reflejado, almacenado, DOM-based)
h) Manejo de archivos (path traversal, MIME type, validación de upload)
i) Logging insuficiente (¿detectaríamos abuso?, ¿logueamos secretos?)
j) Dependencias vulnerables

3. SECRETOS
Busca patrones de claves API, tokens, contraseñas, certificados en el código y en el git history. Para cada hallazgo: acción correctiva (rotar la clave + remover del repo, idealmente con git-filter-repo o BFG).

4. INFORME
Genera SECURITY_AUDIT.md con:
- Resumen ejecutivo (conteo por severidad).
- Hallazgos ordenados Critical → Low.
- Para cada uno: contexto, impacto, exploit teórico, fix.

5. NO MODIFIQUES CÓDIGO. Solo audita y reporta. Espera mi aprobación antes de aplicar fixes.`
    },
    {
      icon: '🧪', title: 'Escribe tests',
      desc: 'Suite de tests profesional con pirámide, mocking correcto, CI y coverage.',
      prompt: `Configura una suite de tests profesional para este proyecto.

1. EVALUACIÓN
- Detecta el framework de testing en uso (pytest, jest, vitest, mocha, junit, etc.) o propón uno si no hay.
- Mide coverage actual si hay tests existentes.
- Identifica módulos/funciones SIN tests.

2. ESTRATEGIA — pirámide de tests
- Unit (la mayoría): funciones puras, lógica de negocio.
- Integración: interacciones entre módulos, DB, llamadas externas mockeadas en el límite.
- E2E (5-10 máximo): flujos críticos de usuario.
Justifica el % aproximado de cada tipo según el dominio.

3. PRIORIDADES
Lista los 10 módulos/funciones más críticos a testear primero, justificando por:
- Frecuencia de uso
- Complejidad ciclomática
- Impacto si falla
- Cobertura actual

4. ESCRIBE LOS TESTS
Para cada uno:
- Happy path
- Edge cases (límites, vacíos, máximos, nulls, strings con unicode/whitespace)
- Error cases (excepciones esperadas + sus mensajes)
- Mocking: fakes para dependencias EXTERNAS, no mocks de objetos internos (anti-pattern). Usa el principio "don't mock what you don't own".
- Naming: \`test_<funcion>_<condición>_<resultado>\`
- AAA pattern (Arrange / Act / Assert) con líneas en blanco para separar.
- Tests deterministas (sin time.sleep, sin dependencia del orden).

5. INFRAESTRUCTURA
- CI mínimo (GitHub Actions / GitLab CI) corriendo los tests en cada push.
- Coverage reporting con threshold mínimo: 80% global, 90% para módulos críticos.
- Documenta cómo correr los tests en el README.

Sin sobreingeniería: no añadas frameworks de mocking complejos si plain mocks bastan.`
    },
    {
      icon: '🐛', title: 'Encuentra bugs',
      desc: 'Búsqueda sistemática de bugs por categorías + race conditions + edge cases.',
      prompt: `Busca bugs sistemáticamente en este proyecto. NO arregles nada, solo reporta.

CATEGORÍAS A REVISAR:

1. NULL / UNDEFINED / EMPTY
- Accesos a propiedades de variables que pueden ser null/undefined.
- Iteración sobre colecciones que pueden estar vacías sin guard.
- Strings que pueden ser "" tratadas como falsy en contextos donde 0 también lo es.

2. OFF-BY-ONE
- Loops con \`<= length\` en vez de \`< length\`.
- Índices array[length] en vez de array[length-1].
- Cálculos de rangos / paginación.

3. CONCURRENCIA / RACE CONDITIONS
- Acceso a estado compartido sin sincronización.
- Promesas/futures sin await/then.
- Callbacks que asumen orden.
- Modificación de colección mientras se itera.

4. RECURSOS NO CERRADOS
- Files, sockets, DB connections sin try/finally o context manager / using.
- Listeners que nunca se quitan (memory leaks).
- Timers/intervals huérfanos.

5. EDGE CASES NUMÉRICOS
- División por cero.
- Overflow en arithmetic.
- Comparación de floats con ==.
- Unicode / encoding.

6. ERRORES DE LÓGICA
- Condiciones invertidas o redundantes.
- Returns dentro de loops que terminan antes de tiempo.
- Manejo de excepciones que se traga errores (\`except: pass\`).
- Mutación accidental de parámetros.

7. SEGURIDAD ADYACENTE A BUGS
- TOCTOU (time of check / time of use).
- Validación cliente sin validación servidor.
- Mezcla de datos confiables y no confiables.

FORMATO DE REPORTE
Para cada bug:
- Archivo:línea
- Categoría
- Severidad (Critical / High / Medium / Low)
- Reproducción (input que lo dispara o flujo)
- Fix propuesto (no aplicar todavía)

Al final: un resumen con los 5 bugs más graves para tratar primero.`
    },
    {
      icon: '⚡', title: 'Optimiza performance',
      desc: 'Profiling + identificación de hotspots + optimizaciones priorizadas por impacto.',
      prompt: `Análisis de performance del proyecto. Sigue estrictamente: medir antes de optimizar.

1. INSTRUMENTACIÓN
- Identifica el flujo crítico de usuario o la operación más cara.
- Propón cómo medirlo (profiler, benchmark, APM, métricas). Si aplica, dame el código del benchmark.

2. ANÁLISIS ESTÁTICO DE HOTSPOTS
Sin profile aún, identifica candidatos por inspección:
- Loops anidados O(n²) o peor sobre datos grandes.
- Llamadas a I/O dentro de loops (DB queries, HTTP, file).
- Falta de caching donde claramente aplicaría (memoization, HTTP cache, query cache).
- N+1 queries en ORMs.
- Operaciones síncronas que podrían ser concurrentes.
- Estructuras de datos subóptimas (list cuando deberías usar set para lookups, etc.).
- Recreación innecesaria de objetos en hot paths.

3. PROPUESTAS
Para cada optimización:
- Mejora teórica de complejidad (de O(X) a O(Y)).
- Impacto esperado en latencia / throughput / memoria.
- Riesgo (¿cambia la API? ¿afecta legibilidad?).
- Esfuerzo (S/M/L).

4. PRIORIZACIÓN
Pareto: cuáles son las 3 optimizaciones que probablemente capturen el 80% de la ganancia. Justifica.

5. NO OPTIMICES NADA. Espera mi aprobación. Si una "optimización" cambia el comportamiento (ej. caching que puede dar stale data), exponlo claramente.

Reglas: nada de micro-optimizaciones que sacrifiquen legibilidad sin evidencia medible. No prematura optimization.`
    },
    {
      icon: '📚', title: 'Documenta el proyecto',
      desc: 'README + arquitectura + API + contribución + diagramas. Nivel pro.',
      prompt: `Documenta este proyecto a nivel profesional para que cualquier dev senior pueda llegar y entenderlo en <30min.

1. README.md
Estructura:
- Título + 1 línea que explica qué hace y para quién.
- Badges (build, coverage, license, versión) si aplican.
- Screenshot o GIF de la UI principal (si es app visual). Marca dónde va con TODO si no puedes generarlo.
- Tabla de características clave (qué y para qué).
- Instalación: requisitos + comandos exactos.
- Uso básico: ejemplo runnable.
- Configuración: variables de entorno, archivos de config.
- Arquitectura: diagrama ASCII o referencia a docs/architecture.md.
- API si la expone.
- Contribución: cómo correr tests, estilo de código, proceso de PR.
- Troubleshooting: errores comunes y solución.
- Licencia.

2. docs/architecture.md
- Diagrama de componentes (ASCII art o mermaid).
- Flujo de la petición/dato más importante.
- Decisiones de diseño (por qué X y no Y) — ADRs ligeras.
- Modelo de datos (schema, entidades).
- Puntos de extensión.

3. DOCSTRINGS / JSDOC
Añade docstrings/jsdoc a las funciones públicas y clases principales. Formato:
- Una línea resumen.
- Parámetros con tipo + descripción.
- Return value.
- Side effects / excepciones que lanza.
- Ejemplo si no es obvio.
Para internas: solo si el "por qué" no es obvio del nombre.

4. COMMENTS EN CÓDIGO
Solo donde el "por qué" no sea obvio: workaround para bug X, restricción del framework, decisión contraintuitiva.
QUITA comentarios que repiten lo que dice el código (\`i++; // incrementa i\`).

5. CHANGELOG.md
Si hay git history significativo, genera un CHANGELOG inicial siguiendo Keep a Changelog.

Sé conciso. No infles documentación; lo no documentado debe ser autodescriptivo por el nombre.`
    },
    {
      icon: '🎓', title: 'Explica el código',
      desc: 'Onboarding senior: arquitectura → flujo principal → puntos críticos → cómo extender.',
      prompt: `Explícame este proyecto como si fuera un senior nuevo en el equipo. Asume que sé programar bien pero no conozco este repo.

ESTRUCTURA DE LA EXPLICACIÓN:

1. EL QUÉ Y EL POR QUÉ (2-3 párrafos)
- Qué problema resuelve este proyecto.
- Qué decisiones técnicas clave lo diferencian de soluciones alternativas.
- Stack y por qué de las elecciones principales.

2. ORIENTACIÓN POR EL REPO (mapa)
- Carpetas/archivos principales y qué hace cada uno.
- Punto de entrada de la app.
- Dónde vive la "lógica de negocio" vs infraestructura.
- Convenciones (nombres, layout, patrones recurrentes).

3. FLUJO PRINCIPAL (paso a paso con números)
Toma el flujo más importante (ej. una petición típica) y trázalo desde la entrada hasta la respuesta. Indica archivo:función en cada paso. Si hay efectos colaterales (DB, cola, evento), señálalos.

4. PUNTOS CRÍTICOS / GOTCHAS
- Partes del código que parecen extrañas pero existen por una razón (workaround, performance, restricción).
- Invariantes que el código asume y rompería si cambias.
- Funciones que parecen seguras pero NO lo son (concurrencia, side effects).

5. CÓMO HACER CAMBIOS COMUNES
- Añadir un endpoint nuevo → tocar A, B, C.
- Añadir un campo al modelo → tocar D, E, F (incluyendo migración y validación).
- Cambiar el comportamiento de X → toca aquí, ojo con Y.

6. QUE NO HARÍA YO SI FUERA TÚ
Bullets con anti-patrones específicos a este repo: cosas que parecen tentadoras pero te van a explotar.

Conciso, alto nivel, sin condescendencia. Asume vocabulario técnico estándar.`
    },
    {
      icon: '👀', title: 'Code review',
      desc: 'Review como senior. Comentarios línea-por-línea con severidad y rationale.',
      prompt: `Haz un code review como senior engineer sobre los cambios pendientes (\`git diff\`) o sobre los archivos modificados recientemente. Si no hay cambios pendientes, revisa el módulo principal.

NIVELES DE COMENTARIO (etiqueta cada comentario):
- 🚫 **Blocker** — Tiene que cambiar antes de mergear. (Bug, vuln, lógica rota, breaking change no documentado).
- ⚠️ **Issue** — Debería cambiar antes de mergear. (Mal diseño, dette técnica significativa).
- 💡 **Suggestion** — Mejora opcional. (Nombres, estructura, alternativa más limpia).
- 📚 **Nit/Question** — Aclaración, taste, formato. Bajísima prioridad.

QUE BUSCAR (en orden de importancia):
1. Correctness — ¿hace lo que dice hacer? edge cases, errores, off-by-one, race conditions.
2. Seguridad — input no validado, secrets, perms, inyección.
3. Test coverage — ¿los cambios añaden o tocan tests adecuadamente?
4. Diseño — ¿respeta los principios del codebase? ¿introduce abstracciones prematuras? ¿rompe SRP?
5. Performance obvia — solo si hay un O(n²) en hot path o I/O en loop, no nit-picks de microsegundos.
6. Legibilidad — naming, complejidad, nesting.
7. Documentación — la pública debe estar documentada; cambios de API en CHANGELOG.

FORMATO DE SALIDA:
Por cada comentario:
\`\`\`
[NIVEL] archivo.ext:NN
> snippet de código de 1-3 líneas
Comentario explicando el problema y, si aplica, sugiriendo el fix.
\`\`\`

Al final:
- ✅ Summary: qué está bien.
- 🛑 Blockers (lista numerada).
- 📋 Veredicto: APPROVE / REQUEST_CHANGES / COMMENT, con justificación de 1 línea.

Sé directo, sin pasivos-agresivos. Justifica las opiniones fuertes ("personalmente prefiero X" no vale; di "X es mejor aquí porque Y").`
    }
  ];

  /* ── Helpers ──────────────────────────────────────────────────────── */
  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, c =>
      ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }
  function basename(p) {
    if (!p) return 'Terminal';
    return p.replace(/\\/g, '/').replace(/\/+$/, '').split('/').pop() || p;
  }

  function toast(msg, type) {
    type = type || 'info';
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    toastBox.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.3s';
      setTimeout(() => el.remove(), 320);
    }, 3800);
  }

  /* ── Clock ────────────────────────────────────────────────────────── */
  function tickClock() {
    if (!clockEl) return;
    const d = new Date();
    const days   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const hh = String(d.getHours()).padStart(2,'0');
    const mm = String(d.getMinutes()).padStart(2,'0');
    const ss = String(d.getSeconds()).padStart(2,'0');
    clockEl.textContent = days[d.getDay()] + ' ' + d.getDate() + ' ' + months[d.getMonth()] +
                          '  ' + hh + ':' + mm + ':' + ss;
  }
  tickClock(); setInterval(tickClock, 1000);

  /* ════════════════════════════════════════════════════════════════════
     THEMES
     ════════════════════════════════════════════════════════════════════ */
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    themeIcon.textContent = theme === 'light' ? '☀️' : '🌙';
    localStorage.setItem(LS.theme, theme);
  }
  function toggleTheme() {
    const cur = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    applyTheme(cur);
  }
  btnTheme.addEventListener('click', toggleTheme);
  applyTheme(localStorage.getItem(LS.theme) || 'dark');

  /* ════════════════════════════════════════════════════════════════════
     BOOKMARKS
     ════════════════════════════════════════════════════════════════════ */
  function getBookmarks() {
    try { return JSON.parse(localStorage.getItem(LS.bookmarks) || '[]'); }
    catch { return []; }
  }
  function saveBookmarks(list) { localStorage.setItem(LS.bookmarks, JSON.stringify(list)); }
  function addBookmark(path) {
    if (!path) return;
    const list = getBookmarks().filter(p => p !== path);
    list.unshift(path);
    saveBookmarks(list.slice(0, 30));
    renderBookmarks();
    toast('Carpeta añadida a favoritos', 'success');
  }
  function removeBookmark(path) {
    saveBookmarks(getBookmarks().filter(p => p !== path));
    renderBookmarks();
  }
  function renderBookmarks() {
    bookmarksEl.innerHTML = '';
    const list = getBookmarks();
    if (!list.length) {
      bookmarksEl.innerHTML = '<span class="bookmarks-empty">Sin favoritos. Usa ⭐ para guardar.</span>';
      return;
    }
    list.forEach(path => {
      const chip = document.createElement('div');
      chip.className = 'bookmark-chip';
      chip.title = path;
      chip.innerHTML =
        '<span class="bookmark-chip-text">' + esc(basename(path)) + '</span>' +
        '<button class="bookmark-chip-remove" title="Quitar">×</button>';
      chip.addEventListener('click', e => {
        if (e.target.classList.contains('bookmark-chip-remove')) removeBookmark(path);
        else                                                     modalPath.value = path;
      });
      bookmarksEl.appendChild(chip);
    });
  }
  btnSaveBm.addEventListener('click', () => {
    const p = modalPath.value.trim();
    if (!p) { toast('Escribe una ruta primero', 'error'); return; }
    addBookmark(p);
  });

  /* ════════════════════════════════════════════════════════════════════
     FOLDER PICKER (tkinter en backend)
     ════════════════════════════════════════════════════════════════════ */
  btnPickFolder.addEventListener('click', async () => {
    btnPickFolder.disabled = true;
    try {
      const r = await fetch('/api/pick-folder');
      const d = await r.json();
      if (d.path) modalPath.value = d.path;
    } catch (e) {
      toast('Error: ' + e.message, 'error');
    } finally {
      btnPickFolder.disabled = false;
      modalPath.focus();
    }
  });

  /* ════════════════════════════════════════════════════════════════════
     MODAL principal
     ════════════════════════════════════════════════════════════════════ */
  function openModal(isSwarm) {
    swarmMode = !!isSwarm;
    modalTitle.textContent = swarmMode ? '⚡ Modo Swarm' : '+ Nueva Terminal';
    modalSub.textContent   = swarmMode
      ? 'Lanza 8 terminales en grilla 4×2 con Claude.'
      : 'Abre una terminal con Claude en la carpeta indicada.';
    modalSub.classList.toggle('swarm', swarmMode);
    btnOk.textContent = swarmMode ? 'Lanzar 8 Terminales' : 'Abrir Terminal';
    btnOk.classList.toggle('swarm', swarmMode);
    renderBookmarks();
    modal.classList.remove('hidden');
    setTimeout(() => { modalPath.focus(); modalPath.select(); }, 60);
  }
  function closeModal() { modal.classList.add('hidden'); }
  btnNew  .addEventListener('click', () => openModal(false));
  btnSwarm.addEventListener('click', () => openModal(true));
  btnCancel.addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  modalPath.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); submitModal(); }
  });
  btnOk.addEventListener('click', submitModal);

  function submitModal() {
    const cwd = modalPath.value.trim();
    if (!cwd) { toast('Especifica una carpeta de trabajo', 'error'); return; }
    closeModal();
    if (swarmMode) spawnSwarm(cwd, FIXED_CMD);
    else           createTerminal(cwd, FIXED_CMD);
  }

  /* ════════════════════════════════════════════════════════════════════
     CREAR TERMINAL
     ════════════════════════════════════════════════════════════════════ */
  function createTerminal(cwd, cmd, position) {
    return fetch('/api/terminal/new', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cwd, cmd }),
    })
    .then(res => res.json().then(d => {
      if (!res.ok) throw new Error(d.error || ('HTTP ' + res.status));
      return d;
    }))
    .then(info => openTerminalWindow(info, position))
    .catch(err => {
      console.error('[ClaudeBridge]', err);
      toast('No se pudo abrir: ' + err.message, 'error');
    });
  }

  function spawnSwarm(cwd, cmd) {
    const cols = 4, rows = 2;
    const menubarH = 30, dockReserve = 95, gap = 4;
    const W = window.innerWidth;
    const H = window.innerHeight - menubarH - dockReserve;
    const tw = Math.floor((W - gap * (cols + 1)) / cols);
    const th = Math.floor((H - gap * (rows + 1)) / rows);
    toast('Lanzando 8 terminales en grilla 4×2…', 'info');
    for (let i = 0; i < 8; i++) {
      const col = i % cols, row = Math.floor(i / cols);
      const pos = {
        left:   gap + col * (tw + gap),
        top:    menubarH + gap + row * (th + gap),
        width:  tw, height: th,
      };
      setTimeout(() => createTerminal(cwd, cmd, pos), i * 85);
    }
  }

  /* ── Window builder ────────────────────────────────────────────── */
  function buildWindow(info, position) {
    const win = document.createElement('div');
    win.className = 'window';
    win.dataset.termId = info.id;

    if (position) {
      win.style.left   = position.left   + 'px';
      win.style.top    = position.top    + 'px';
      win.style.width  = position.width  + 'px';
      win.style.height = position.height + 'px';
    } else {
      const offset = (terminals.size % 6) * 26;
      win.style.left   = (90 + offset) + 'px';
      win.style.top    = (60 + offset) + 'px';
      win.style.width  = '820px';
      win.style.height = '500px';
    }
    win.style.zIndex = ++topZ;

    const num  = nextNum++;
    const name = basename(info.cwd);

    win.innerHTML =
      '<div class="window-titlebar">' +
        '<div class="traffic-lights">' +
          '<div class="tl close"    data-act="close"></div>' +
          '<div class="tl minimize" data-act="minimize"></div>' +
          '<div class="tl maximize" data-act="maximize"></div>' +
        '</div>' +
        '<div class="window-title">' +
          '<div class="window-title-top">' +
            '<span class="window-title-name">' + esc(name) + '</span>' +
            '<span class="git-branch-badge hidden"></span>' +
          '</div>' +
          '<span class="window-title-path">' + esc(info.cwd) + '</span>' +
        '</div>' +
        '<div class="window-num-badge">#' + num + '</div>' +
      '</div>' +
      '<div class="window-body">' +
        '<div class="term-host"></div>' +
        '<div class="resize-handle"></div>' +
      '</div>';

    desktopEl.appendChild(win);
    return { win, num };
  }

  function openTerminalWindow(info, position) {
    if (typeof Terminal === 'undefined') {
      toast('xterm.js no se cargó', 'error');
      return;
    }
    if (terminals.has(info.id)) return;

    const { win, num } = buildWindow(info, position);

    const term = new Terminal({
      fontFamily: '"SF Mono","Cascadia Code","Consolas","Courier New",monospace',
      fontSize: 13, lineHeight: 1.3,
      cursorBlink: true, cursorStyle: 'block',
      convertEol: true, scrollback: 12000,
      allowProposedApi: true,
      allowTransparency: true,         /* deja que el body cristal asome */
      theme: {
        background: 'rgba(0, 0, 0, 0)',  /* totalmente transparente */
        foreground: '#ececec',
        cursor: '#e08b6e', cursorAccent: '#0d0d0d',
        selectionBackground: 'rgba(204,120,92,0.35)',
      },
    });

    const fit = new FitAddon.FitAddon();
    term.loadAddon(fit);
    try { term.loadAddon(new WebLinksAddon.WebLinksAddon()); } catch(e) {}

    term.open(win.querySelector('.term-host'));
    setTimeout(() => { try { fit.fit(); } catch(e){} }, 60);

    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws    = new WebSocket(`${proto}://${location.host}/ws/${info.id}`);

    ws.onopen = () => {
      try { ws.send(JSON.stringify({ type:'resize', rows:term.rows, cols:term.cols })); } catch(e) {}
    };
    ws.onmessage = ev => {
      try {
        const m = JSON.parse(ev.data);
        if      (m.type === 'data')  term.write(m.data);
        else if (m.type === 'exit')  term.write('\r\n\x1b[90m[Sesión finalizada]\x1b[0m\r\n');
        else if (m.type === 'error') term.write(`\r\n\x1b[91m[Error] ${m.msg}\x1b[0m\r\n`);
      } catch(e){}
    };
    ws.onclose = () => term.write('\r\n\x1b[90m[Conexión cerrada]\x1b[0m\r\n');
    ws.onerror = () => toast('WebSocket error', 'error');

    term.onData(data => {
      if (broadcastMode) {
        terminals.forEach(t => {
          if (t.ws.readyState === WebSocket.OPEN)
            t.ws.send(JSON.stringify({ type:'input', data }));
        });
      } else if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type:'input', data }));
      }
    });

    const ro = new ResizeObserver(() => {
      try { fit.fit(); } catch(e){}
      if (ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify({ type:'resize', rows:term.rows, cols:term.cols }));
      savePositions();
    });
    ro.observe(win.querySelector('.window-body'));

    terminals.set(info.id, {
      winEl: win, term, fit, ws, ro, info,
      minimized: false, savedSize: null, num,
    });

    /* aplicar metadata guardada (label, color) si existe */
    applyMeta(info.id);

    wireWindow(win, info.id);
    bringToFront(info.id);
    updateBroadcastButton();
    renderDock();
    savePositions();
    fetchGitBranch(info.id);

    setTimeout(() => { try { fit.fit(); term.focus(); } catch(e){} }, 200);
  }

  /* ── Git branch poller ─────────────────────────────────────────── */
  async function fetchGitBranch(id) {
    const t = terminals.get(id);
    if (!t) return;
    try {
      const r = await fetch('/api/git-branch?path=' + encodeURIComponent(t.info.cwd));
      const d = await r.json();
      const badge = t.winEl.querySelector('.git-branch-badge');
      if (d.branch) {
        badge.textContent = d.branch;
        badge.title = 'Rama git actual';
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    } catch(e) {}
  }
  setInterval(() => terminals.forEach((_, id) => fetchGitBranch(id)), 20000);

  /* ── Window controls ───────────────────────────────────────────── */
  function wireWindow(win, id) {
    const titlebar = win.querySelector('.window-titlebar');
    const handle   = win.querySelector('.resize-handle');

    titlebar.addEventListener('mousedown', e => {
      if (e.target.closest('.tl')) return;
      bringToFront(id);
      const r = win.getBoundingClientRect();
      dragging = { win, sx:e.clientX, sy:e.clientY, l:r.left, t:r.top, id };
      e.preventDefault();
    });

    /* Right-click → context menu */
    titlebar.addEventListener('contextmenu', e => {
      e.preventDefault();
      openCtxMenu(id, e.clientX, e.clientY);
    });

    handle.addEventListener('mousedown', e => {
      bringToFront(id);
      const r = win.getBoundingClientRect();
      resizing = { id, win, sx:e.clientX, sy:e.clientY, w:r.width, h:r.height };
      e.preventDefault();
    });

    win.addEventListener('mousedown', () => bringToFront(id));

    win.querySelectorAll('.tl').forEach(tl => {
      tl.addEventListener('click', e => {
        e.stopPropagation();
        const act = tl.dataset.act;
        if      (act === 'close')    closeTerminal(id);
        else if (act === 'minimize') minimizeWindow(id);
        else if (act === 'maximize') toggleMaximize(id);
      });
    });
  }

  function bringToFront(id) {
    const t = terminals.get(id);
    if (!t || t.minimized) return;
    focusedId = id;
    terminals.forEach((tt, tid) => tt.winEl.classList.toggle('focused', tid === id));
    t.winEl.style.zIndex = ++topZ;
    try { t.term.focus(); } catch(e){}
    renderDock();
  }

  function minimizeWindow(id) {
    const t = terminals.get(id);
    if (!t) return;
    const w = t.winEl;
    w.classList.add('minimizing');
    setTimeout(() => { w.style.display = 'none'; w.classList.remove('minimizing'); }, 280);
    t.minimized = true;
    if (focusedId === id) focusedId = null;
    renderDock(); savePositions();
  }
  function restoreWindow(id) {
    const t = terminals.get(id);
    if (!t) return;
    const w = t.winEl;
    w.style.display = '';
    w.classList.add('restoring');
    setTimeout(() => w.classList.remove('restoring'), 320);
    t.minimized = false;
    bringToFront(id);
    setTimeout(() => { try { t.fit.fit(); t.term.focus(); } catch(e){} }, 80);
    savePositions();
  }
  function toggleMaximize(id) {
    const t = terminals.get(id);
    if (!t) return;
    const w = t.winEl;
    if (t.savedSize) {
      w.style.left   = t.savedSize.l;
      w.style.top    = t.savedSize.t;
      w.style.width  = t.savedSize.w;
      w.style.height = t.savedSize.h;
      t.savedSize = null;
    } else {
      t.savedSize = { l:w.style.left, t:w.style.top, w:w.style.width, h:w.style.height };
      w.style.left = '0'; w.style.top = '30px';
      w.style.width = '100%'; w.style.height = 'calc(100% - 30px)';
    }
    setTimeout(() => { try { t.fit.fit(); } catch(e){} }, 60);
    savePositions();
  }
  function closeTerminal(id) {
    const t = terminals.get(id);
    if (!t) return;
    const w = t.winEl;
    w.classList.add('closing');
    setTimeout(() => {
      try { t.ws.close(); }     catch(e){}
      try { t.ro.disconnect(); } catch(e){}
      try { t.term.dispose(); }  catch(e){}
      if (w.parentNode) w.parentNode.removeChild(w);
      terminals.delete(id);
      if (focusedId === id) focusedId = null;
      delete terminalMeta[id];
      saveMeta();
      fetch('/api/terminal/' + id, { method:'DELETE' }).catch(()=>{});
      updateBroadcastButton();
      renderDock();
      savePositions();
    }, 200);
  }

  /* ════════════════════════════════════════════════════════════════════
     DOCK
     ════════════════════════════════════════════════════════════════════ */
  function renderDock() {
    if (!dockEl) return;
    dockEl.innerHTML = '';
    if (terminals.size === 0) { dockEl.classList.add('empty'); return; }
    dockEl.classList.remove('empty');
    terminals.forEach((t, id) => {
      const meta = terminalMeta[id] || {};
      const item = document.createElement('div');
      let cls = 'dock-item';
      if (t.minimized)                              cls += ' minimized';
      if (focusedId === id && !t.minimized)         cls += ' focused';
      if (meta.color && meta.color !== 'default')   cls += ' color-' + meta.color;
      item.className = cls;
      const name = meta.label || basename(t.info.cwd);
      item.innerHTML =
        '<span class="dock-item-num">' + t.num + '</span>' +
        '<div class="dock-item-icon">▸</div>' +
        '<div class="dock-item-name">' + esc(name) + '</div>' +
        '<div class="dock-tooltip">' + esc(meta.label ? meta.label + ' — ' + t.info.cwd : t.info.cwd) + '</div>';
      item.addEventListener('click', () => {
        if (t.minimized) restoreWindow(id); else bringToFront(id);
      });
      dockEl.appendChild(item);
    });
  }

  /* ════════════════════════════════════════════════════════════════════
     METADATA por terminal (label + color)
     ════════════════════════════════════════════════════════════════════ */
  function loadMeta() {
    try { terminalMeta = JSON.parse(localStorage.getItem(LS.meta) || '{}'); }
    catch { terminalMeta = {}; }
  }
  function saveMeta() { localStorage.setItem(LS.meta, JSON.stringify(terminalMeta)); }

  function applyMeta(id) {
    const t = terminals.get(id);
    const meta = terminalMeta[id];
    if (!t || !meta) return;
    /* Color */
    const colors = ['red','orange','yellow','green','blue','purple','pink'];
    colors.forEach(c => t.winEl.classList.remove('color-' + c));
    if (meta.color && meta.color !== 'default') t.winEl.classList.add('color-' + meta.color);
    /* Label */
    if (meta.label) {
      t.winEl.querySelector('.window-title-name').textContent = meta.label;
    }
  }

  /* ── Context menu ──────────────────────────────────────────────── */
  function openCtxMenu(id, x, y) {
    ctxTermId = id;
    ctxMenu.classList.remove('hidden');
    /* posicionar con clamp para que no se salga */
    const r = ctxMenu.getBoundingClientRect();
    const maxX = window.innerWidth - r.width - 8;
    const maxY = window.innerHeight - r.height - 8;
    ctxMenu.style.left = Math.min(x, maxX) + 'px';
    ctxMenu.style.top  = Math.min(y, maxY) + 'px';
  }
  function closeCtxMenu() { ctxMenu.classList.add('hidden'); ctxTermId = null; }
  document.addEventListener('click', e => {
    if (!ctxMenu.contains(e.target)) closeCtxMenu();
  });

  ctxMenu.querySelector('[data-act="rename"]').addEventListener('click', () => {
    const id = ctxTermId; closeCtxMenu();
    if (!id) return;
    const t = terminals.get(id);
    if (!t) return;
    const current = (terminalMeta[id] && terminalMeta[id].label) || basename(t.info.cwd);
    const v = prompt('Nuevo nombre para esta terminal:', current);
    if (v === null) return;
    terminalMeta[id] = { ...(terminalMeta[id]||{}), label: v.trim() || undefined };
    saveMeta();
    applyMeta(id);
    renderDock();
  });
  ctxMenu.querySelectorAll('.ctx-color').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = ctxTermId; closeCtxMenu();
      if (!id) return;
      const color = btn.dataset.color;
      terminalMeta[id] = { ...(terminalMeta[id]||{}), color };
      saveMeta();
      applyMeta(id);
      renderDock();
    });
  });

  /* ════════════════════════════════════════════════════════════════════
     BROADCAST
     ════════════════════════════════════════════════════════════════════ */
  function toggleBroadcast() {
    if (terminals.size < 2) { toast('Necesitas 2+ terminales', 'error'); return; }
    broadcastMode = !broadcastMode;
    document.body.classList.toggle('broadcasting', broadcastMode);
    btnBroadcast.classList.toggle('active', broadcastMode);
    broadcastInd.classList.toggle('hidden', !broadcastMode);
    toast(broadcastMode ? '📡 Broadcast ACTIVADO' : 'Broadcast desactivado',
          broadcastMode ? 'success' : 'info');
  }
  function updateBroadcastButton() {
    if (terminals.size >= 2) btnBroadcast.classList.remove('hidden');
    else {
      btnBroadcast.classList.add('hidden');
      if (broadcastMode) toggleBroadcast();
    }
  }
  btnBroadcast.addEventListener('click', toggleBroadcast);

  /* ════════════════════════════════════════════════════════════════════
     PROMPTS
     ════════════════════════════════════════════════════════════════════ */
  function renderPrompts() {
    promptsGrid.innerHTML = '';
    PROMPTS.forEach(p => {
      const card = document.createElement('div');
      card.className = 'prompt-card';
      card.innerHTML =
        '<div class="prompt-card-title">' +
          '<span class="prompt-card-icon">' + p.icon + '</span>' +
          '<span>' + esc(p.title) + '</span>' +
        '</div>' +
        '<div class="prompt-card-desc">' + esc(p.desc) + '</div>' +
        '<div class="prompt-card-actions">' +
          '<button class="prompt-card-btn" data-target="focus">→ Foco</button>' +
          '<button class="prompt-card-btn all" data-target="all">→ Todas</button>' +
        '</div>';
      card.querySelector('[data-target="focus"]').addEventListener('click', () => {
        sendPromptTo(p.prompt, 'focus');
      });
      card.querySelector('[data-target="all"]').addEventListener('click', () => {
        sendPromptTo(p.prompt, 'all');
      });
      promptsGrid.appendChild(card);
    });
  }
  function openPrompts()  { renderPrompts(); promptsOverlay.classList.remove('hidden'); }
  function closePrompts() { promptsOverlay.classList.add('hidden'); }
  btnPrompts && btnPrompts.addEventListener('click', openPrompts);
  btnPromptsClose.addEventListener('click', closePrompts);
  promptsOverlay.addEventListener('click', e => { if (e.target === promptsOverlay) closePrompts(); });

  function sendPromptTo(text, target) {
    /* Añade un Enter final para enviar el prompt a Claude */
    const payload = text + '\r';
    if (target === 'focus') {
      if (!focusedId) { toast('Enfoca una terminal primero', 'error'); return; }
      const t = terminals.get(focusedId);
      if (t.ws.readyState === WebSocket.OPEN) {
        t.ws.send(JSON.stringify({ type:'input', data:payload }));
        toast('Prompt enviado a terminal #' + t.num, 'success');
      }
    } else {
      if (terminals.size === 0) { toast('No hay terminales abiertas', 'error'); return; }
      let n = 0;
      terminals.forEach(t => {
        if (t.ws.readyState === WebSocket.OPEN) {
          t.ws.send(JSON.stringify({ type:'input', data:payload }));
          n++;
        }
      });
      toast('Prompt enviado a ' + n + ' terminales', 'success');
    }
    closePrompts();
  }

  /* ════════════════════════════════════════════════════════════════════
     DRAG/RESIZE GLOBALES + SNAP LAYOUTS
     ════════════════════════════════════════════════════════════════════ */
  function computeSnap(x, y) {
    const T = 30;   /* threshold en px */
    const W = window.innerWidth, H = window.innerHeight;
    const MB = 30;  /* menubar */
    const inHalfW = Math.floor(W/2);
    const inHalfH = Math.floor((H - MB)/2);

    /* Esquinas (cuartos) */
    if (x < T && y < MB + T)              return { l:0,        t:MB,             w:inHalfW, h:inHalfH };
    if (x > W-T && y < MB + T)            return { l:inHalfW,  t:MB,             w:W-inHalfW, h:inHalfH };
    if (x < T && y > H-T)                 return { l:0,        t:MB+inHalfH,     w:inHalfW, h:H-MB-inHalfH };
    if (x > W-T && y > H-T)               return { l:inHalfW,  t:MB+inHalfH,     w:W-inHalfW, h:H-MB-inHalfH };
    /* Bordes (mitades) */
    if (x < T)                            return { l:0,        t:MB,             w:inHalfW, h:H-MB };
    if (x > W-T)                          return { l:inHalfW,  t:MB,             w:W-inHalfW, h:H-MB };
    if (y < MB + 6)                       return { l:0,        t:MB,             w:W,       h:H-MB };
    return null;
  }
  function showSnapPreview(rect) {
    if (!rect) { snapPreview.classList.add('hidden'); snapTarget = null; return; }
    snapTarget = rect;
    snapPreview.style.left   = rect.l + 'px';
    snapPreview.style.top    = rect.t + 'px';
    snapPreview.style.width  = rect.w + 'px';
    snapPreview.style.height = rect.h + 'px';
    snapPreview.classList.remove('hidden');
  }
  function applySnap(win, rect, termId) {
    const t = terminals.get(termId);
    if (t) {
      t.savedSize = { l: win.style.left, t: win.style.top, w: win.style.width, h: win.style.height };
    }
    win.style.left   = rect.l + 'px';
    win.style.top    = rect.t + 'px';
    win.style.width  = rect.w + 'px';
    win.style.height = rect.h + 'px';
    setTimeout(() => {
      if (t) { try { t.fit.fit(); } catch(e){} }
    }, 60);
  }

  document.addEventListener('mousemove', e => {
    if (dragging) {
      dragging.win.style.left = (dragging.l + e.clientX - dragging.sx) + 'px';
      dragging.win.style.top  = Math.max(30, dragging.t + e.clientY - dragging.sy) + 'px';
      /* snap preview */
      showSnapPreview(computeSnap(e.clientX, e.clientY));
    }
    if (resizing) {
      resizing.win.style.width  = Math.max(280, resizing.w + e.clientX - resizing.sx) + 'px';
      resizing.win.style.height = Math.max(200, resizing.h + e.clientY - resizing.sy) + 'px';
      const t = terminals.get(resizing.id);
      if (t) { try { t.fit.fit(); } catch(e){} }
    }
  });
  document.addEventListener('mouseup', () => {
    if (dragging && snapTarget) {
      applySnap(dragging.win, snapTarget, dragging.id);
    }
    showSnapPreview(null);
    if (dragging || resizing) savePositions();
    dragging = null;
    resizing = null;
  });

  /* ════════════════════════════════════════════════════════════════════
     DRAG & DROP de carpeta
     ════════════════════════════════════════════════════════════════════ */
  let dropCounter = 0;
  document.addEventListener('dragenter', e => {
    e.preventDefault();
    dropCounter++;
    if (e.dataTransfer && Array.from(e.dataTransfer.types).some(t => t === 'Files' || t === 'text/plain' || t === 'text/uri-list')) {
      dropZone.classList.remove('hidden');
    }
  });
  document.addEventListener('dragover',  e => { e.preventDefault(); });
  document.addEventListener('dragleave', e => {
    dropCounter--;
    if (dropCounter <= 0) { dropCounter = 0; dropZone.classList.add('hidden'); }
  });
  document.addEventListener('drop', e => {
    e.preventDefault();
    dropCounter = 0;
    dropZone.classList.add('hidden');
    handleDrop(e);
  });
  function handleDrop(e) {
    let path = null;

    /* 1) text/plain o text/uri-list (a veces el explorador o el navegador lo pasa) */
    const uri = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (uri) {
      let candidate = uri.trim().split('\n')[0].trim();
      if (candidate.startsWith('file:///')) {
        candidate = decodeURIComponent(candidate.replace(/^file:\/\/\//, ''));
        candidate = candidate.replace(/\//g, '\\');  /* Windows */
        if (!/^[a-z]:/i.test(candidate)) candidate = '\\\\' + candidate;
      }
      if (candidate.length > 1) path = candidate;
    }

    /* 2) Si tenemos un path absoluto, abrimos directo */
    if (path) {
      modalPath.value = path;
      toast('Carpeta detectada: ' + basename(path), 'info');
      openModal(false);
      return;
    }

    /* 3) Fallback: abrir el selector nativo */
    toast('Selecciona la carpeta exacta', 'info');
    openModal(false);
    setTimeout(() => btnPickFolder.click(), 200);
  }

  /* ════════════════════════════════════════════════════════════════════
     PERSISTENCIA DE SESIÓN
     ════════════════════════════════════════════════════════════════════ */
  function savePositions() {
    const data = {};
    terminals.forEach((t, id) => {
      data[id] = {
        left: t.winEl.style.left, top: t.winEl.style.top,
        width: t.winEl.style.width, height: t.winEl.style.height,
        minimized: t.minimized,
      };
    });
    try { localStorage.setItem(LS.positions, JSON.stringify(data)); } catch(e){}
  }
  function loadPositions() {
    try { return JSON.parse(localStorage.getItem(LS.positions) || '{}'); }
    catch { return {}; }
  }

  async function restoreSession() {
    try {
      const res  = await fetch('/api/terminal/list');
      const list = await res.json();
      if (!list || !list.length) return;
      const saved = loadPositions();
      list.forEach(info => {
        const p = saved[info.id];
        const pos = p ? {
          left:   parseInt(p.left)   || 100,
          top:    parseInt(p.top)    || 80,
          width:  parseInt(p.width)  || 820,
          height: parseInt(p.height) || 500,
        } : null;
        openTerminalWindow(info, pos);
        if (p && p.minimized) setTimeout(() => minimizeWindow(info.id), 80);
      });
      toast('Restauradas ' + list.length + ' terminal' + (list.length===1?'':'es'), 'success');
    } catch (e) { console.warn('[ClaudeBridge] sesión:', e); }
  }

  /* ════════════════════════════════════════════════════════════════════
     ATAJOS DE TECLADO
     ════════════════════════════════════════════════════════════════════ */
  document.addEventListener('keydown', e => {
    /* Esc: cierra cualquier modal/menu */
    if (e.key === 'Escape') {
      closeModal();
      helpOverlay.classList.add('hidden');
      promptsOverlay.classList.add('hidden');
      closeProfilesModal();
      closeCtxMenu();
      closeAllDropdowns();
      return;
    }

    const anyModalOpen = !modal.classList.contains('hidden') ||
                         !helpOverlay.classList.contains('hidden') ||
                         !promptsOverlay.classList.contains('hidden') ||
                         !profilesOverlay.classList.contains('hidden');

    /* ? abre la ayuda (incluso si hay foco fuera) */
    if (e.key === '?' && !e.ctrlKey && !e.metaKey && !anyModalOpen) {
      e.preventDefault();
      helpOverlay.classList.remove('hidden');
      return;
    }

    if (anyModalOpen) return;

    const ctrl = e.ctrlKey || e.metaKey;
    if (!ctrl) {
      if (e.altKey && (e.key === 'w' || e.key === 'W') && focusedId) {
        e.preventDefault(); closeTerminal(focusedId);
      }
      return;
    }

    if (e.key === 'k' || e.key === 'K') {
      e.preventDefault(); openModal(e.shiftKey);
    } else if (e.key === 'b' || e.key === 'B') {
      e.preventDefault(); toggleBroadcast();
    } else if (e.key === 'm' || e.key === 'M') {
      if (focusedId) { e.preventDefault(); minimizeWindow(focusedId); }
    } else if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      if (e.shiftKey) openProfilesModal();
      else            openPrompts();
    } else if (/^[1-9]$/.test(e.key)) {
      const n = parseInt(e.key);
      let target = null;
      terminals.forEach((t, id) => { if (t.num === n) target = id; });
      if (target) {
        e.preventDefault();
        const t = terminals.get(target);
        if (t.minimized) restoreWindow(target); else bringToFront(target);
      }
    }
  });

  btnHelpClose.addEventListener('click', () => helpOverlay.classList.add('hidden'));
  helpOverlay.addEventListener('click', e => { if (e.target === helpOverlay) helpOverlay.classList.add('hidden'); });

  /* ════════════════════════════════════════════════════════════════════
     WORKSPACE PROFILES
     Guarda y restaura setups completos (carpetas + nombres + colores + posiciones).
     Persiste en el servidor en .data/profiles.json
     ════════════════════════════════════════════════════════════════════ */
  function gatherCurrentSetup() {
    /* Snapshot del estado actual de todas las terminales */
    const arr = [];
    terminals.forEach((t, id) => {
      const meta = terminalMeta[id] || {};
      arr.push({
        cwd:    t.info.cwd,
        label:  meta.label || null,
        color:  meta.color || null,
        position: {
          left:   t.winEl.style.left,
          top:    t.winEl.style.top,
          width:  t.winEl.style.width,
          height: t.winEl.style.height,
        },
        minimized: !!t.minimized,
      });
    });
    return arr;
  }

  async function fetchProfiles() {
    try {
      const r = await fetch('/api/profiles');
      return await r.json();
    } catch { return {}; }
  }

  async function saveProfile() {
    const name = profileNameInput.value.trim();
    if (!name) { toast('Dale un nombre al profile', 'error'); return; }
    const terms = gatherCurrentSetup();
    if (!terms.length) { toast('No hay terminales que guardar', 'error'); return; }
    try {
      const r = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, terminals: terms }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error guardando');
      toast(`Profile "${name}" guardado con ${terms.length} terminale${terms.length === 1 ? '' : 's'}`, 'success');
      profileNameInput.value = '';
      renderProfilesList();
    } catch (e) {
      toast('Error: ' + e.message, 'error');
    }
  }

  async function deleteProfile(name) {
    if (!confirm(`¿Eliminar el profile "${name}"?`)) return;
    try {
      await fetch('/api/profiles/' + encodeURIComponent(name), { method: 'DELETE' });
      toast(`Profile "${name}" eliminado`, 'info');
      renderProfilesList();
    } catch (e) {
      toast('Error eliminando: ' + e.message, 'error');
    }
  }

  async function loadProfile(name, profile) {
    const openCount = terminals.size;
    let confirmed = true;
    if (openCount > 0) {
      confirmed = confirm(
        `Cargar "${name}" abrirá ${profile.terminals.length} terminal${profile.terminals.length === 1 ? '' : 'es'}.\n` +
        `Tienes ${openCount} abierta${openCount === 1 ? '' : 's'} ahora mismo.\n\n` +
        `¿Quieres CERRAR las actuales antes de cargar?\n` +
        `(OK = sí cerrar y cargar limpio, Cancelar = añadir al setup actual)`
      );
    }
    /* Si confirmed === true → cerrar todas, luego cargar */
    if (confirmed && openCount > 0) {
      const ids = Array.from(terminals.keys());
      for (const id of ids) closeTerminal(id);
      await new Promise(r => setTimeout(r, 350));  /* esperar animación de close */
    }
    /* Cargar terminales del profile */
    closeProfilesModal();
    toast(`Cargando "${name}"…`, 'info');
    profile.terminals.forEach((tEntry, i) => {
      setTimeout(async () => {
        const pos = tEntry.position ? {
          left:   parseInt(tEntry.position.left)   || 100,
          top:    parseInt(tEntry.position.top)    || 80,
          width:  parseInt(tEntry.position.width)  || 820,
          height: parseInt(tEntry.position.height) || 500,
        } : null;
        await createTerminal(tEntry.cwd, FIXED_CMD, pos);
        /* Aplicar label + color cuando esté creada */
        setTimeout(() => {
          /* Encuentra la última terminal creada que coincida con esta cwd */
          let foundId = null;
          terminals.forEach((tt, id) => {
            if (tt.info.cwd === tEntry.cwd && !terminalMeta[id]) foundId = id;
          });
          if (foundId && (tEntry.label || tEntry.color)) {
            terminalMeta[foundId] = {
              label: tEntry.label || undefined,
              color: tEntry.color || 'default',
            };
            saveMeta();
            applyMeta(foundId);
            renderDock();
          }
          if (foundId && tEntry.minimized) {
            minimizeWindow(foundId);
          }
        }, 350);
      }, i * 110);
    });
  }

  async function renderProfilesList() {
    const profiles = await fetchProfiles();
    const names = Object.keys(profiles);
    profilesList.innerHTML = '';
    profilesCurCount.textContent = terminals.size + ' terminal' + (terminals.size === 1 ? '' : 'es') + ' abierta' + (terminals.size === 1 ? '' : 's');
    if (names.length === 0) {
      profilesList.innerHTML = '<div class="profile-empty">Aún no has guardado ningún workspace. Crea uno arriba ↑</div>';
      return;
    }
    names.sort((a, b) => (profiles[b].created || 0) - (profiles[a].created || 0));
    names.forEach(name => {
      const p = profiles[name];
      const count = p.terminals.length;
      const date = p.created ? new Date(p.created * 1000).toLocaleString('es-ES', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
      }) : '';
      const sample = p.terminals.slice(0, 3).map(t => basename(t.cwd)).join(' · ');
      const more = count > 3 ? ` +${count - 3}` : '';
      const card = document.createElement('div');
      card.className = 'profile-card';
      card.innerHTML =
        '<div class="profile-card-info">' +
          '<div class="profile-card-name">' + esc(name) + '</div>' +
          '<div class="profile-card-meta">' +
            '<span>' + count + ' terminal' + (count === 1 ? '' : 'es') + '</span>' +
            (date ? '<span>' + esc(date) + '</span>' : '') +
          '</div>' +
          '<div class="profile-card-paths">' + esc(sample) + more + '</div>' +
        '</div>' +
        '<div class="profile-card-actions">' +
          '<button class="profile-action primary" data-act="load">Cargar</button>' +
          '<button class="profile-action danger"  data-act="del">×</button>' +
        '</div>';
      card.querySelector('[data-act="load"]').addEventListener('click', () => loadProfile(name, p));
      card.querySelector('[data-act="del"]') .addEventListener('click', () => deleteProfile(name));
      profilesList.appendChild(card);
    });
  }

  function openProfilesModal() {
    profilesOverlay.classList.remove('hidden');
    renderProfilesList();
    setTimeout(() => profileNameInput.focus(), 80);
  }
  function closeProfilesModal() { profilesOverlay.classList.add('hidden'); }

  btnProfiles && btnProfiles.addEventListener('click', openProfilesModal);
  profilesClose  .addEventListener('click', closeProfilesModal);
  profilesOverlay.addEventListener('click', e => { if (e.target === profilesOverlay) closeProfilesModal(); });
  btnProfileSave .addEventListener('click', saveProfile);
  profileNameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); saveProfile(); }
  });

  /* ════════════════════════════════════════════════════════════════════
     MENÚS DROPDOWN (estilo macOS)
     ════════════════════════════════════════════════════════════════════ */
  function openDropdown(name) {
    closeAllDropdowns();
    const btn = document.querySelector('.menu-item[data-menu="' + name + '"]');
    const dd  = document.getElementById('dropdown-' + name);
    if (!btn || !dd) return;
    btn.classList.add('active');
    dd.classList.remove('hidden');
  }
  function closeAllDropdowns() {
    document.querySelectorAll('.dropdown').forEach(d => d.classList.add('hidden'));
    document.querySelectorAll('.menu-item.active').forEach(i => i.classList.remove('active'));
  }
  function anyDropdownOpen() {
    return !!document.querySelector('.menu-item.active');
  }

  /* Wiring: click toggles, hover-switches cuando uno ya está abierto */
  document.querySelectorAll('.menu-item[data-menu]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const name = btn.dataset.menu;
      const dd   = document.getElementById('dropdown-' + name);
      if (!dd.classList.contains('hidden')) closeAllDropdowns();
      else                                  openDropdown(name);
    });
    btn.addEventListener('mouseenter', () => {
      if (anyDropdownOpen()) openDropdown(btn.dataset.menu);
    });
  });

  /* Click fuera cierra */
  document.addEventListener('click', e => {
    if (!e.target.closest('.menu-item-wrap')) closeAllDropdowns();
  });

  /* Wiring de acciones de cada dropdown item */
  document.querySelectorAll('.dropdown-item[data-action]').forEach(item => {
    item.addEventListener('click', () => {
      const action = item.dataset.action;
      closeAllDropdowns();
      handleMenuAction(action);
    });
  });

  function handleMenuAction(action) {
    switch (action) {
      /* Archivo */
      case 'new-terminal':    openModal(false); break;
      case 'swarm':           openModal(true); break;
      case 'workspaces':      openProfilesModal(); break;
      case 'save-workspace':
        openProfilesModal();
        setTimeout(() => profileNameInput.focus(), 120);
        break;
      case 'close-focused':
        if (!focusedId) toast('No hay terminal enfocada', 'error');
        else            closeTerminal(focusedId);
        break;
      case 'close-all':       closeAllTerminals(); break;

      /* Terminal */
      case 'prompts':         openPrompts(); break;
      case 'broadcast':       toggleBroadcast(); break;
      case 'clear-screen':    sendToFocused('clear\r'); break;
      case 'send-ctrl-c':     sendToFocused('\x03'); break;
      case 'rename':          renameFocused(); break;
      case 'remove-color':    removeColorFocused(); break;

      /* Ver */
      case 'toggle-theme':    toggleTheme(); break;
      case 'auto-tile':       autoTile(); break;
      case 'cascade':         cascadeWindows(); break;
      case 'shortcuts':       helpOverlay.classList.remove('hidden'); break;

      /* Ventana */
      case 'minimize':
        if (focusedId) minimizeWindow(focusedId);
        else           toast('No hay terminal enfocada', 'error');
        break;
      case 'maximize':
        if (focusedId) toggleMaximize(focusedId);
        else           toast('No hay terminal enfocada', 'error');
        break;
      case 'snap-left':       snapFocused('left');  break;
      case 'snap-right':      snapFocused('right'); break;
      case 'snap-full':       snapFocused('full');  break;
      case 'restore-all':     restoreAllMinimized(); break;

      /* Ayuda */
      case 'about':           showAbout(); break;
    }
  }

  /* ── Acciones nuevas ─────────────────────────────────────────────── */
  function closeAllTerminals() {
    if (terminals.size === 0) { toast('No hay terminales abiertas', 'info'); return; }
    if (!confirm(`¿Cerrar las ${terminals.size} terminales abiertas?`)) return;
    Array.from(terminals.keys()).forEach(id => closeTerminal(id));
  }

  function sendToFocused(data) {
    if (!focusedId) { toast('Enfoca una terminal primero', 'error'); return; }
    const t = terminals.get(focusedId);
    if (t && t.ws.readyState === WebSocket.OPEN) {
      t.ws.send(JSON.stringify({ type: 'input', data }));
    }
  }

  function renameFocused() {
    if (!focusedId) { toast('Enfoca una terminal primero', 'error'); return; }
    const t = terminals.get(focusedId);
    const cur = (terminalMeta[focusedId] && terminalMeta[focusedId].label) || basename(t.info.cwd);
    const v = prompt('Nuevo nombre para esta terminal:', cur);
    if (v === null) return;
    terminalMeta[focusedId] = { ...(terminalMeta[focusedId] || {}), label: v.trim() || undefined };
    saveMeta();
    applyMeta(focusedId);
    renderDock();
  }
  function removeColorFocused() {
    if (!focusedId) return;
    terminalMeta[focusedId] = { ...(terminalMeta[focusedId] || {}), color: 'default' };
    saveMeta();
    applyMeta(focusedId);
    renderDock();
  }

  function snapFocused(direction) {
    if (!focusedId) { toast('Enfoca una terminal primero', 'error'); return; }
    const t = terminals.get(focusedId);
    const w = t.winEl;
    const MB = 30, DOCK_RES = 95;
    const W = window.innerWidth, H = window.innerHeight - MB - DOCK_RES;
    const halfW = Math.floor(W / 2);
    w.style.transition = 'left 0.25s ease, top 0.25s ease, width 0.25s ease, height 0.25s ease';
    if      (direction === 'left')  { w.style.left = '0';            w.style.top = MB+'px'; w.style.width = halfW+'px'; w.style.height = H+'px'; }
    else if (direction === 'right') { w.style.left = halfW+'px';     w.style.top = MB+'px'; w.style.width = (W-halfW)+'px'; w.style.height = H+'px'; }
    else                            { w.style.left = '0';            w.style.top = MB+'px'; w.style.width = '100%';   w.style.height = H+'px'; }
    setTimeout(() => { try { t.fit.fit(); } catch(e){} w.style.transition = ''; }, 260);
    savePositions();
  }

  function restoreAllMinimized() {
    let n = 0;
    terminals.forEach((t, id) => { if (t.minimized) { restoreWindow(id); n++; } });
    if (n === 0) toast('Ninguna terminal está minimizada', 'info');
    else         toast(`Restauradas ${n} terminale${n === 1 ? '' : 's'}`, 'success');
  }

  function autoTile() {
    const visible = [];
    terminals.forEach(t => { if (!t.minimized) visible.push(t); });
    const n = visible.length;
    if (n === 0) { toast('No hay terminales visibles', 'info'); return; }
    let cols, rows;
    if      (n === 1) { cols = 1; rows = 1; }
    else if (n === 2) { cols = 2; rows = 1; }
    else if (n <= 4)  { cols = 2; rows = 2; }
    else if (n <= 6)  { cols = 3; rows = 2; }
    else if (n <= 8)  { cols = 4; rows = 2; }
    else if (n <= 12) { cols = 4; rows = 3; }
    else              { cols = 4; rows = Math.ceil(n/4); }
    const MB = 30, DOCK_RES = 95, gap = 4;
    const W = window.innerWidth;
    const H = window.innerHeight - MB - DOCK_RES;
    const tw = Math.floor((W - gap * (cols + 1)) / cols);
    const th = Math.floor((H - gap * (rows + 1)) / rows);
    visible.forEach((t, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const w = t.winEl;
      w.style.transition = 'left 0.3s ease, top 0.3s ease, width 0.3s ease, height 0.3s ease';
      w.style.left   = (gap + col * (tw + gap)) + 'px';
      w.style.top    = (MB + gap + row * (th + gap)) + 'px';
      w.style.width  = tw + 'px';
      w.style.height = th + 'px';
      setTimeout(() => { try { t.fit.fit(); } catch(e){} w.style.transition = ''; }, 320);
    });
    toast(`${n} terminales en mosaico ${cols}×${rows}`, 'success');
    savePositions();
  }

  function cascadeWindows() {
    const visible = [];
    terminals.forEach(t => { if (!t.minimized) visible.push(t); });
    if (visible.length === 0) { toast('No hay terminales visibles', 'info'); return; }
    visible.forEach((t, i) => {
      const w = t.winEl;
      const off = i * 32;
      w.style.transition = 'left 0.3s ease, top 0.3s ease, width 0.3s ease, height 0.3s ease';
      w.style.left = (60 + off) + 'px';
      w.style.top  = (60 + off) + 'px';
      w.style.width = '820px';
      w.style.height = '500px';
      w.style.zIndex = ++topZ;
      setTimeout(() => { try { t.fit.fit(); } catch(e){} w.style.transition = ''; }, 320);
    });
    toast(`${visible.length} terminales en cascada`, 'success');
    savePositions();
  }

  function showAbout() {
    alert('ClaudeBridge\n\n' +
          'Launcher local con estética macOS para Claude Code.\n' +
          'Multi-terminal, swarm, broadcast, workspaces, prompts pro.\n\n' +
          'Plataforma: ' + (navigator.platform || '?') + '\n' +
          'Terminales abiertas: ' + terminals.size);
  }

  /* ════════════════════════════════════════════════════════════════════
     INIT
     ════════════════════════════════════════════════════════════════════ */
  console.log('[ClaudeBridge] listo. Pulsa ? para atajos.');
  loadMeta();
  renderBookmarks();
  restoreSession();

})();
