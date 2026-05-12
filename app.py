"""
ClaudeBridge — macOS-style terminal launcher for Claude Code.
Cross-platform Flask backend: Windows (pywinpty) / Unix (ptyprocess).
"""
import json
import os
import sys
import time
import uuid
import threading
import webbrowser
from pathlib import Path

from flask import Flask, jsonify, render_template, request
from flask_sock import Sock

# ─────────────────────────────────────────────────────────────────────────────
# Claude Code environment — auto-configured for every spawned terminal
# ─────────────────────────────────────────────────────────────────────────────
CLAUDE_ENV = {
    "ANTHROPIC_BASE_URL": "https://api.oneprovider.dev",
    "ANTHROPIC_API_KEY":  "sk-5fc31868f0fe5418836c246ab599c60268689e7795606f5ff45a9cf1f1341e97",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
}
for _k, _v in CLAUDE_ENV.items():
    os.environ.setdefault(_k, _v)

# ─────────────────────────────────────────────────────────────────────────────
# Cross-platform PTY backend
# ─────────────────────────────────────────────────────────────────────────────
IS_WINDOWS = sys.platform == "win32"
PTY_LIB = None
PTY_ERROR = None

if IS_WINDOWS:
    try:
        import winpty as PTY_LIB
    except ImportError as e:
        PTY_ERROR = f"pywinpty no instalado: {e}. Ejecuta: pip install pywinpty"
else:
    try:
        import ptyprocess as PTY_LIB
    except ImportError as e:
        PTY_ERROR = f"ptyprocess no instalado: {e}. Ejecuta: pip install ptyprocess"


def spawn_pty(cwd: str, cmd: str, rows: int, cols: int):
    """Spawn a real PTY process and return it (raises on failure)."""
    if IS_WINDOWS:
        # Sin comillas alrededor del comando: ConPTY (pywinpty 3.x) las preserva
        # como literales y cmd.exe acaba intentando ejecutar "claude" con comillas.
        cmd = (cmd or "").strip().strip('"').strip("'")
        full = f"cmd.exe /K {cmd}" if cmd else "cmd.exe"
        return PTY_LIB.PtyProcess.spawn(full, cwd=cwd, dimensions=(rows, cols))
    else:
        shell = os.environ.get("SHELL", "/bin/bash")
        argv = [shell, "-l", "-c", f"{cmd}; exec {shell}"] if cmd else [shell, "-l"]
        return PTY_LIB.PtyProcess.spawn(
            argv, cwd=cwd, dimensions=(rows, cols), env=dict(os.environ)
        )


# ─────────────────────────────────────────────────────────────────────────────
# Flask app
# ─────────────────────────────────────────────────────────────────────────────
APP_DIR = Path(__file__).parent.resolve()
DATA_DIR = APP_DIR / ".data"
DATA_DIR.mkdir(exist_ok=True)
PROFILES_FILE = DATA_DIR / "profiles.json"

app = Flask(
    __name__,
    template_folder=str(APP_DIR / "templates"),
    static_folder=str(APP_DIR / "static"),
)
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0   # no cache para archivos estáticos
sock = Sock(app)

TERMINALS: dict = {}
TERMINALS_LOCK = threading.Lock()


# ── Vistas ──────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template(
        "index.html",
        home_dir=str(Path.home()),
        cache_ver=int(time.time()),
        pty_ready=PTY_LIB is not None,
        pty_error=PTY_ERROR or "",
    )


@app.route("/api/info")
def info():
    return jsonify({
        "home":      str(Path.home()),
        "platform":  "windows" if IS_WINDOWS else sys.platform,
        "pty_ready": PTY_LIB is not None,
        "pty_error": PTY_ERROR or "",
    })


# ── Terminales ──────────────────────────────────────────────────────────────
@app.route("/api/terminal/new", methods=["POST"])
def terminal_new():
    if PTY_LIB is None:
        return jsonify({"error": PTY_ERROR or "PTY no disponible"}), 500

    body = request.get_json(silent=True) or {}
    cwd  = (body.get("cwd")  or str(Path.home())).strip()
    cmd  = (body.get("cmd")  or "").strip()
    rows = int(body.get("rows") or 30)
    cols = int(body.get("cols") or 120)

    if not os.path.isdir(cwd):
        return jsonify({"error": f"La carpeta no existe: {cwd}"}), 400

    try:
        proc = spawn_pty(cwd, cmd, rows, cols)
    except Exception as e:
        return jsonify({"error": f"No se pudo lanzar PTY: {e}"}), 500

    tid = uuid.uuid4().hex[:10]
    with TERMINALS_LOCK:
        TERMINALS[tid] = {
            "pty": proc, "cwd": cwd, "cmd": cmd,
            "lock": threading.Lock(),
            "created": time.time(),
        }

    return jsonify({"id": tid, "cwd": cwd, "cmd": cmd})


@app.route("/api/terminal/list", methods=["GET"])
def terminal_list():
    """Lista de PTYs vivas — usada para restaurar sesión al recargar."""
    out = []
    with TERMINALS_LOCK:
        for tid, t in list(TERMINALS.items()):
            try:
                alive = t["pty"].isalive()
            except Exception:
                alive = False
            if not alive:
                # Limpia procesos muertos
                TERMINALS.pop(tid, None)
                continue
            out.append({"id": tid, "cwd": t["cwd"], "cmd": t["cmd"]})
    return jsonify(out)


@app.route("/api/terminal/<tid>", methods=["DELETE"])
def terminal_kill(tid):
    with TERMINALS_LOCK:
        t = TERMINALS.pop(tid, None)
    if t:
        try: t["pty"].terminate(force=True)
        except Exception: pass
    return jsonify({"ok": True})


# ── Workspace profiles ──────────────────────────────────────────────────────
def _load_profiles():
    if PROFILES_FILE.exists():
        try:
            return json.loads(PROFILES_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def _save_profiles(data):
    PROFILES_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


@app.route("/api/profiles", methods=["GET"])
def profiles_list():
    return jsonify(_load_profiles())


@app.route("/api/profiles", methods=["POST"])
def profiles_save():
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    if not name:
        return jsonify({"error": "El nombre no puede estar vacío"}), 400
    terminals = body.get("terminals") or []
    if not isinstance(terminals, list):
        return jsonify({"error": "Formato inválido"}), 400

    profiles = _load_profiles()
    profiles[name] = {
        "name":      name,
        "created":   int(time.time()),
        "terminals": terminals,
    }
    _save_profiles(profiles)
    return jsonify({"ok": True, "count": len(terminals)})


@app.route("/api/profiles/<name>", methods=["DELETE"])
def profiles_delete(name):
    profiles = _load_profiles()
    profiles.pop(name, None)
    _save_profiles(profiles)
    return jsonify({"ok": True})


# ── Git branch (para mostrar en el titlebar de cada terminal) ───────────────
@app.route("/api/git-branch", methods=["GET"])
def git_branch():
    """Devuelve la rama git de la carpeta indicada, si es un repo."""
    import subprocess
    path = (request.args.get("path") or "").strip()
    if not path or not os.path.isdir(path):
        return jsonify({"branch": None})
    try:
        res = subprocess.run(
            ["git", "-C", path, "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True, text=True, timeout=2,
        )
        if res.returncode == 0:
            return jsonify({"branch": res.stdout.strip() or None})
    except FileNotFoundError:
        # git no instalado
        return jsonify({"branch": None, "error": "git no instalado"})
    except Exception:
        pass
    return jsonify({"branch": None})


# ── Folder picker (diálogo nativo del SO) ───────────────────────────────────
@app.route("/api/pick-folder", methods=["GET"])
def pick_folder():
    """Abre el selector de carpetas nativo (en la máquina del servidor; como el
       servidor corre en localhost, el diálogo aparece para el usuario).

       macOS:    osascript (AppleScript). Tkinter en macOS exige el main thread
                 y Flask sirve cada request en un worker → el proceso crashea
                 y el navegador reporta "Network error".
       Windows/Linux: tkinter funciona desde threads worker."""
    import subprocess

    # macOS → AppleScript (sin restricción de threads)
    if sys.platform == "darwin":
        try:
            res = subprocess.run(
                ["osascript", "-e",
                 'POSIX path of (choose folder with prompt "Selecciona carpeta de trabajo")'],
                capture_output=True, text=True, timeout=120,
            )
            # returncode != 0 cuando el usuario cancela; lo tratamos como path vacío
            if res.returncode == 0:
                # AppleScript devuelve la ruta con un "/" final; lo quitamos
                return jsonify({"path": res.stdout.strip().rstrip("/")})
            return jsonify({"path": ""})
        except FileNotFoundError:
            return jsonify({"error": "osascript no encontrado", "path": ""}), 500
        except Exception as e:
            return jsonify({"error": str(e), "path": ""}), 500

    # Windows / Linux → tkinter
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.wm_attributes("-topmost", 1)
        path = filedialog.askdirectory(
            initialdir=str(Path.home()),
            title="Selecciona carpeta de trabajo",
        )
        try: root.destroy()
        except Exception: pass
        return jsonify({"path": path or ""})
    except Exception as e:
        return jsonify({"error": str(e), "path": ""}), 500


# ── WebSocket PTY <-> browser ───────────────────────────────────────────────
@sock.route("/ws/<tid>")
def ws_terminal(ws, tid):
    t = TERMINALS.get(tid)
    if not t:
        ws.send(json.dumps({"type": "error", "msg": "Terminal no encontrada"}))
        return

    proc      = t["pty"]
    send_lock = t["lock"]
    stop      = threading.Event()

    def safe_send(text):
        try:
            with send_lock:
                ws.send(text)
        except Exception:
            stop.set()

    def reader():
        while not stop.is_set():
            try:
                chunk = proc.read(4096)
                if not chunk:
                    break
                if isinstance(chunk, (bytes, bytearray)):
                    chunk = chunk.decode("utf-8", errors="replace")
                safe_send(json.dumps({"type": "data", "data": chunk}))
            except EOFError:
                break
            except Exception:
                break
        safe_send(json.dumps({"type": "exit"}))

    threading.Thread(target=reader, daemon=True).start()

    try:
        while True:
            raw = ws.receive()
            if raw is None:
                break
            try:
                msg = json.loads(raw)
            except Exception:
                continue
            mtype = msg.get("type")
            if mtype == "input":
                payload = msg.get("data", "")
                try:
                    if IS_WINDOWS: proc.write(payload)
                    else:          proc.write(payload.encode("utf-8"))
                except Exception:
                    break
            elif mtype == "resize":
                try:
                    proc.setwinsize(int(msg.get("rows", 30)), int(msg.get("cols", 120)))
                except Exception:
                    pass
    finally:
        stop.set()


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────
def open_browser_after(url, delay=0.8):
    def _go():
        time.sleep(delay)
        try: webbrowser.open(url)
        except Exception: pass
    threading.Thread(target=_go, daemon=True).start()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5050))
    url  = f"http://127.0.0.1:{port}"
    bar  = "-" * 60

    print(bar)
    print(f"  ClaudeBridge  ->  {url}")
    print(f"  Platform:  {'Windows' if IS_WINDOWS else sys.platform}")
    print(f"  PTY:       {'OK' if PTY_LIB else 'NO DISPONIBLE - ' + (PTY_ERROR or '')}")
    print(f"  Home:      {Path.home()}")
    print(bar)

    if "--no-browser" not in sys.argv:
        open_browser_after(url)

    app.run(host="127.0.0.1", port=port, threaded=True, debug=False)
