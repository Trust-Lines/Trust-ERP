-- 133: Design library — Asset Library, Brand Kits, Materials & Finishes (+ a job's materials).
--
-- Files stay in Dropbox (under /Design/Library, /Design/Brand Kits, /Design/Materials); these
-- tables only index them. Customer Reviews needs no table (it reads approval_links).
--
-- Additive only: new tables, nothing existing is changed. RLS on with no policies — only the
-- service-role API routes, which run their own permission checks, touch them (117 pattern).
-- Safe to run more than once.

-- ── Asset Library: reusable templates, CAD blocks, renders, standard details ──
create table if not exists public.design_assets (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null default 'other'
               check (kind in ('template', 'cad_block', 'render', 'detail', 'other')),
  title        text not null,
  description  text,
  tags         text[] not null default '{}',
  dropbox_path text not null,
  file_name    text not null,
  size_bytes   bigint,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index if not exists design_assets_kind_idx on public.design_assets (kind) where deleted_at is null;
alter table public.design_assets enable row level security;

-- ── Brand Kits: one per customer brand (logo, colours, fonts, guidelines) ──
create table if not exists public.design_brand_kits (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  prospect_id         uuid references public.prospects(id) on delete set null,
  colors              jsonb not null default '[]'::jsonb,   -- [{ "name": "Primary", "hex": "#0A2540" }]
  fonts               text[] not null default '{}',
  guidelines          text,
  dropbox_folder_path text,
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);
create index if not exists design_brand_kits_prospect_idx on public.design_brand_kits (prospect_id) where deleted_at is null;
alter table public.design_brand_kits enable row level security;

-- ── Materials & Finishes catalogue ──
create table if not exists public.design_materials (
  id            uuid primary key default gen_random_uuid(),
  category      text not null default 'other'
                check (category in ('laminate', 'paint', 'wood', 'metal', 'fabric', 'stone', 'glass', 'acrylic', 'lighting', 'other')),
  name          text not null,
  code          text,
  supplier_id   uuid references public.suppliers(id) on delete set null,
  supplier_name text,
  finish        text,
  color_hex     text,
  unit          text,
  price         numeric(12, 2),
  currency      text not null default 'USD',
  image_path    text,
  notes         text,
  is_active     boolean not null default true,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index if not exists design_materials_category_idx on public.design_materials (category) where deleted_at is null;
alter table public.design_materials enable row level security;

-- ── Materials picked for a design job (what Supply will order) ──
create table if not exists public.design_job_materials (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.sales_design_jobs(id) on delete cascade,
  material_id uuid not null references public.design_materials(id) on delete cascade,
  area        text,          -- where it goes: "Counter top", "Back wall"…
  quantity    numeric(12, 2),
  note        text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (job_id, material_id, area)
);
create index if not exists design_job_materials_job_idx on public.design_job_materials (job_id);
alter table public.design_job_materials enable row level security;
