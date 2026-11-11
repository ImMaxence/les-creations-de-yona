-- Six more title fonts, six more text fonts, and a color theme chosen by hand ("Personnalisé"),
-- whose colors are kept as JSON (light and dark, four each). Saved looks keep theirs too.
ALTER TABLE site_theme DROP CONSTRAINT site_theme_preset_check;
ALTER TABLE site_theme ADD CONSTRAINT site_theme_preset_check CHECK (preset IN (
    'PATISSERIE_CHIC', 'TERRACOTTA', 'PISTACHE', 'MYRTILLE', 'CARAMEL',
    'FRAMBOISE', 'LAVANDE', 'MENTHE', 'CITRON', 'CHOCOLAT', 'CERISE', 'AMANDE', 'BLEUET', 'ABRICOT', 'FIGUE',
    'NEON', 'ART_DECO', 'LAGON', 'BONBON', 'AURORE', 'PERSONNALISE'));
ALTER TABLE site_theme DROP CONSTRAINT site_theme_display_font_check;
ALTER TABLE site_theme ADD CONSTRAINT site_theme_display_font_check CHECK (display_font IN (
    'FRAUNCES', 'PLAYFAIR_DISPLAY', 'CORMORANT_GARAMOND', 'DANCING_SCRIPT', 'QUICKSAND',
    'BODONI_MODA', 'CINZEL', 'EB_GARAMOND', 'CAVEAT', 'COMFORTAA',
    'UNBOUNDED', 'SYNE', 'FREDOKA', 'JOSEFIN_SANS', 'KALNIA',
    'BRICOLAGE_GROTESQUE', 'NEWSREADER', 'SHANTELL_SANS', 'GRANDSTANDER', 'IMBUE', 'PLAYPEN_SANS'));
ALTER TABLE site_theme DROP CONSTRAINT site_theme_body_font_check;
ALTER TABLE site_theme ADD CONSTRAINT site_theme_body_font_check CHECK (body_font IN (
    'INTER', 'NUNITO', 'DM_SANS', 'SOURCE_SANS_3', 'LORA',
    'OPEN_SANS', 'MONTSERRAT', 'WORK_SANS', 'MANROPE', 'MERRIWEATHER',
    'RALEWAY', 'RUBIK', 'OUTFIT', 'FIGTREE', 'CRIMSON_PRO', 'BITTER'));

ALTER TABLE site_theme ADD COLUMN custom_colors text CHECK (char_length(custom_colors) <= 2000);
ALTER TABLE appearance_preset ADD COLUMN custom_colors text CHECK (char_length(custom_colors) <= 2000);
