-- SII catastro (Detalle Catastral), one row per SII manzana, for rol search and the rol card.
-- Loaded by pipeline/catastro_rol_upload.py with the secret key; read only by the server (/api/rol).
-- Arrays are parallel: element i describes predio pr[i]. No owner data: the SII file has none.
create table if not exists public.catastro_mz (
  sii   int  not null,           -- SII comuna code (not CUT; Santiago has three)
  cut   int  not null,           -- CUT comuna code used by the map
  mz    int  not null,           -- manzana
  pr    int[]  not null,         -- predio
  lon   real[] not null,         -- null where the rol could not be located
  lat   real[] not null,
  how   text   not null,         -- one char per predio: e exact address, n nearby number, m manzana, - none
  dir   text[] not null,         -- SII address text
  ds    text   not null,         -- one char per predio: destino (H homes, Z parking, L storage, C, O, ...)
  m2    int[]  not null,         -- built m² (sum of the rol's construction lines)
  yr    int[]  not null,         -- year built (0 unknown)
  av    int[]  not null,         -- avalúo fiscal, UF
  semester text not null default '2026-2',
  primary key (sii, mz)
);
create index if not exists catastro_mz_mz on public.catastro_mz (mz, cut);
alter table public.catastro_mz enable row level security;  -- no policies: only service_role reads it
grant all on public.catastro_mz to service_role;
revoke all on public.catastro_mz from anon, authenticated;
