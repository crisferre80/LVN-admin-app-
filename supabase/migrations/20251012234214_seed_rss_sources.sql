-- Seed RSS sources for national and international newspapers

-- National (Argentina)
INSERT INTO rss_sources (name, url, country, category) VALUES
('Clarín', 'https://www.clarin.com/rss/lo-ultimo/', 'Argentina', 'General'),
('La Nación', 'https://www.lanacion.com.ar/arc/outboundfeeds/rss/?outputType=xml', 'Argentina', 'General'),
('Página 12', 'https://www.pagina12.com.ar/rss/portada', 'Argentina', 'General'),
('Infobae', 'https://www.infobae.com/rss.xml', 'Argentina', 'General'),
('El Cronista', 'https://www.cronista.com/rss/', 'Argentina', 'Business'),
('Ámbito Financiero', 'https://www.ambito.com/rss/portada.xml', 'Argentina', 'Business'),
('Télam', 'https://www.telam.com.ar/rss2/ultimasnoticias.xml', 'Argentina', 'General'),
('El País (Argentina)', 'https://elpais.com/rss/elpais/portada.xml', 'Argentina', 'General'),
('Perfil', 'https://www.perfil.com/rss/portada', 'Argentina', 'General'),
('La Voz del Interior', 'https://www.lavoz.com.ar/rss.xml', 'Argentina', 'General'),
('El Tribuno', 'https://www.eltribuno.com/rss/portada', 'Argentina', 'regionales'),
('Nuevo Diario', 'https://www.nuevodiario.com/rss/portada', 'Argentina', 'regionales'),
('El Liberal', 'https://www.elliberal.com.ar/rss/portada', 'Argentina', 'regionales'),
('El Ancasti', 'https://www.elancasti.com.ar/rss/portada', 'Argentina', 'regionales'),
('El Esquiú', 'https://www.elesquiu.com/rss/portada', 'Argentina', 'regionales'),
('La Gaceta (Tucumán)', 'https://www.lagaceta.com.ar/rss/portada', 'Argentina', 'regionales'),
('El Intransigente (Salta)', 'https://www.elintransigente.com/rss/portada', 'Argentina', 'regionales')
ON CONFLICT (url) DO NOTHING;

-- International
INSERT INTO rss_sources (name, url, country, category) VALUES
('BBC News', 'https://feeds.bbci.co.uk/news/rss.xml', 'United Kingdom', 'General'),
('CNN', 'https://rss.cnn.com/rss/edition.rss', 'United States', 'General'),
('Reuters', 'https://feeds.reuters.com/Reuters/worldNews', 'United States', 'World'),
('The Guardian', 'https://www.theguardian.com/world/rss', 'United Kingdom', 'World'),
('The New York Times', 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', 'United States', 'World'),
('Al Jazeera', 'https://www.aljazeera.com/xml/rss/all.xml', 'Qatar', 'World'),
('DW (Deutsche Welle)', 'https://rss.dw.com/xml/rss-en-world', 'Germany', 'World'),
('France 24', 'https://www.france24.com/en/rss', 'France', 'World'),
('El País (Spain)', 'https://feeds.elpais.com/mrss-feeds/elpais/portada.xml', 'Spain', 'World'),
('BBC Mundo', 'https://feeds.bbci.co.uk/mundo/rss.xml', 'United Kingdom', 'World'),
('RT (Russia Today)', 'https://www.rt.com/rss/', 'Russia', 'World'),
('Associated Press', 'https://feeds.apnews.com/rss/apf-topnews', 'United States', 'General'),
('NPR', 'https://feeds.npr.org/1001/rss.xml', 'United States', 'General'),
('The Washington Post', 'https://feeds.washingtonpost.com/rss/world', 'United States', 'World'),
('The Wall Street Journal', 'https://feeds.a.dj.com/rss/RSSWorldNews.xml', 'United States', 'Business')
ON CONFLICT (url) DO NOTHING;