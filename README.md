# Atlas Chile

Интерактивный атлас Чили (старт: Сантьяго) для выбора недвижимости: слои среды, инфраструктуры, экологии, безопасности и стоимости по масштабам, карточка места, поиск по адресу или критериям, бесплатный тизер и платный AI-отчёт.

Спецификация слоёв и моделей: `chile_atlas_layers_models_v0_1.md` (в папке проекта). План и архитектура: документ «Atlas Chile — архитектура и план v0.1».

## Этап 0 (эта версия)

- Next.js 16 (App Router, TypeScript), i18n ES (по умолчанию) / EN через `next-intl`.
- Дизайн из HTML-концепта (`src/app/concept.css`), без регулятора прозрачности.
- Карта MapLibre GL: подложка OpenFreeMap (OSM) в палитре концепта, контур Чили, 32 коммуны Сантьяго, расчётные зоны ~600 м.
- **Реестр слоёв** `src/lib/layers/registry.ts`: шесть семейств, показатели с ID из спецификации, родные уровни (N/C/D/B/O), фиксированные шкалы.
- **Правило приоритета** `src/lib/layers/priority.ts`: на текущем zoom закрашивается родной уровень показателя; более крупный уровень остаётся контуром; если детальнее данных нет, остаётся крупный уровень с пометкой «dato a nivel comuna». Интенсивность заливки = значение по единой шкале.
- **Поиск** `src/lib/search/parse.ts`: ссылка / коммуна / критерии по словарю ES+EN / адрес (геокодер Photon). Без LLM.
- Карточка места: все показатели с указанием уровня данных, вкладка источников.

**Значения слоёв в этой версии синтетические** (`scripts/build-demo-data.mts`); геометрия коммун реальная. Реальные данные приходят на этапе 1.

## Запуск

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # vitest: правило приоритета и парсер поиска
npm run data:demo  # пересобрать демо-данные в public/data
```

## Данные (этап 1)

Пайплайн в `pipeline/`, результаты в `public/data/`. Сырые файлы в git не кладутся.

| Слой | Скрипт | Источник |
|---|---|---|
| EC02 цена сделок, коммуна | `prices_f2890.py` | SII F2890 (sii.cl/destacados/transparencia) + UF с sii.cl (`pipeline/uf_daily.csv`) |
| IN04 транспорт, зоны и коммуны | `transit_gtfs.py` | DTPM GTFS (dtpm.cl/index.php/gtfs-vigente) |
| Веса заселённости зон | `zone_weights.py` | Overture buildings, `s3://overturemaps-us-west-2/release/<release>/theme=buildings/type=building/` (pyarrow, фильтр по bbox) |

### Здания и кадастр

- `pipeline/buildings_tiles.py`: контуры зданий Overture (OSM + Microsoft + Google, ~1,47 млн для Gran Santiago) → `buildings-stgo.pmtiles` (z15, ~25 MB), загружается в Supabase Storage (публичный bucket `tiles`). Карта читает его через протокол `pmtiles://`, а без Supabase показывает здания из базовой карты.
- `pipeline/chile/fetch_catastro.py`: запускается на своём компьютере. Спрашивает RUT и clave, входит на SII в окне Chromium и сохраняет файлы Detalle Catastral в `data-chile/catastro/files/`. Вызовы сервиса (без секретов) пишет в `api-log.jsonl`.
