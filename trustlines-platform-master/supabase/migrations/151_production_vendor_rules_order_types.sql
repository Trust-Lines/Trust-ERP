-- 151_production_vendor_rules_order_types.sql — what the Production tracker's Vendor and Order
-- Type cells need, as on the Trust System Projects board.
--
-- 1. suppliers.fixed_millwork_codes — the vendor setting "Millwork PF code by order type"
--    (STANDARD / BASIC → M01, STANDARD / SELECTIVE → M02, CUSTOM / SELECTIVE → M03, others M04+).
--    Set for the vendors that have it in the Trust System (read 2026-11-12: EMC, GOS, KYA, TDR, YSM).
-- 2. production_order_types — the Order Type list (Trust System's list, read 2026-11-12, plus the
--    values already used on T-ERP rows). New ones are added from the Order Type cell.
--
-- Additive; safe to run more than once.

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS fixed_millwork_codes BOOLEAN NOT NULL DEFAULT false;
UPDATE suppliers SET fixed_millwork_codes = true
 WHERE upper(code) IN ('EMC', 'GOS', 'KYA', 'TDR', 'YSM') AND fixed_millwork_codes = false;

CREATE TABLE IF NOT EXISTS production_order_types (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  trust_id   TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS production_order_types_name_key ON production_order_types (upper(btrim(name)));

ALTER TABLE production_order_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS production_order_types_select ON production_order_types;
CREATE POLICY production_order_types_select ON production_order_types
  FOR SELECT TO authenticated USING (
    NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'tlines_pm')
  );

INSERT INTO production_order_types (name, trust_id) VALUES
  ('ac', 'cmnoa3pkw08f0unov8l3u026k'),
  ('al', 'cmw4xq5yf000z1245gtqjohsj'),
  ('BAFFLE SISTEM', 'cmm34dard010o6wgs3qfwrp9d'),
  ('base', 'cmmbo4oi900agunovf2bewyee'),
  ('BC METAL', 'cmw0pergy0008xmnh3zc1proo'),
  ('BC SAMPLES', 'cmra9bk7s01r5qfbf9odzu59p'),
  ('BOX', 'cmm36lkza018z6wgsyga716sf'),
  ('CARPETS', 'cmunv0b4e00w8t8fp1iycubij'),
  ('CEILING FIXTURE', 'cmv7xty0x004ed36q23dpf2g2'),
  ('CEILING ITEMS', 'cmm1rwu7u007ajb9ga7d40vlm'),
  ('CEILING SYSTEMS', 'cmn31qlod051munovql1rggpn'),
  ('CHANDELIER', 'cmm1pkv61000xjb9gnrk604am'),
  ('CHANDELIER STICKER', 'cmmc0sf1a00fnunovov2uz253'),
  ('CHANGE ORDER', 'cmrkmzbl0003rntajgddy0x4i'),
  ('CIRCLE TABLE', 'cmv9mjpfh0007oma7m4fd5dgv'),
  ('cos', 'cmvjgxhds000f83twfkqixcms'),
  ('CURTAİNS', 'cmrvv4xe401vuntaj8cnz541q'),
  ('CUSTOM / SELECTIVE', 'cmm1mob93001ursm40ocif6ba'),
  ('CUSTOM ITEMS', 'cmma860fi000b14cj83ryz06z'),
  ('del', 'cmv9kcwsh001y11vnzn82qkwn'),
  ('DELIVERY', 'cmsrhq30m0a2xntaj7n3qomwk'),
  ('DRIVER', 'cmm36lyaf01956wgseyqmuaeg'),
  ('FABRIC', 'cmpgm6u25000jytsl4d6ahp9n'),
  ('FLOWERS', 'cmn745p8o05ynunova12ksn1x'),
  ('FUR', 'cmvyztnm5000gfva3zq9xy7ho'),
  ('FURNITURE', 'cmm1mm83m001irsm48fsmasld'),
  ('GLASS', 'cmuv2aov303tzt8fpnrouxwdw'),
  ('GOS', 'cmu8gi2bm014x13jzm2xrij9w'),
  ('IMAGE', 'cmm4g6fye00lqewxqmxaplep2'),
  ('kitchen', 'cmqavb158061pp2ufklggwjau'),
  ('LED', 'cmrkmskio003mntajrbq6hosv'),
  ('LETTER BOX', 'cmm1pn9oo001qjb9g5xdxgd6u'),
  ('LETTER BOX EXTERIOR', 'cmm3h19wk0046ewxquzp2df39'),
  ('LIGHTBOX', 'cmnyqv9os09ncunovrmwjcn72'),
  ('LIGHTBOX PRINT', 'cmo1gvkje09x2unov4sdvf8o9'),
  ('LIGHTING SYSTEMS,', 'cmn34hahz0557unovthdib98v'),
  ('MAIN CARRIER', 'cmv7xt6p1001912b9cm4ae11o'),
  ('MESH', 'cmn7461lq05z0unovuys148f9'),
  ('METAL ACC.', 'cmnoa3zhm08f4unovi38yowkk'),
  ('METAL PANEL', 'cmvtv6xes001v3gzqxxwd9d42'),
  ('METAL SHELVING', 'cmmkeyjda01fuunovd2kwh7xw'),
  ('METAL SHELVING DECORATION', 'cmv7xemso000xshte2b5bxqef'),
  ('METAL/LIGHTING FIXTURES', 'cmumdyob702zuhncpiu9dt44z'),
  ('MILLWORK', 'cmm1pni5k001wjb9gix59gk2m'),
  ('MILLWORK ACC.', 'cmoqut07w02hdnfl7cpjoebvt'),
  ('MILLWORK ITEMS', 'cmpfabj5a0052faq31ea2kmk5'),
  ('PACKAGING BOX', 'cmo1j144k0a27unovidgma1oo'),
  ('PENDANT LIGHT', 'cmsxato0k0cfbntajq4n0obes'),
  ('PLANT', 'cmm1mrr03002irsm4m2sv1vym'),
  ('PLEXI LETTERS', 'cmo1h71fr0a0punov2438zp62'),
  ('PLEXI WITH STICKER', 'cmmc0syks00fvunovm43iyr6o'),
  ('PRINTED ITEMS', 'cmn368phg059zunov42ka2vin'),
  ('PVC', 'cmsrf53gh09znntaj23nuaig5'),
  ('RESTROOM', 'cmv7vrhty000m3m9p1jde372b'),
  ('SCREENS', 'cmsj1f4tk07tontajkktjxz1a'),
  ('SELECTIVE / CUSTOM', 'cmm1rrxgo000j124y4v555xsm'),
  ('SHELVING ACCESORIES', 'cmm1mha0m0015rsm4vqjym9k4'),
  ('SHELVING DECORATION', 'cmmkexgsz01feunov0xmu4put'),
  ('SIGN', 'cmn36598d0587unovkqv2d4io'),
  ('SIGNAGE', 'cmpgktk3h006p13kg9avsj5y0'),
  ('SIGNS', 'cmpe5dkwu00bnnab5vndr3hpd'),
  ('STANDARD / BASIC', 'cmm1mfp24000prsm4gybj8ilg'),
  ('STANDARD / SELECTIVE', 'cmm1mgmqd000zrsm4y3ru2a42'),
  ('STANDARD ITEMS / BASIC COLORS', NULL),
  ('STICKER', 'cmm36l5zx018r6wgseovmnxpn'),
  ('TABLE', 'cmvl37b1f000rceodgx77569j'),
  ('TEKSTIL BOX', 'cmm1pujve003ojb9gcsi16lcc'),
  ('Titanum', 'cmm30v94500jg6wgs7zd8qkxq'),
  ('WALL PANELS', 'cmp3wppat012mzftevq6pknoh'),
  ('WALLPAPER', 'cmm1po9vg0024jb9glwemi6qr'),
  ('WIRES FOR BAFFLES', 'cmuwer63g04j2t8fpf2ylkyii'),
  ('WOODEN STRUCTURE SYSTEM', 'cmpe5l8af00d6nab5yoyzdjn4')
ON CONFLICT (upper(btrim(name))) DO NOTHING;
