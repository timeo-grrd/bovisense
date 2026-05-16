-- ============================================================
-- BoviSense — Données de démonstration
-- À exécuter APRÈS schema.sql dans : Supabase Dashboard > SQL Editor
--
-- IMPORTANT : Créez d'abord le compte de démo via le dashboard Supabase
--   Authentication > Users > "Add user"
--   Email    : jean-yves@bovisense.fr
--   Password : Demo1234!
-- Notez l'UUID généré et remplacez DEMO_USER_UUID ci-dessous.
-- ============================================================

-- Si vous préférez créer l'utilisateur en SQL (nécessite le role service_role) :
-- REMPLACEZ 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' par l'UUID réel obtenu via le dashboard.

DO $$
DECLARE
  demo_user_id UUID := '9250f33c-88e5-4411-afff-6c88ae41741c'; -- ← REMPLACEZ PAR VOTRE UUID
BEGIN

  -- 1. Profil éleveur
  INSERT INTO public.profiles (id, nom, prenom, exploitation, telephone)
  VALUES (
    demo_user_id,
    'Dupont',
    'Jean-Yves',
    'GAEC des Prés Verts',
    '06 98 76 54 32'
  )
  ON CONFLICT (id) DO UPDATE
    SET nom = EXCLUDED.nom,
        prenom = EXCLUDED.prenom,
        exploitation = EXCLUDED.exploitation,
        telephone = EXCLUDED.telephone;

  -- 2. Vétérinaire
  INSERT INTO public.veterinaires (user_id, nom, prenom, telephone, adresse, latitude, longitude)
  VALUES (
    demo_user_id,
    'Martin',
    'Sophie',
    '06 12 34 56 78',
    '12 Rue des Champs, 35000 Rennes',
    48.1173,
    -1.6778
  );

  -- 3. Vaches avec états variés
  -- V-045 : Urgence Chute
  INSERT INTO public.colliers (
    user_id, id_vache, nom_vache, numero_vache,
    latitude, longitude, etat_sante,
    pas_2h, repos_min_2h, temp_corp_c, temp_ext_c
  ) VALUES (
    demo_user_id, 'V-045', 'Marguerite', '9845',
    48.0712, -1.6325, 'Chute',
    12, 115, 39.8, 14.0
  );

  -- V-118 : Boiterie sévère
  INSERT INTO public.colliers (
    user_id, id_vache, nom_vache, numero_vache,
    latitude, longitude, etat_sante,
    pas_2h, repos_min_2h, temp_corp_c, temp_ext_c
  ) VALUES (
    demo_user_id, 'V-118', 'Fleurette', '9918',
    48.0730, -1.6300, 'Boiterie_Severe',
    180, 95, 39.2, 14.0
  );

  -- V-023 : Saine
  INSERT INTO public.colliers (
    user_id, id_vache, nom_vache, numero_vache,
    latitude, longitude, etat_sante,
    pas_2h, repos_min_2h, temp_corp_c, temp_ext_c
  ) VALUES (
    demo_user_id, 'V-023', 'Brunette', '9823',
    48.0690, -1.6350, 'Saine',
    520, 58, 38.5, 14.0
  );

  -- V-067 : Saine
  INSERT INTO public.colliers (
    user_id, id_vache, nom_vache, numero_vache,
    latitude, longitude, etat_sante,
    pas_2h, repos_min_2h, temp_corp_c, temp_ext_c
  ) VALUES (
    demo_user_id, 'V-067', 'Rosette', '9867',
    48.0750, -1.6280, 'Saine',
    490, 62, 38.4, 14.0
  );

  -- V-091 : Chaleurs
  INSERT INTO public.colliers (
    user_id, id_vache, nom_vache, numero_vache,
    latitude, longitude, etat_sante,
    pas_2h, repos_min_2h, temp_corp_c, temp_ext_c
  ) VALUES (
    demo_user_id, 'V-091', 'Violette', '9891',
    48.0700, -1.6310, 'Chaleurs',
    980, 25, 38.9, 14.0
  );

END $$;
