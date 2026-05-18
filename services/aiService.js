import { supabase } from '../lib/supabase';

const normaliserEtat = (etat) => {
  if (!etat) return 'Saine';
  if (etat === 'Normale' || etat === 'Normal' || etat === 'normale') return 'Saine';
  return etat;
};

const AZURE_API_URL =
  'https://bovisens-gzguhzapdug4arc6.francecentral-01.azurewebsites.net/api/predict';

const obtenirTempExt = async () => {
  try {
    const r = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=48.0712&longitude=-1.6325&current=temperature_2m&timezone=Europe/Paris'
    );
    const d = await r.json();
    return Math.round(d.current.temperature_2m * 10) / 10;
  } catch {
    return 15.0;
  }
};

// Analyse un seul animal et retourne son état de santé prédit
export async function analyserVache(vache, tempExt) {
  const payload = {
    ID_Vache:    vache.id_vache,
    Heure:       new Date().getHours(),
    Pas_2h:      vache.pas_2h,
    Repos_min_2h:vache.repos_min_2h,
    Temp_Corp_C: vache.temp_corp_c,
    Temp_Ext_C:  tempExt ?? vache.temp_ext_c,
    Lat:         vache.latitude,
    Lng:         vache.longitude,
  };

  const reponse = await fetch(AZURE_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!reponse.ok) {
    throw new Error(`Erreur API IA : ${reponse.status} ${reponse.statusText}`);
  }

  const data = await reponse.json();
  return {
    etat_sante: normaliserEtat(data.etat_sante),
    fiabilite:  data.probabilite ?? data.fiabilite ?? data.confidence ?? data.score ?? null,
  };
}

// Analyse tout le troupeau, met à jour Supabase et enregistre l'historique
export async function analyserTroupeau(colliers) {
  const resultats = [];
  const tempExt = await obtenirTempExt();

  for (const vache of colliers) {
    try {
      const { etat_sante, fiabilite } = await analyserVache(vache, tempExt);

      const { error } = await supabase
        .from('colliers')
        .update({
          etat_sante:   etat_sante,
          fiabilite_ia: fiabilite,
          derniere_maj: new Date().toISOString(),
        })
        .eq('id', vache.id);

      if (error) throw error;

      await supabase.from('historique_sante').insert({
        collier_id:   vache.id,
        user_id:      vache.user_id,
        id_vache:     vache.id_vache,
        etat_sante,
        fiabilite_ia: fiabilite,
        pas_2h:       vache.pas_2h != null ? Math.round(vache.pas_2h) : null,
        repos_min_2h: vache.repos_min_2h != null ? Math.round(vache.repos_min_2h) : null,
        temp_corp_c:  vache.temp_corp_c,
        temp_ext_c:   vache.temp_ext_c,
      });

      resultats.push({ ...vache, etat_sante, fiabilite_ia: fiabilite });
    } catch {
      // En cas d'erreur réseau ou API, on conserve l'état connu
      resultats.push(vache);
    }
  }

  return resultats;
}
