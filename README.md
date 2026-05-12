# ClaudeBridge

Lanzador local con estética de **macOS** para abrir múltiples sesiones de [Claude Code](https://docs.claude.com/en/docs/claude-code/overview) en paralelo desde el navegador. Cada "ventana" es una terminal PTY real conectada por WebSocket; las variables de entorno de Claude se inyectan automáticamente.

---

## Características

| | |
|---|---|
| 🖥️ **Escritorio macOS** | Menubar con reloj, fondo de pantalla, ventanas arrastrables y redimensionables con traffic-lights (cerrar / minimizar / maximizar). |
| 🐚 **PTY real, multiplataforma** | Windows (`pywinpty` + ConPTY), Linux y macOS (`ptyprocess`). |
| 🤖 **Claude auto-lanzado** | Solo eliges la carpeta; `claude` se ejecuta automáticamente con las env vars (`ANTHROPIC_BASE_URL`, `ANTHROPIC_API_KEY`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`) ya configuradas. |
| ⚡ **Modo Swarm** | Lanza 8 terminales a la vez en grilla 4×2 con un clic. |
| 📡 **Broadcast** | Activa un modo donde lo que tecleas se envía simultáneamente a TODAS las terminales abiertas — perfecto para pedir lo mismo en 8 proyectos a la vez. |
| ⭐ **Bookmarks** | Guarda tus carpetas favoritas como chips en el modal. Persistentes en `localStorage`. |
| 💾 **Persistencia de sesión** | Si recargas el navegador, las terminales que tenías abiertas se restauran (el backend mantiene las PTYs vivas). |
| ⌨️ **Atajos de teclado** | `Ctrl+K` nueva terminal, `Ctrl+Shift+K` swarm, `Ctrl+B` broadcast, `Ctrl+1..9` saltar a terminal N, `?` ayuda. |
| 📁 **Selector nativo de carpeta** | Botón "📁" en el modal abre el diálogo nativo del SO (vía `tkinter` en el backend). |
| 🚢 **Dock animado** | Barra inferior con todas las terminales. Click para enfocar; las minimizadas se ven apagadas con punto blanco. |

---

## Instalación

### Requisitos
- Python 3.10+
- `claude` instalado y en `PATH` (ver [docs oficiales](https://docs.claude.com/en/docs/claude-code/setup))

### Setup

```bash
git clone https://github.com/<tu-usuario>/ClaudeBridge.git
cd ClaudeBridge
pip install -r requirements.txt
```

---

## Ejecución

### Windows
```bat
start.bat
```
o desde PowerShell:
```powershell
.\start.ps1
```

### Linux / macOS
```bash
chmod +x start.sh
./start.sh
```

### Manual (cualquier SO)
```bash
python app.py
```

El navegador se abrirá automáticamente en `http://127.0.0.1:5050`.

---

## Uso

1. Click en **`+ Nueva Terminal`** (o `Ctrl+K`).
2. Selecciona la carpeta (escríbela, pícala del selector nativo 📁, o tira de favoritos ⭐).
3. Pulsa **Abrir Terminal** → se abre una ventana con `claude` ya corriendo.

### Modo Swarm
Click en **`⚡ Swarm 8`** (o `Ctrl+Shift+K`) → se abren 8 terminales en grilla 4×2. Útil para:
- Trabajar en 8 ramas de git paralelas con Claude.
- Comparar respuestas del modelo en 8 proyectos distintos.
- Tareas masivas tipo "refactoriza X en estos 8 repos".

### Broadcast
Cuando hay 2+ terminales aparece el botón **📡 Broadcast** (o `Ctrl+B`).
Una vez activado, lo que escribas en cualquier terminal se envía a **todas** simultáneamente. El borde de las ventanas se vuelve naranja para indicar el modo activo.

### Atajos

| Atajo | Acción |
|---|---|
| `Ctrl+K` | Nueva terminal |
| `Ctrl+Shift+K` | Swarm 8 |
| `Ctrl+B` | Toggle broadcast |
| `Ctrl+M` | Minimizar terminal enfocada |
| `Alt+W` | Cerrar terminal enfocada |
| `Ctrl+1..9` | Saltar a terminal N |
| `?` | Mostrar/ocultar ayuda |
| `Esc` | Cerrar modal |

---

## Configuración

Las variables de entorno de Claude están definidas en `app.py`:

```python
CLAUDE_ENV = {
    "ANTHROPIC_BASE_URL": "https://api.oneprovider.dev",
    "ANTHROPIC_API_KEY":  "sk-...",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
}
```

Para cambiarlas: edita `app.py` o exporta las variables antes de arrancar (los scripts `start.*` ya las ponen). El `os.environ.setdefault` respeta lo que ya tengas en tu shell.

Puerto: por defecto `5050`. Cambia con `PORT=6000 python app.py`.

---

## Arquitectura

```
ClaudeBridge/
├── app.py                  # Flask backend (PTY, WebSocket, API REST)
├── templates/
│   └── index.html          # HTML estructural
├── static/
│   ├── style.css           # CSS con animaciones macOS
│   ├── app.js              # Frontend (xterm.js + WebSocket + UI)
│   ├── fondo.jpg           # Wallpaper del escritorio
│   ├── logo.svg            # Logo Apple (menubar + favicon)
│   └── logo.png            # PNG por compatibilidad
├── start.bat               # Launcher Windows CMD
├── start.ps1               # Launcher Windows PowerShell
├── start.sh                # Launcher Linux/macOS
├── requirements.txt
├── LICENSE
└── README.md
```

### Flujo de una terminal

```
[Browser]                  [Flask]                  [SO]
    │                         │                       │
    ├─ POST /api/terminal/new │                       │
    │                         ├─ pywinpty/ptyprocess  │
    │                         │     spawn(cmd.exe /K claude)
    │                         │                       │
    ◄── { id: "abc123" } ─────┤                       │
    │                         │                       │
    ├─ WebSocket /ws/abc123 ──┤                       │
    │   ⇆ datos / input       ├─ proc.read/write ─────┤
    │   ⇆ resize              │                       │
```

### Cross-platform PTY
- **Windows**: `pywinpty` 3.x usa ConPTY (Windows 10+ API nativa de pseudo-terminales).
- **Linux/macOS**: `ptyprocess` usa `forkpty(3)` con un shell de login.

### Persistencia
Las PTYs viven en el servidor independientemente de si el WebSocket está conectado. Al recargar el navegador, `GET /api/terminal/list` devuelve las que siguen vivas, y el frontend las re-renderiza con las posiciones guardadas en `localStorage`.

---

## API

| Método | Ruta | Descripción |
|---|---|---|
| `GET`    | `/` | UI principal |
| `GET`    | `/api/info` | Info del servidor (home, plataforma, PTY ready) |
| `POST`   | `/api/terminal/new` | Crea PTY. Body: `{cwd, cmd, rows, cols}` |
| `GET`    | `/api/terminal/list` | Lista de PTYs vivas |
| `DELETE` | `/api/terminal/<id>` | Termina PTY |
| `GET`    | `/api/pick-folder` | Abre selector nativo, devuelve `{path}` |
| `WS`     | `/ws/<id>` | I/O bidireccional con el PTY |

---

## Notas técnicas

- **Servidor**: Flask dev server con `threaded=True`. Suficiente para localhost; **no** desplegar en producción.
- **Caché**: `SEND_FILE_MAX_AGE_DEFAULT=0` + query string `?v={timestamp}` en CSS/JS para evitar problemas de caché durante desarrollo.
- **Seguridad**: La API solo escucha en `127.0.0.1`. No expone fuera del equipo.
- **xterm.js**: Cargado desde CDN. Funciona offline si ya está cacheado por el navegador.

---

## Troubleshooting

**El comando `claude` no se reconoce** — Verifica que `claude` esté en tu `PATH`. En Windows suele ser `claude.cmd`. Prueba `where claude` (Windows) o `which claude` (Unix).

**Las terminales no se abren / el reloj no se actualiza** — Cierra todos los procesos Python (`Get-Process python | Stop-Process -Force` en PowerShell, `pkill python` en Unix) y vuelve a lanzar. Una instancia vieja en el puerto 5050 puede estar interceptando los requests.

**El botón 📁 no abre el selector** — En Linux, asegúrate de tener `tkinter` instalado (`sudo apt install python3-tk`). En Windows y macOS viene con Python.

---

## Licencia

MIT — ver [LICENSE](LICENSE).
