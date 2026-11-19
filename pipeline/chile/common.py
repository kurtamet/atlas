"""Shared helpers for the Chile-side downloaders (stdlib only, run on a machine in Chile)."""
import json, os, ssl, sys, time, urllib.parse, urllib.request

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data-chile"))
_CTX = ssl.create_default_context()
try:  # macOS python.org builds sometimes lack root certs; fall back to certifi if present
    import certifi  # type: ignore
    _CTX = ssl.create_default_context(cafile=certifi.where())
except Exception:
    pass


def out(*parts):
    p = os.path.join(ROOT, *parts)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    return p


def log(source, msg):
    line = f"{time.strftime('%H:%M:%S')} {msg}"
    print(f"[{source}] {line}")
    with open(out(source, "log.txt"), "a", encoding="utf-8") as f:
        f.write(line + "\n")


def fetch(url, data=None, headers=None, timeout=60, retries=2):
    """GET (or POST when data is a dict). Returns (status, bytes, final_url); never raises."""
    body = urllib.parse.urlencode(data, doseq=True).encode() if isinstance(data, dict) else data
    h = {"User-Agent": UA, "Accept": "*/*", "Accept-Language": "es-CL,es;q=0.9"}
    h.update(headers or {})
    for i in range(retries + 1):
        try:
            req = urllib.request.Request(url, data=body, headers=h)
            with urllib.request.urlopen(req, timeout=timeout, context=_CTX) as r:
                return r.status, r.read(), r.geturl()
        except urllib.error.HTTPError as e:
            return e.code, e.read() or b"", url
        except Exception as e:  # network, TLS, timeout
            if i == retries:
                return 0, str(e).encode(), url
            time.sleep(2 * (i + 1))
    return 0, b"", url


def save(path, data):
    with open(path, "wb") as f:
        f.write(data)
