import AsyncStorage from '@react-native-async-storage/async-storage';

const CLES = {
  VACHES: 'cache_vaches',
  METEO: 'cache_meteo',
  VETERINAIRE: 'cache_veterinaire',
};

async function sauvegarder(cle, donnees) {
  try {
    await AsyncStorage.setItem(cle, JSON.stringify({ donnees, dateMaj: new Date().toISOString() }));
  } catch {
    // Silencieux — cache non critique
  }
}

async function charger(cle) {
  try {
    const raw = await AsyncStorage.getItem(cle);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function sauvegarderVaches(vaches) {
  await sauvegarder(CLES.VACHES, vaches);
}

export async function chargerVachesCache() {
  return charger(CLES.VACHES);
}

export async function sauvegarderMeteo(meteo) {
  await sauvegarder(CLES.METEO, meteo);
}

export async function chargerMeteoCache() {
  return charger(CLES.METEO);
}

export async function sauvegarderVeterinaire(vet) {
  await sauvegarder(CLES.VETERINAIRE, vet);
}

export async function chargerVeterinaireCache() {
  return charger(CLES.VETERINAIRE);
}
