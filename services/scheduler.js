import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const AZURE_URL = 'https://bovisens-gzguhzapdug4arc6.francecentral-01.azurewebsites.net/api/predict';
const CLE_DERNIERE_ACTU     = 'bovisense_derniere_actu';
const CLE_DERNIER_NETTOYAGE = 'bovisense_dernier_nettoyage';
const INTERVALLE_MS = 2 * 60 * 60 * 1000;
const UN_JOUR       = 24 * 60 * 60 * 1000;

async function obtenirTempExt(lat = 48.0712, lng = -1.6325) {
  try {
    const r = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m&timezone=Europe/Paris`
    );
    const d = await r.json();
    return Math.round(d.current.temperature_2m * 10) / 10;
  } catch {
    return 15.0;
  }
}

async function analyserVacheEtSauvegarder(vache, userId, tempExt) {
  try {
    const payload = {
      ID_Vache:     vache.id_vache,
      Heure:        new Date().getHours(),
      Pas_2h:       vache.pas_2h       ?? 500,
      Repos_min_2h: vache.repos_min_2h ?? 60,
      Temp_Corp_C:  vache.temp_corp_c  ?? 38.5,
      Temp_Ext_C:   tempExt,
      Lat:          vache.latitude,
      Lng:          vache.longitude,
    };

    const res = await fetch(AZURE_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    if (!res.ok) return;
    const resultat = await res.json();
    const etat = resultat.etat_sante ?? 'Normale';

    await supabase.from('colliers').update({
      etat_sante:   etat,
      temp_ext_c:   tempExt,
      derniere_maj: new Date().toISOString(),
    }).eq('id', vache.id);

    await supabase.from('historique_sante').insert({
      collier_id:   vache.id,
      user_id:      userId,
      id_vache:     vache.id_vache,
      etat_sante:   etat,
      pas_2h:       vache.pas_2h,
      repos_min_2h: vache.repos_min_2h,
      temp_corp_c:  vache.temp_corp_c,
      temp_ext_c:   tempExt,
      confirme:     false,
    });
  } catch {
    // non-bloquant : on continue avec les autres vaches
  }
}

export async function verifierEtActualiser() {
  try {
    const derniere   = await AsyncStorage.getItem(CLE_DERNIERE_ACTU);
    const maintenant = Date.now();

    if (!derniere || (maintenant - new Date(derniere).getTime()) >= INTERVALLE_MS) {

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      const { data: vaches } = await supabase
        .from('colliers')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('en_paturage', true);

      if (!vaches || vaches.length === 0) return false;

      const tempExt = await obtenirTempExt();
      for (const vache of vaches) {
        await analyserVacheEtSauvegarder(vache, session.user.id, tempExt);
      }

      await AsyncStorage.setItem(CLE_DERNIERE_ACTU, new Date().toISOString());
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function nettoyerHistoriqueAncien() {
  try {
    const dernier    = await AsyncStorage.getItem(CLE_DERNIER_NETTOYAGE);
    const maintenant = Date.now();

    if (!dernier || (maintenant - new Date(dernier).getTime()) >= UN_JOUR) {
      const limite = new Date(maintenant - 7 * UN_JOUR).toISOString();
      await supabase
        .from('historique_sante')
        .delete()
        .lt('date_diagnostic', limite)
        .eq('confirme', false)
        .not('etat_sante', 'in', '("Chute","Boiterie_Severe","Boiterie sévère")');

      await AsyncStorage.setItem(CLE_DERNIER_NETTOYAGE, new Date().toISOString());
    }
  } catch {
    // non-bloquant
  }
}

export function demarrerScheduler(callback) {
  const lancer = async () => {
    await nettoyerHistoriqueAncien();
    const aActualise = await verifierEtActualiser();
    if (aActualise && callback) callback();
  };

  lancer();

  const intervalle = setInterval(async () => {
    await nettoyerHistoriqueAncien();
    const aActualise = await verifierEtActualiser();
    if (aActualise && callback) callback();
  }, 5 * 60 * 1000);

  return () => clearInterval(intervalle);
}
