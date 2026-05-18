import AsyncStorage from '@react-native-async-storage/async-storage';
import { normaliserEtat } from '../constants/normalisation';

const CLES = {
  VACHES:        '@bovisense:vaches',
  DATE_MAJ:      '@bovisense:date_maj',
  VETERINAIRE:   '@bovisense:veterinaire',
  METEO:         '@bovisense:meteo',
  DERNIERE_ACTU: '@bovisense:derniere_actu',
};

export async function sauvegarderVaches(vaches) {
  try {
    if (!vaches || vaches.length === 0) return;
    await AsyncStorage.setItem(CLES.VACHES, JSON.stringify(vaches));
    await AsyncStorage.setItem(CLES.DATE_MAJ, new Date().toISOString());
    console.log(`✅ Cache: ${vaches.length} vaches sauvegardées`);
  } catch (e) {
    console.log('❌ Erreur sauvegarde cache vaches:', e);
  }
}

export async function chargerVachesCache() {
  try {
    const data   = await AsyncStorage.getItem(CLES.VACHES);
    const dateMaj = await AsyncStorage.getItem(CLES.DATE_MAJ);

    if (!data) {
      console.log('⚠️ Cache vide');
      return { vaches: [], dateMaj: null };
    }

    const vaches = JSON.parse(data);
    const vachesNorm = vaches.map(v => ({
      ...v,
      etat_sante: normaliserEtat(v.etat_sante),
      latitude:   parseFloat(v.latitude)  || 48.0712,
      longitude:  parseFloat(v.longitude) || -1.6325,
    }));

    console.log(`✅ Cache: ${vachesNorm.length} vaches chargées`);
    return {
      vaches:  vachesNorm,
      dateMaj: dateMaj ? new Date(dateMaj) : null,
    };
  } catch (e) {
    console.log('❌ Erreur chargement cache:', e);
    return { vaches: [], dateMaj: null };
  }
}

export async function sauvegarderVeterinaire(vet) {
  try {
    if (!vet) return;
    await AsyncStorage.setItem(CLES.VETERINAIRE, JSON.stringify(vet));
  } catch (e) {
    console.log('Erreur sauvegarde véto:', e);
  }
}

export async function chargerVeterinaireCache() {
  try {
    const data = await AsyncStorage.getItem(CLES.VETERINAIRE);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function sauvegarderMeteo(meteo) {
  try {
    if (!meteo) return;
    await AsyncStorage.setItem(CLES.METEO, JSON.stringify(meteo));
  } catch {}
}

export async function chargerMeteoCache() {
  try {
    const data = await AsyncStorage.getItem(CLES.METEO);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function sauvegarderDerniereActu(date) {
  try {
    await AsyncStorage.setItem(CLES.DERNIERE_ACTU, date.toISOString());
  } catch {}
}

export async function chargerDerniereActu() {
  try {
    const data = await AsyncStorage.getItem(CLES.DERNIERE_ACTU);
    return data ? new Date(data) : null;
  } catch {
    return null;
  }
}
