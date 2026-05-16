-- ============================================================
-- BoviSense — Schéma de base de données Supabase
-- À exécuter dans : Supabase Dashboard > SQL Editor
-- ============================================================

-- Table profils éleveurs (liée à auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nom         TEXT,
  prenom      TEXT,
  exploitation TEXT,
  telephone   TEXT,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table vétérinaires
CREATE TABLE IF NOT EXISTS public.veterinaires (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  nom        TEXT NOT NULL,
  prenom     TEXT,
  telephone  TEXT NOT NULL,
  adresse    TEXT,
  latitude   FLOAT,
  longitude  FLOAT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table colliers / capteurs IoT
CREATE TABLE IF NOT EXISTS public.colliers (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  id_vache     TEXT NOT NULL,
  nom_vache    TEXT,
  numero_vache TEXT,
  latitude     FLOAT  DEFAULT 48.0712,
  longitude    FLOAT  DEFAULT -1.6325,
  etat_sante   TEXT   DEFAULT 'Saine',
  derniere_maj TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  pas_2h       INT    DEFAULT 500,
  repos_min_2h INT    DEFAULT 60,
  temp_corp_c  FLOAT  DEFAULT 38.5,
  temp_ext_c   FLOAT  DEFAULT 15.0,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- Sécurité : Row Level Security (RLS)
-- ============================================================

ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.veterinaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colliers    ENABLE ROW LEVEL SECURITY;

-- Profiles : lecture et mise à jour du profil propre
CREATE POLICY "profil_select_own"  ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profil_insert_own"  ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profil_update_own"  ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Vétérinaires : CRUD sur ses propres vétérinaires
CREATE POLICY "veto_select_own"  ON public.veterinaires
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "veto_insert_own"  ON public.veterinaires
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "veto_update_own"  ON public.veterinaires
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "veto_delete_own"  ON public.veterinaires
  FOR DELETE USING (auth.uid() = user_id);

-- Colliers : CRUD sur ses propres colliers
CREATE POLICY "collier_select_own"  ON public.colliers
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "collier_insert_own"  ON public.colliers
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "collier_update_own"  ON public.colliers
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "collier_delete_own"  ON public.colliers
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- Trigger : création automatique du profil à l'inscription
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
