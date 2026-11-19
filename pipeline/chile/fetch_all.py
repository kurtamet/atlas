"""Run both Chile-side downloaders. Usage (from the atlas folder):  python3 pipeline/chile/fetch_all.py"""
import fetch_cead, fetch_sinca
from common import ROOT

if __name__ == "__main__":
    for mod in (fetch_sinca, fetch_cead):
        try:
            mod.main()
        except Exception as e:  # keep going so one site's failure doesn't block the other
            print(f"{mod.__name__} failed: {e}")
    print(f"\nListo. Archivos en: {ROOT}")
