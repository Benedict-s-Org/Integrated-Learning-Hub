-- phonics_mappings: One row = one grapheme→one phoneme mapping
-- Supports duplicates (e.g. "ea" → /ē/ AND "ea" → /ĕ/ as separate rows)
CREATE TABLE IF NOT EXISTS phonics_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grapheme TEXT NOT NULL,                          -- e.g. "ea", "a_e", "ow", "th"
  phoneme TEXT NOT NULL,                           -- e.g. "/ē/", "/ĕ/", "/th/"
  plain_label TEXT,                                -- override label for special cases: "/th/ (voiced)"
  category TEXT NOT NULL DEFAULT 'vowel'           -- vowel | consonant | digraph | blend
    CHECK (category IN ('vowel','consonant','digraph','blend')),
  level INTEGER NOT NULL DEFAULT 1                 -- 1=Beginner, 2=Intermediate, 3=Advanced, 4=Mastery
    CHECK (level BETWEEN 1 AND 4),
  vowel_group TEXT                                 -- nullable; 'a','e','i','o','u' for vowels only
    CHECK (vowel_group IS NULL OR vowel_group IN ('a','e','i','o','u')),
  sort_order INTEGER DEFAULT 0,
  audio_url TEXT,
  examples_real TEXT[] DEFAULT '{}',               -- e.g. {"beach","team","read"}
  examples_nonsense TEXT[] DEFAULT '{}',            -- e.g. {"tream","glea"}
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_phonics_mappings_level_category
  ON phonics_mappings(level, category);
CREATE INDEX IF NOT EXISTS idx_phonics_mappings_phoneme
  ON phonics_mappings(phoneme);

-- RLS
ALTER TABLE phonics_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can read phonics_mappings" ON phonics_mappings;
CREATE POLICY "Everyone can read phonics_mappings"
  ON phonics_mappings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage phonics_mappings" ON phonics_mappings;
CREATE POLICY "Admins can manage phonics_mappings"
  ON phonics_mappings FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'
    )
  );

-- ============================================================
-- SEED DATA
-- Source of Truth: Notion Page (L1-L4)
-- ============================================================

-- Clear existing data to ensure clean state on re-run
TRUNCATE phonics_mappings;

INSERT INTO phonics_mappings (grapheme, phoneme, plain_label, category, level, vowel_group, sort_order) VALUES

-- ============================================================
-- L1 BEGINNER
-- ============================================================

-- === VOWELS: Short ===
('a',   '/ă/', NULL, 'vowel', 1, 'a', 10),
('e',   '/ĕ/', NULL, 'vowel', 1, 'e', 11),
('ea',  '/ĕ/', NULL, 'vowel', 1, 'e', 12),
('i',   '/ĭ/', NULL, 'vowel', 1, 'i', 13),
('y',   '/ĭ/', NULL, 'vowel', 1, 'i', 14),
('ui',  '/ĭ/', NULL, 'vowel', 1, 'i', 15),
('o',   '/ŏ/', NULL, 'vowel', 1, 'o', 16),
('a',   '/ŏ/', NULL, 'vowel', 1, 'o', 17),
('u',   '/ŭ/', NULL, 'vowel', 1, 'u', 18),
('o',   '/ŭ/', NULL, 'vowel', 1, 'u', 19),
('ou',  '/ŭ/', NULL, 'vowel', 1, 'u', 20),
('oo',  '/ŭ/', NULL, 'vowel', 1, 'u', 21),

-- === VOWELS: Silent e ===
('_e',  'Silent e', NULL, 'vowel', 1, 'e', 25), -- Representative button for a_e, e_e, etc. context

-- === VOWELS: Long (Core Forms) ===
('a',   '/ā/', NULL, 'vowel', 1, 'a', 30),
('a_e', '/ā/', NULL, 'vowel', 1, 'a', 31),
('e',   '/ē/', NULL, 'vowel', 1, 'e', 32),
('e_e', '/ē/', NULL, 'vowel', 1, 'e', 33),
('i',   '/ī/', NULL, 'vowel', 1, 'i', 34),
('i_e', '/ī/', NULL, 'vowel', 1, 'i', 35),
('o',   '/ō/', NULL, 'vowel', 1, 'o', 36),
('o_e', '/ō/', NULL, 'vowel', 1, 'o', 37),
('u',   '/ū/', NULL, 'vowel', 1, 'u', 38),
('u_e', '/ū/', NULL, 'vowel', 1, 'u', 39),

-- === CONSONANTS: Core ===
('b', '/b/', NULL, 'consonant', 1, NULL, 100),
('c', '/k/', NULL, 'consonant', 1, NULL, 101),
('d', '/d/', NULL, 'consonant', 1, NULL, 102),
('f', '/f/', NULL, 'consonant', 1, NULL, 103),
('g', '/g/', NULL, 'consonant', 1, NULL, 104),
('h', '/h/', NULL, 'consonant', 1, NULL, 105),
('j', '/j/', NULL, 'consonant', 1, NULL, 106),
('k', '/k/', NULL, 'consonant', 1, NULL, 107),
('l', '/l/', NULL, 'consonant', 1, NULL, 108),
('m', '/m/', NULL, 'consonant', 1, NULL, 109),
('n', '/n/', NULL, 'consonant', 1, NULL, 110),
('p', '/p/', NULL, 'consonant', 1, NULL, 111),
('r', '/r/', NULL, 'consonant', 1, NULL, 112),
('s', '/s/', NULL, 'consonant', 1, NULL, 113),
('t', '/t/', NULL, 'consonant', 1, NULL, 114),
('v', '/v/', NULL, 'consonant', 1, NULL, 115),
('w', '/w/', NULL, 'consonant', 1, NULL, 116),
('y', '/y/', NULL, 'consonant', 1, NULL, 117),
('z', '/z/', NULL, 'consonant', 1, NULL, 118),

-- === CONSONANTS: Common Doubles ===
('bb', '/b/', NULL, 'consonant', 1, NULL, 120),
('dd', '/d/', NULL, 'consonant', 1, NULL, 121),
('ff', '/f/', NULL, 'consonant', 1, NULL, 122),
('gg', '/g/', NULL, 'consonant', 1, NULL, 123),
('ll', '/l/', NULL, 'consonant', 1, NULL, 124),
('mm', '/m/', NULL, 'consonant', 1, NULL, 125),
('nn', '/n/', NULL, 'consonant', 1, NULL, 126),
('pp', '/p/', NULL, 'consonant', 1, NULL, 127),
('rr', '/r/', NULL, 'consonant', 1, NULL, 128),
('ss', '/s/', NULL, 'consonant', 1, NULL, 129),
('tt', '/t/', NULL, 'consonant', 1, NULL, 130),
('zz', '/z/', NULL, 'consonant', 1, NULL, 131),

-- === DIGRAPHS ===
('sh', '/sh/', NULL, 'digraph', 1, NULL, 200),
('ch', '/ch/', NULL, 'digraph', 1, NULL, 201),
('th', '/th/', '/th/ (unvoiced)', 'digraph', 1, NULL, 202), -- Defaulting to unvoiced/voiced pair usually split, but list implies distinct
('th', '/th/', '/th/ (voiced)', 'digraph', 1, NULL, 203),   -- Adding both per user note
('wh', '/wh/', NULL, 'digraph', 1, NULL, 204),
('ck', '/k/',  NULL, 'digraph', 1, NULL, 205),
('ng', '/ng/', NULL, 'digraph', 1, NULL, 206),

-- === BLENDS: L-Blends ===
('bl', '/bl/', NULL, 'blend', 1, NULL, 300),
('cl', '/cl/', NULL, 'blend', 1, NULL, 301),
('fl', '/fl/', NULL, 'blend', 1, NULL, 302),
('gl', '/gl/', NULL, 'blend', 1, NULL, 303),
('pl', '/pl/', NULL, 'blend', 1, NULL, 304),
('sl', '/sl/', NULL, 'blend', 1, NULL, 305),

-- === BLENDS: R-Blends ===
('br', '/br/', NULL, 'blend', 1, NULL, 310),
('cr', '/cr/', NULL, 'blend', 1, NULL, 311),
('dr', '/dr/', NULL, 'blend', 1, NULL, 312),
('fr', '/fr/', NULL, 'blend', 1, NULL, 313),
('gr', '/gr/', NULL, 'blend', 1, NULL, 314),
('pr', '/pr/', NULL, 'blend', 1, NULL, 315),
('tr', '/tr/', NULL, 'blend', 1, NULL, 316),

-- === BLENDS: S-Blends ===
('sc', '/sc/', NULL, 'blend', 1, NULL, 320),
('sk', '/sk/', NULL, 'blend', 1, NULL, 321),
('sm', '/sm/', NULL, 'blend', 1, NULL, 322),
('sn', '/sn/', NULL, 'blend', 1, NULL, 323),
('sp', '/sp/', NULL, 'blend', 1, NULL, 324),
('st', '/st/', NULL, 'blend', 1, NULL, 325),
('sw', '/sw/', NULL, 'blend', 1, NULL, 326),

-- === BLENDS: Final Blends ===
('ft', '/ft/', NULL, 'blend', 1, NULL, 330),
('ld', '/ld/', NULL, 'blend', 1, NULL, 331),
('lf', '/lf/', NULL, 'blend', 1, NULL, 332),
('lk', '/lk/', NULL, 'blend', 1, NULL, 333),
('lp', '/lp/', NULL, 'blend', 1, NULL, 334),
('lt', '/lt/', NULL, 'blend', 1, NULL, 335),
('mp', '/mp/', NULL, 'blend', 1, NULL, 336),
('nd', '/nd/', NULL, 'blend', 1, NULL, 337),
('nk', '/nk/', NULL, 'blend', 1, NULL, 338),
('nt', '/nt/', NULL, 'blend', 1, NULL, 339),
('pt', '/pt/', NULL, 'blend', 1, NULL, 340),
('xt', '/kt/', NULL, 'blend', 1, NULL, 341),


-- ============================================================
-- L2 INTERMEDIATE
-- ============================================================

-- === VOWELS: Long Vowel Teams ===
('ai',  '/ā/', NULL, 'vowel', 2, 'a', 400),
('ay',  '/ā/', NULL, 'vowel', 2, 'a', 401),
('ee',  '/ē/', NULL, 'vowel', 2, 'e', 402),
('ea',  '/ē/', NULL, 'vowel', 2, 'e', 403),
('igh', '/ī/', NULL, 'vowel', 2, 'i', 404),
('y',   '/ī/', NULL, 'vowel', 2, 'i', 405), -- y (final) as long i
('oa',  '/ō/', NULL, 'vowel', 2, 'o', 406),
('ow',  '/ō/', NULL, 'vowel', 2, 'o', 407),
('ew',  '/ū/', NULL, 'vowel', 2, 'u', 408),
('ue',  '/ū/', NULL, 'vowel', 2, 'u', 409),

-- === VOWELS: R-Controlled ===
('ar',  '/ar/', NULL, 'vowel', 2, 'a', 420),
('er',  '/er/', NULL, 'vowel', 2, 'e', 421),
('ir',  '/er/', NULL, 'vowel', 2, 'i', 422),
('ur',  '/er/', NULL, 'vowel', 2, 'u', 423),
('or',  '/or/', NULL, 'vowel', 2, 'o', 424),
('ore', '/or/', NULL, 'vowel', 2, 'o', 425),
('oar', '/or/', NULL, 'vowel', 2, 'o', 426),
('air', '/air/', NULL, 'vowel', 2, 'a', 427),
('are', '/air/', NULL, 'vowel', 2, 'a', 428),

-- === CONSONANTS: Alternates ===
('ph',  '/f/', NULL, 'consonant', 2, NULL, 450),
('gu',  '/g/', NULL, 'consonant', 2, NULL, 451),
('g',   '/j/', NULL, 'consonant', 2, NULL, 452), -- soft g
('c',   '/s/', NULL, 'consonant', 2, NULL, 453), -- soft c

-- === DIGRAPHS: Complex ===
('tch', '/ch/', NULL, 'digraph', 2, NULL, 460),

-- === BLENDS: 3-Letter ===
('scr', '/scr/', NULL, 'blend', 2, NULL, 470),
('shr', '/shr/', NULL, 'blend', 2, NULL, 471),
('spl', '/spl/', NULL, 'blend', 2, NULL, 472),
('spr', '/spr/', NULL, 'blend', 2, NULL, 473),
('str', '/str/', NULL, 'blend', 2, NULL, 474),
('thr', '/thr/', NULL, 'blend', 2, NULL, 475),

-- === BLENDS/PATTERNS: Silent/Advanced ===
('kn', '/n/', NULL, 'blend', 2, NULL, 480),
('wr', '/r/', NULL, 'blend', 2, NULL, 481),
('mb', '/m/', NULL, 'blend', 2, NULL, 482),


-- ============================================================
-- L3 ADVANCED
-- ============================================================

-- === VOWELS: Diphthongs ===
('oi', '/oi/', NULL, 'vowel', 3, 'o', 500),
('oy', '/oi/', NULL, 'vowel', 3, 'o', 501),
('ou', '/ou/', NULL, 'vowel', 3, 'o', 502),
('ow', '/ou/', NULL, 'vowel', 3, 'o', 503),
('aw', '/aw/', NULL, 'vowel', 3, 'a', 504),
('au', '/aw/', NULL, 'vowel', 3, 'a', 505),

-- === VOWELS: OO Pair ===
('oo', '/uː/', '/uː/ (long oo)', 'vowel', 3, 'o', 510),
('oo', '/ʊ/',  '/ʊ/ (short oo)', 'vowel', 3, 'o', 511),

-- === VOWELS: Complex Patterns ===
('eigh', '/ā/', NULL, 'vowel', 3, 'e', 520),
('augh', '/aw/', NULL, 'vowel', 3, 'a', 521),
('ough', 'ough', NULL, 'vowel', 3, 'o', 522), -- Many sounds, generalized

-- === VOWELS: Schwa ===
('a', '/ə/', NULL, 'vowel', 3, 'a', 530),
('e', '/ə/', NULL, 'vowel', 3, 'e', 531),
('i', '/ə/', NULL, 'vowel', 3, 'i', 532),
('o', '/ə/', NULL, 'vowel', 3, 'o', 533),
('u', '/ə/', NULL, 'vowel', 3, 'u', 534),

-- === CONSONANTS: Advanced ===
('gh', '/f/', NULL, 'consonant', 3, NULL, 550), -- laugh
('gh', '/g/', NULL, 'consonant', 3, NULL, 551), -- ghost
('ti', '/sh/', NULL, 'consonant', 3, NULL, 552),
('ci', '/sh/', NULL, 'consonant', 3, NULL, 553),
('si', '/sh/', NULL, 'consonant', 3, NULL, 554),
('ssi', '/sh/', NULL, 'consonant', 3, NULL, 555),
('sci', '/sh/', NULL, 'consonant', 3, NULL, 556),
('tu',  '/ch/', NULL, 'consonant', 3, NULL, 557),
('ture', '/ch/', NULL, 'consonant', 3, NULL, 558),

-- === PATTERNS: Silent Families ===
('alf', '/af/', NULL, 'blend', 3, NULL, 570),
('alm', '/am/', NULL, 'blend', 3, NULL, 571),
('alk', '/ak/', NULL, 'blend', 3, NULL, 572),
('gn',  '/n/',  NULL, 'blend', 3, NULL, 573),
('gm',  '/m/',  NULL, 'blend', 3, NULL, 574),
('sten', '/sn/', NULL, 'blend', 3, NULL, 575),
('stle', '/sl/', NULL, 'blend', 3, NULL, 576),
('igh', '/ī/',  NULL, 'blend', 3, NULL, 577),


-- ============================================================
-- L4 MASTERY
-- ============================================================

-- === SUFFIX / ENDING PATTERNS ===
('tion', '/shən/', NULL, 'digraph', 4, NULL, 600),
('sion', '/zhən/', NULL, 'digraph', 4, NULL, 601),
('ture', '/chər/', NULL, 'digraph', 4, NULL, 602),
('cian', '/shən/', NULL, 'digraph', 4, NULL, 603),
('ous',  '/əs/',   NULL, 'digraph', 4, NULL, 604),
('ious', '/iəs/',  NULL, 'digraph', 4, NULL, 605),

-- === GREEK/LATIN ROOTS (Morphemes) ===
('tele',  'Root', 'tele (far)',   'consonant', 4, NULL, 620),
('graph', 'Root', 'graph (write)', 'consonant', 4, NULL, 621),
('bio',   'Root', 'bio (life)',    'consonant', 4, NULL, 622),
('phon',  'Root', 'phon (sound)',  'consonant', 4, NULL, 623),
('auto',  'Root', 'auto (self)',   'consonant', 4, NULL, 624),
('hydro', 'Root', 'hydro (water)', 'consonant', 4, NULL, 625),
('geo',   'Root', 'geo (earth)',   'consonant', 4, NULL, 626),
('photo', 'Root', 'photo (light)', 'consonant', 4, NULL, 627),
('scope', 'Root', 'scope (see)',   'consonant', 4, NULL, 628),
('meter', 'Root', 'meter (measure)', 'consonant', 4, NULL, 629)

ON CONFLICT DO NOTHING;
