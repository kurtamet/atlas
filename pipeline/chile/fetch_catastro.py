"""
SII catastro downloader (Detalle Catastral y Rol de Cobro), run on your own computer.

    pip install playwright && python3 -m playwright install chromium
    python3 pipeline/chile/fetch_catastro.py

What it does:
  1. Asks for the RUT and the clave tributaria in the terminal. The clave is not echoed or stored, and
     it is not written to any file or log.
  2. Opens a real Chromium window, signs in on the SII login page (one attempt only: wrong passwords
     count toward SII's lockout) and opens the service
     https://www4.sii.cl/sismunInternet6/?caller=DETALLE_CAT_Y_ROL_COBRO
  3. Selects Región Metropolitana and goes through every comuna by itself; each file the service sends
     (Detalle Catastral zip, Rol de cobro txt) is saved to data-chile/catastro/files/<comuna>_<n>.<ext>.
     If something is missing, download it by hand in the same window: the files are still caught.
  4. It logs which service calls the page makes (method, address, form field names; no cookies, no
     clave) to data-chile/catastro/api-log.jsonl. Send that log to Claude: with it the next version
     will download all Santiago comunas without clicks.

Close the browser window (or press Ctrl+C) when the downloads are done.
"""
import getpass
import json
import os
import re
import sys
import time

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sys.exit("Falta Playwright. Instala con:\n  pip install playwright && python3 -m playwright install chromium")

from common import ROOT

SERVICE = "https://www4.sii.cl/sismunInternet6/?caller=DETALLE_CAT_Y_ROL_COBRO"
LOGIN = "https://zeusr.sii.cl/AUT2000/InicioAutenticacion/IngresoRutClave.html?" + SERVICE
OUT = os.path.join(ROOT, "catastro")
FILES = os.path.join(OUT, "files")
SECRET_KEYS = re.compile(r"clave|pass|token|rut|dv|cookie", re.I)


def ask_credentials():
    rut = input("RUT (ej. 12345678-9): ").strip().replace(".", "").upper()
    m = re.fullmatch(r"(\d{6,8})-?([\dK])", rut)
    if not m:
        sys.exit("RUT no válido")
    clave = getpass.getpass("Clave tributaria (no se muestra): ")
    if not clave:
        sys.exit("Clave vacía")
    return m.group(1), m.group(2), clave


def dotted(body, dv):
    s = f"{int(body):,}".replace(",", ".")
    return f"{s}-{dv}"


def safe_fields(post):
    """form/JSON field names with values only for harmless fields (never the clave, RUT or tokens)"""
    if not post:
        return None
    try:
        data = json.loads(post)
        def scrub(o):
            if isinstance(o, dict):
                return {k: ("***" if SECRET_KEYS.search(k) else scrub(v)) for k, v in o.items()}
            if isinstance(o, list):
                return [scrub(x) for x in o[:20]]
            return o
        return scrub(data)
    except ValueError:
        out = {}
        for part in post.split("&"):
            k, _, v = part.partition("=")
            if k:
                out[k] = "***" if SECRET_KEYS.search(k) else v[:80]
        return out


def auto_download(page, label, idle):
    """Región Metropolitana → every comuna: select it, press any 'Detalle catastral' / 'Rol de cobro'
    control that appears, and wait for the files."""
    page.wait_for_selector("select", timeout=30000)
    idle(1500)
    region = page.locator("select").nth(0)
    opts = region.locator("option").all_inner_texts()
    rm = next((o for o in opts if re.search(r"metropolitana", o, re.I)), None)
    if not rm:
        raise RuntimeError("no encontré la Región Metropolitana en la lista")
    region.select_option(label=rm)
    idle(2500)
    comuna_sel = page.locator("select").nth(1)
    comunas = [o.strip() for o in comuna_sel.locator("option").all_inner_texts() if o.strip() and not o.lower().startswith("seleccione")]
    print(f"Región Metropolitana: {len(comunas)} comunas. Descargando…")
    for i, c in enumerate(comunas, 1):
        label["now"] = c
        before = len(os.listdir(FILES))
        comuna_sel.select_option(label=c)
        idle(2500)
        for txt in (r"detalle\s*catastral", r"rol\s*de\s*cobro"):
            ctl = page.locator("a, button, input[type=button]").filter(has_text=re.compile(txt, re.I))
            for k in range(ctl.count()):
                el = ctl.nth(k)
                if el.is_visible():
                    try:
                        el.click(timeout=3000)
                        idle(1500)
                    except Exception:
                        pass
        # wait until files stop arriving (large comunas take a while)
        quiet, last = 0, len(os.listdir(FILES))
        for _ in range(60):
            idle(1000)
            now = len(os.listdir(FILES))
            quiet = quiet + 1 if now == last else 0
            last = now
            if quiet >= (4 if now > before else 15):
                break
        got = len(os.listdir(FILES)) - before
        print(f"[{i}/{len(comunas)}] {c}: {got} archivo(s)")


def main():
    os.makedirs(FILES, exist_ok=True)
    body, dv, clave = ask_credentials()
    api_log = open(os.path.join(OUT, "api-log.jsonl"), "a", encoding="utf-8")
    saved = []

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=False)
        ctx = browser.new_context(accept_downloads=True, locale="es-CL")
        page = ctx.new_page()

        def on_request(req):
            if "zeusr.sii.cl" in req.url or req.resource_type not in ("xhr", "fetch", "document"):
                return
            api_log.write(json.dumps({"t": time.strftime("%H:%M:%S"), "method": req.method, "url": req.url.split("?")[0],
                                      "query": req.url.split("?", 1)[1][:300] if "?" in req.url else None,
                                      "fields": safe_fields(req.post_data)}, ensure_ascii=False) + "\n")
            api_log.flush()

        def on_response(res):
            if "sii.cl" not in res.url or "zeusr" in res.url:
                return
            ct = res.headers.get("content-type", "")
            if res.request.resource_type in ("xhr", "fetch"):
                api_log.write(json.dumps({"t": time.strftime("%H:%M:%S"), "response": res.url.split("?")[0], "status": res.status, "type": ct[:60]}) + "\n")
                api_log.flush()

        pending = []  # downloads are saved from the main loop, not inside the event callback
        ctx.on("request", on_request)
        ctx.on("response", on_response)
        page.on("download", lambda d: pending.append(d))
        ctx.on("page", lambda p: p.on("download", lambda d: pending.append(d)))

        label = {"now": "manual"}

        def flush():
            while pending:
                d = pending.pop(0)
                tmp = d.path()  # waits until the file is complete
                with open(tmp, "rb") as fh:
                    head = fh.read(4)
                ext = ".zip" if head.startswith(b"PK") else ".gz" if head.startswith(b"\x1f\x8b") else ".txt"
                base = re.sub(r"[^\w\-]+", "_", label["now"]).strip("_") or "archivo"
                n = sum(1 for x in saved if os.path.basename(x).startswith(base + "_")) + 1
                path = os.path.join(FILES, f"{base}_{n}{ext}")
                d.save_as(path)
                saved.append(path)
                print(f"  guardado: {os.path.basename(path)} ({os.path.getsize(path) / 1e6:.1f} MB)")

        def idle(ms):
            """sleep while Playwright keeps dispatching events (time.sleep would freeze them)"""
            page.wait_for_timeout(ms)
            flush()

        print("Entrando al SII…")
        page.goto(LOGIN, wait_until="domcontentloaded")
        try:
            page.fill("input[name=rutcntr]", dotted(body, dv), timeout=15000)
            page.fill("input[name=clave]", clave, timeout=5000)
            page.locator("#bt_ingresar, button[type=submit], input[type=submit]").first.click(timeout=5000)
            page.wait_for_load_state("domcontentloaded")
        except Exception as e:
            print(f"No pude completar el formulario automáticamente ({type(e).__name__}). Ingresa a mano en la ventana.")
            input("Cuando hayas ingresado, presiona Enter aquí… ")
        del clave
        idle(3000)
        cookies = {c["name"] for c in ctx.cookies()}
        if "TOKEN" not in cookies:
            print("No se pudo confirmar el ingreso (sin cookie TOKEN). Revisa la ventana: si el SII muestra un error de clave,"
                  " ciérrala; no reintento para no bloquear la cuenta.")
        if "sismunInternet6" not in page.url:
            page.goto(SERVICE, wait_until="domcontentloaded")

        try:
            auto_download(page, label, idle)
        except Exception as e:
            print(f"La descarga automática se detuvo ({type(e).__name__}: {e}). Puedes seguir a mano en la ventana.")

        print("\nSi falta algo, descárgalo a mano en la ventana: los archivos se guardan solos en:\n  " + FILES)
        print("Cierra la ventana cuando termines.\n")
        label["now"] = "manual"
        try:
            while browser.is_connected() and any(not p.is_closed() for p in ctx.pages):
                idle(1000)
        except KeyboardInterrupt:
            pass
        except Exception:
            pass  # window closed
        try:
            browser.close()
        except Exception:
            pass

    api_log.close()
    print(f"\n{len(saved)} archivo(s) descargado(s) en {FILES}")
    print(f"Registro de llamadas del servicio (sin claves): {os.path.join(OUT, 'api-log.jsonl')}")


if __name__ == "__main__":
    main()
