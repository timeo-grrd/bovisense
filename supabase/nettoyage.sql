-- Supprime les entrées normales de plus de 7 jours
-- Les alertes confirmées et les états graves restent indéfiniment (mémoire médicale)
CREATE OR REPLACE FUNCTION nettoyer_historique()
RETURNS void AS $$
BEGIN
  DELETE FROM historique_sante
  WHERE date_diagnostic < NOW() - INTERVAL '7 days'
    AND confirme = false
    AND etat_sante NOT IN ('Chute', 'Boiterie_Severe', 'Boiterie sévère');
END;
$$ LANGUAGE plpgsql;

-- Appel manuel : SELECT nettoyer_historique();

-- Nettoyage quotidien via pg_cron (activer l'extension dans Supabase Dashboard si disponible) :
-- SELECT cron.schedule('nettoyer-historique', '0 3 * * *', 'SELECT nettoyer_historique()');
