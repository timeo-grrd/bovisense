CREATE TABLE IF NOT EXISTS historique_sante (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  collier_id UUID REFERENCES colliers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  id_vache TEXT NOT NULL,
  etat_sante TEXT NOT NULL,
  fiabilite_ia FLOAT,
  pas_2h INT,
  repos_min_2h INT,
  temp_corp_c FLOAT,
  temp_ext_c FLOAT,
  date_diagnostic TIMESTAMP DEFAULT NOW()
);
ALTER TABLE historique_sante ENABLE ROW LEVEL SECURITY;
CREATE POLICY "historique_select" ON historique_sante FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "historique_insert" ON historique_sante FOR INSERT WITH CHECK (auth.uid() = user_id);
