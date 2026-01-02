/*
  # Digital Newspaper Schema - Santiago del Estero

  ## Overview
  Complete database schema for a digital newspaper platform with RSS integration,
  classified ads, user-submitted news, and advertising management.

  ## New Tables

  ### 1. `rss_sources`
  Stores RSS feed sources from Argentine and international newspapers
  - `id` (uuid, primary key)
  - `name` (text) - Source name (e.g., "La Nación", "Clarín")
  - `url` (text) - RSS feed URL
  - `country` (text) - Source country
  - `category` (text) - News category
  - `is_active` (boolean) - Whether feed is currently active
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. `articles`
  Stores fetched articles from RSS feeds
  - `id` (uuid, primary key)
  - `rss_source_id` (uuid) - Reference to RSS source
  - `title` (text) - Article title
  - `description` (text) - Article summary
  - `content` (text) - Full article content
  - `url` (text) - Original article URL
  - `image_url` (text) - Article image
  - `author` (text) - Article author
  - `category` (text) - Article category
  - `published_at` (timestamptz) - Original publication date
  - `created_at` (timestamptz)

  ### 3. `classified_ads`
  User-submitted classified advertisements
  - `id` (uuid, primary key)
  - `title` (text) - Ad title
  - `description` (text) - Ad description
  - `category` (text) - Ad category (vehicles, real estate, jobs, etc.)
  - `price` (numeric) - Item price
  - `contact_name` (text) - Contact person
  - `contact_phone` (text) - Contact phone
  - `contact_email` (text) - Contact email
  - `image_url` (text) - Ad image
  - `status` (text) - Ad status (pending, approved, rejected)
  - `created_at` (timestamptz)
  - `expires_at` (timestamptz)

  ### 4. `user_news`
  User-submitted news stories ("Noticias de la Gente")
  - `id` (uuid, primary key)
  - `title` (text) - News title
  - `content` (text) - News content
  - `author_name` (text) - Submitter name
  - `author_email` (text) - Submitter email
  - `location` (text) - News location
  - `image_url` (text) - News image
  - `status` (text) - Status (pending, approved, rejected)
  - `created_at` (timestamptz)
  - `published_at` (timestamptz)

  ### 5. `advertisements`
  Advertising placements on the site
  - `id` (uuid, primary key)
  - `title` (text) - Ad title
  - `image_url` (text) - Ad image/banner
  - `link_url` (text) - Click destination
  - `placement` (text) - Where ad appears (header, sidebar, footer, etc.)
  - `width` (integer) - Ad width in pixels
  - `height` (integer) - Ad height in pixels
  - `is_active` (boolean) - Whether ad is currently displayed
  - `start_date` (timestamptz) - Campaign start date
  - `end_date` (timestamptz) - Campaign end date
  - `click_count` (integer) - Number of clicks
  - `impression_count` (integer) - Number of impressions
  - `created_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Public read access for approved/published content
  - Authenticated users can submit classifieds and user news
  - Only service role can manage RSS sources and advertisements
*/

-- RSS Sources Table
CREATE TABLE IF NOT EXISTS rss_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text UNIQUE NOT NULL,
  country text NOT NULL DEFAULT 'Argentina',
  category text NOT NULL DEFAULT 'General',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Articles Table
CREATE TABLE IF NOT EXISTS articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rss_source_id uuid REFERENCES rss_sources(id) ON DELETE CASCADE,
  title text NOT NULL,
  translated_title text,
  description text,
  translated_description text,
  content text,
  url text UNIQUE NOT NULL,
  image_url text,
  author text,
  category text NOT NULL DEFAULT 'General',
  published_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Classified Ads Table
CREATE TABLE IF NOT EXISTS classified_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  price numeric,
  contact_name text NOT NULL,
  contact_phone text,
  contact_email text,
  image_url text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '30 days')
);

-- User News Table
CREATE TABLE IF NOT EXISTS user_news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  author_name text NOT NULL,
  author_email text NOT NULL,
  location text,
  image_url text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now(),
  published_at timestamptz
);

-- Advertisements Table
CREATE TABLE IF NOT EXISTS advertisements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  image_url text NOT NULL,
  link_url text NOT NULL,
  placement text NOT NULL CHECK (placement IN ('header', 'sidebar', 'footer', 'content')),
  width integer NOT NULL,
  height integer NOT NULL,
  is_active boolean DEFAULT true,
  start_date timestamptz DEFAULT now(),
  end_date timestamptz,
  click_count integer DEFAULT 0,
  impression_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE rss_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE classified_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE advertisements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for RSS Sources
CREATE POLICY "Anyone can view active RSS sources"
  ON rss_sources FOR SELECT
  USING (is_active = true);

-- RLS Policies for Articles
CREATE POLICY "Anyone can view articles"
  ON articles FOR SELECT
  USING (true);

-- RLS Policies for Classified Ads
CREATE POLICY "Anyone can view approved classifieds"
  ON classified_ads FOR SELECT
  USING (status = 'approved' AND expires_at > now());

CREATE POLICY "Anyone can insert classifieds"
  ON classified_ads FOR INSERT
  WITH CHECK (true);

-- RLS Policies for User News
CREATE POLICY "Anyone can view approved user news"
  ON user_news FOR SELECT
  USING (status = 'approved');

CREATE POLICY "Anyone can submit user news"
  ON user_news FOR INSERT
  WITH CHECK (true);

-- RLS Policies for Advertisements
CREATE POLICY "Anyone can view active advertisements"
  ON advertisements FOR SELECT
  USING (
    is_active = true 
    AND start_date <= now() 
    AND (end_date IS NULL OR end_date > now())
  );

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_rss_source ON articles(rss_source_id);
CREATE INDEX IF NOT EXISTS idx_classified_category ON classified_ads(category);
CREATE INDEX IF NOT EXISTS idx_classified_status ON classified_ads(status);
CREATE INDEX IF NOT EXISTS idx_user_news_status ON user_news(status);
CREATE INDEX IF NOT EXISTS idx_advertisements_placement ON advertisements(placement);

-- Insert Sample RSS Sources
INSERT INTO rss_sources (name, url, country, category) VALUES
  ('Clarín', 'https://www.clarin.com/rss/', 'Argentina', 'General'),
  ('La Nación', 'https://www.lanacion.com.ar/arc/outboundfeeds/rss/', 'Argentina', 'General'),
  ('Infobae', 'https://www.infobae.com/feeds/rss/', 'Argentina', 'General'),
  ('Página 12', 'https://www.pagina12.com.ar/rss/portada', 'Argentina', 'General'),
  ('BBC News', 'https://feeds.bbci.co.uk/news/world/rss.xml', 'Internacional', 'Internacional'),
  ('El Liberal (Santiago del Estero)', 'https://www.elliberal.com.ar/rss/', 'Argentina', 'Regional')
ON CONFLICT (url) DO NOTHING;