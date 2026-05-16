import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Image,
  ActivityIndicator, RefreshControl, StatusBar, Platform, Alert,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { analyserTroupeau } from '../../services/aiService';
import { envoyerNotificationUrgence } from '../../services/notifications';
import { COULEURS, couleurEtat, libelleEtat } from '../../constants/couleurs';
import * as Location from 'expo-location';
import { useConnexion } from '../../services/connexion';
import { sauvegarderVaches, chargerVachesCache, sauvegarderMeteo, chargerMeteoCache } from '../../services/cache';
import BanniereHorsLigne from '../../components/BanniereHorsLigne';
import Toast from '../../components/Toast';

const REGION_DEFAUT = { latitude: 48.0712, longitude: -1.6325, latitudeDelta: 0.025, longitudeDelta: 0.025 };

export default function HomeScreen() {
  const [colliers, setColliers]             = useState([]);
  const [profil, setProfil]                 = useState(null);
  const [chargement, setChargement]         = useState(true);
  const [analyse, setAnalyse]               = useState(false);
  const [erreur, setErreur]                 = useState(null);
  const [rafraichissement, setRafraichissement] = useState(false);
  const [meteo, setMeteo]                   = useState(null);
  const [toastVisible, setToastVisible]     = useState(false);
  const [toastMessage, setToastMessage]     = useState('');
  const [toastType, setToastType]           = useState('info');
  const [dateMaj, setDateMaj]               = useState(null);

  const { estConnecte, estConnectePrecedentRef } = useConnexion();
  const estConnecteRef = useRef(estConnecte);
  estConnecteRef.current = estConnecte;

  const afficherToast = useCallback((message, type = 'info') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  }, []);

  const chargerDonnees = useCallback(async () => {
    try {
      setErreur(null);
      if (estConnecteRef.current) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const [{ data: profilData }, { data: coliersData, error: errColliers }] =
          await Promise.all([
            supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
            supabase.from('colliers').select('*').eq('user_id', user.id).order('etat_sante'),
          ]);

        if (errColliers) throw errColliers;
        const vachesFiltrees = (coliersData ?? []).filter(v => v.en_paturage !== false);
        setProfil(profilData);
        setColliers(vachesFiltrees);
        await sauvegarderVaches(vachesFiltrees);
        setDateMaj(new Date());
      } else {
        const cache = await chargerVachesCache();
        if (cache) {
          setColliers(cache.donnees);
          setDateMaj(new Date(cache.dateMaj));
        }
      }
    } catch {
      setErreur('Impossible de charger les données du troupeau.');
      const cache = await chargerVachesCache();
      if (cache) {
        setColliers(cache.donnees);
        setDateMaj(new Date(cache.dateMaj));
      }
    } finally {
      setChargement(false);
      setRafraichissement(false);
    }
  }, []);

  useEffect(() => { chargerDonnees(); }, [chargerDonnees]);

  useEffect(() => {
    const obtenirMeteo = async () => {
      try {
        if (!estConnecteRef.current) {
          const cache = await chargerMeteoCache();
          if (cache) setMeteo(cache.donnees);
          return;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();

        let latitude  = 48.0712;
        let longitude = -1.6325;
        let ville     = 'Mon exploitation';

        if (status === 'granted') {
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Low,
          });
          latitude  = position.coords.latitude;
          longitude = position.coords.longitude;

          const adresse = await Location.reverseGeocodeAsync({ latitude, longitude });
          if (adresse.length > 0) {
            ville = adresse[0].city || adresse[0].region || 'Mon exploitation';
          }
        }

        const urlMeteo = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode,windspeed_10m,relative_humidity_2m&timezone=Europe/Paris`;
        const response = await fetch(urlMeteo);
        const data     = await response.json();

        const meteoData = {
          temperature: Math.round(data.current.temperature_2m),
          weathercode: data.current.weathercode,
          vent:        Math.round(data.current.windspeed_10m),
          humidite:    data.current.relative_humidity_2m,
          ville,
        };
        setMeteo(meteoData);
        await sauvegarderMeteo(meteoData);
      } catch {
        const cache = await chargerMeteoCache();
        if (cache) setMeteo(cache.donnees);
      }
    };
    obtenirMeteo();
  }, []);

  useEffect(() => {
    if (estConnectePrecedentRef.current === null) {
      estConnectePrecedentRef.current = estConnecte;
      return;
    }
    if (!estConnectePrecedentRef.current && estConnecte) {
      afficherToast('Connexion rétablie — synchronisation en cours…', 'succes');
      chargerDonnees();
    } else if (estConnectePrecedentRef.current && !estConnecte) {
      afficherToast('Connexion perdue — mode hors ligne activé', 'erreur');
    }
    estConnectePrecedentRef.current = estConnecte;
  }, [estConnecte, afficherToast, chargerDonnees]);

  const ETATS_CRITIQUES = ['Chute', 'Boiterie_Severe', 'Boiterie_Legere', 'Chaleurs'];

  const actualiser = async () => {
    if (!estConnecteRef.current) {
      Alert.alert('Hors ligne', 'La connexion internet est nécessaire pour analyser les vaches via l\'IA.');
      return;
    }
    if (analyse || colliers.length === 0) return;
    try {
      setAnalyse(true);
      setErreur(null);
      const etatsAvant = new Map(colliers.map(v => [v.id, v.etat_sante]));
      const resultats = await analyserTroupeau(colliers);
      for (const vache of resultats) {
        const etatAvant = etatsAvant.get(vache.id);
        if (ETATS_CRITIQUES.includes(vache.etat_sante) && etatAvant !== vache.etat_sante) {
          envoyerNotificationUrgence(vache.id_vache, vache.etat_sante).catch(() => {});
        }
      }
      setColliers(resultats);
    } catch {
      setErreur('Erreur lors de l\'analyse IA. Vérifiez votre connexion.');
    } finally {
      setAnalyse(false);
    }
  };

  const onRafraichir = () => {
    setRafraichissement(true);
    chargerDonnees();
  };

  const stats = colliers.reduce(
    (acc, v) => {
      if (v.etat_sante === 'Saine')            acc.saines++;
      else if (v.etat_sante === 'Chute')            acc.urgences++;
      else if (v.etat_sante === 'Boiterie_Severe')  acc.boiteries++;
      else if (v.etat_sante === 'Boiterie_Legere')  acc.boiteriesLegeres++;
      else if (v.etat_sante === 'Chaleurs')          acc.chaleurs++;
      return acc;
    },
    { saines: 0, boiteries: 0, boiteriesLegeres: 0, urgences: 0, chaleurs: 0 }
  );

  const vachesUrgence  = colliers.filter(v => v.etat_sante === 'Chute');
  const alertesRecentes = colliers.filter(v => v.etat_sante !== 'Saine').slice(0, 3);

  const allerSurCarte = (vache) => {
    router.push({ pathname: '/(app)/map', params: { focusId: vache.id } });
  };

  const regionCarte = (() => {
    const valides = colliers.filter(c => c.latitude && c.longitude);
    if (valides.length > 0) {
      return {
        latitude:  valides.reduce((s, c) => s + c.latitude, 0) / valides.length,
        longitude: valides.reduce((s, c) => s + c.longitude, 0) / valides.length,
        latitudeDelta: 0.025,
        longitudeDelta: 0.025,
      };
    }
    return REGION_DEFAUT;
  })();

  if (chargement) {
    return (
      <View style={styles.centrer}>
        <StatusBar barStyle="dark-content" backgroundColor={COULEURS.FOND_PRINCIPAL} />
        <ActivityIndicator size="large" color={COULEURS.VERT_PRINCIPAL} />
        <Text style={styles.texteChargement}>Chargement du troupeau…</Text>
      </View>
    );
  }

  return (
    <View style={styles.fond}>
      <StatusBar barStyle="dark-content" backgroundColor={COULEURS.FOND_CARD} />

      {/* ── En-tête ── */}
      <View style={styles.entete}>
        <Image
          source={require('../../assets/logo_bovi_sense_clair.png')}
          style={styles.enteteLogoImg}
          resizeMode="contain"
        />
        <Text style={styles.enteteTitre}>BOVISENSE</Text>
      </View>

      <BanniereHorsLigne visible={!estConnecte} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContenu}
        refreshControl={
          <RefreshControl
            refreshing={rafraichissement}
            onRefresh={onRafraichir}
            tintColor={COULEURS.VERT_PRINCIPAL}
            colors={[COULEURS.VERT_PRINCIPAL]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Widget météo ── */}
        {meteo && (
          <View style={styles.meteoWidget}>
            <Text style={styles.meteoIcone}>{iconeMeteo(meteo.weathercode)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.meteoTemp}>{meteo.temperature}°C</Text>
              <Text style={styles.meteoLieu}>📍 {meteo.ville}</Text>
            </View>
            <View style={styles.meteoDetails}>
              <Text style={styles.meteoDetail}>💧 {meteo.humidite}%</Text>
              <Text style={styles.meteoDetail}>💨 {meteo.vent} km/h</Text>
            </View>
          </View>
        )}

        {/* ── Bannière d'urgence ── */}
        {vachesUrgence.length > 0 && (
          <View style={styles.banniereUrgence}>
            <View style={styles.banniereUrgenceGauche}>
              <Text style={styles.banniereUrgenceTitre}>
                ⚠️ Urgence vitale : Vache {vachesUrgence[0].id_vache} immobilisée
              </Text>
              <Text style={styles.banniereUrgenceFiabilite}>Fiabilité IA : 92%</Text>
            </View>
            <TouchableOpacity
              style={styles.boutonVoirCarte}
              onPress={() => allerSurCarte(vachesUrgence[0])}
              activeOpacity={0.85}
            >
              <Text style={styles.boutonVoirCarteTexte}>📍 VOIR SUR LA CARTE</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Erreur réseau ── */}
        {erreur && (
          <View style={styles.erreurBandeau}>
            <Text style={styles.erreurTexte}>⚠️ {erreur}</Text>
          </View>
        )}

        {/* ── État du troupeau ── */}
        <Text style={styles.sectionTitre}>État du troupeau</Text>
        <View style={styles.statsCard}>
          <StatLigne couleur={couleurEtat('Saine')}           label="Saines"              nombre={stats.saines}            />
          <View style={styles.statSep} />
          <StatLigne couleur={couleurEtat('Boiterie_Legere')} label="Boiterie légère"      nombre={stats.boiteriesLegeres}  />
          <View style={styles.statSep} />
          <StatLigne couleur={couleurEtat('Boiterie_Severe')} label="Boiterie sévère"      nombre={stats.boiteries}         />
          <View style={styles.statSep} />
          <StatLigne couleur={couleurEtat('Chaleurs')}        label="En chaleurs"          nombre={stats.chaleurs}          />
          <View style={styles.statSep} />
          <StatLigne couleur={couleurEtat('Chute')}           label="Urgence"              nombre={stats.urgences}          />
        </View>

        {/* ── Bouton IA ── */}
        <TouchableOpacity
          style={[styles.boutonActualiser, analyse && styles.boutonDesactive]}
          onPress={actualiser}
          disabled={analyse}
          activeOpacity={0.85}
        >
          {analyse ? (
            <View style={styles.boutonContenu}>
              <ActivityIndicator color="#FFF" size="small" />
              <Text style={[styles.boutonTexte, { marginLeft: 10 }]}>Analyse IA en cours…</Text>
            </View>
          ) : (
            <View style={styles.boutonContenu}>
              <Ionicons name="refresh" size={20} color="#FFF" />
              <Text style={[styles.boutonTexte, { marginLeft: 8 }]}>Actualiser via IA Azure</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ── Dernières alertes ── */}
        <Text style={styles.sectionTitre}>Dernières alertes</Text>

        {alertesRecentes.length === 0 ? (
          <View style={styles.troupeauSain}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>✅</Text>
            <Text style={styles.troupeauSainTexte}>Troupeau en bonne santé</Text>
          </View>
        ) : (
          alertesRecentes.map(vache => (
            <TouchableOpacity
              key={vache.id}
              style={styles.carteAlerte}
              onPress={() => allerSurCarte(vache)}
              activeOpacity={0.8}
            >
              <View style={[styles.bandeLaterale, { backgroundColor: couleurEtat(vache.etat_sante) }]} />
              <View style={styles.carteAlerteContenu}>
                <View style={styles.carteAlerteLigne}>
                  <Text style={styles.carteAlerteId}>{vache.id_vache}</Text>
                  {vache.nom_vache ? (
                    <Text style={styles.carteAlerteNom}>{vache.nom_vache}</Text>
                  ) : null}
                  <View style={[styles.badge, { backgroundColor: couleurEtat(vache.etat_sante) }]}>
                    <Text style={styles.badgeTexte}>{libelleEtat(vache.etat_sante)}</Text>
                  </View>
                </View>
                <Text style={styles.carteAlerteDate}>
                  Dernière analyse : {formaterDate(vache.derniere_maj)}
                </Text>
                <TouchableOpacity
                  onPress={() => router.push({ pathname: '/(app)/historique', params: { id: vache.id, nom: vache.id_vache } })}
                  activeOpacity={0.7}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Text style={styles.lienHistorique}>Voir historique →</Text>
                </TouchableOpacity>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COULEURS.TEXTE_SECONDAIRE} />
            </TouchableOpacity>
          ))
        )}

        {/* ── Localisation (mini carte) ── */}
        {colliers.length > 0 && (
          <>
            <Text style={styles.sectionTitre}>Localisation</Text>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => router.push('/(app)/map')}
            >
              <View style={styles.miniCarteContainer}>
                <MapView
                  style={styles.miniCarte}
                  provider={PROVIDER_GOOGLE}
                  initialRegion={regionCarte}
                  mapType="satellite"
                  scrollEnabled={false}
                  zoomEnabled={false}
                  pitchEnabled={false}
                  rotateEnabled={false}
                  pointerEvents="none"
                >
                  {colliers
                    .filter(v => v.latitude && v.longitude)
                    .map(vache => (
                      <Marker
                        key={vache.id}
                        coordinate={{ latitude: vache.latitude, longitude: vache.longitude }}
                      >
                        <MiniMarqueur couleur={couleurEtat(vache.etat_sante)} />
                      </Marker>
                    ))}
                </MapView>
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* ── Troupeau complet ── */}
        <Text style={styles.sectionTitre}>Troupeau complet ({colliers.length} animaux)</Text>

        {colliers.map(vache => (
          <TouchableOpacity
            key={vache.id}
            style={styles.ligneVache}
            onPress={() => allerSurCarte(vache)}
            activeOpacity={0.7}
          >
            <View style={[styles.pointEtat, { backgroundColor: couleurEtat(vache.etat_sante) }]} />
            <Text style={styles.ligneVacheId}>{vache.id_vache}</Text>
            <Text style={styles.ligneVacheNom}>{vache.nom_vache ?? '—'}</Text>
            <Text style={[styles.ligneVacheEtat, { color: couleurEtat(vache.etat_sante) }]}>
              {libelleEtat(vache.etat_sante)}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={COULEURS.TEXTE_SECONDAIRE} style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        ))}

        {colliers.length === 0 && (
          <View style={styles.vide}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>📡</Text>
            <Text style={styles.videTexte}>Aucun collier configuré</Text>
            <Text style={styles.videIndice}>
              Ajoutez vos premiers colliers dans l'onglet Paramètres
            </Text>
          </View>
        )}

        {dateMaj && !estConnecte && (
          <Text style={styles.dateMajCache}>
            Données en cache du {dateMaj.toLocaleDateString('fr-FR')} à {dateMaj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      <Toast message={toastMessage} visible={toastVisible} type={toastType} />
    </View>
  );
}

function iconeMeteo(code) {
  if (code === 0)                  return '☀️';
  if (code <= 3)                   return '⛅';
  if (code <= 48)                  return '🌫️';
  if (code <= 67)                  return '🌧️';
  if (code <= 77)                  return '❄️';
  if (code <= 82)                  return '🌦️';
  return '⛈️';
}

function MiniMarqueur({ couleur }) {
  return (
    <View style={{
      width: 14, height: 14, borderRadius: 7,
      backgroundColor: couleur,
      borderWidth: 1.5, borderColor: '#FFF',
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.4, shadowRadius: 2, elevation: 3,
    }} />
  );
}

function StatLigne({ couleur, label, nombre }) {
  return (
    <View style={styles.statLigne}>
      <View style={[styles.statDot, { backgroundColor: couleur }]} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statNombre}>{nombre}</Text>
    </View>
  );
}

function formaterDate(iso) {
  if (!iso) return 'Inconnue';
  const d = new Date(iso);
  return `${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

const styles = StyleSheet.create({
  fond:    { flex: 1, backgroundColor: COULEURS.FOND_PRINCIPAL },
  centrer: { flex: 1, backgroundColor: COULEURS.FOND_PRINCIPAL, justifyContent: 'center', alignItems: 'center' },
  texteChargement: { color: COULEURS.TEXTE_SECONDAIRE, marginTop: 12, fontSize: 15 },

  // En-tête
  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingBottom: 14,
    backgroundColor: COULEURS.FOND_CARD,
    borderBottomWidth: 1,
    borderBottomColor: COULEURS.SEPARATEUR,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  enteteLogoImg: { width: 32, height: 32 },
  enteteTitre: {
    fontSize: 18,
    fontWeight: '800',
    color: COULEURS.TEXTE_PRINCIPAL,
    letterSpacing: 2,
  },

  scroll:        { flex: 1 },
  scrollContenu: { paddingHorizontal: 16, paddingTop: 16 },

  // Bannière urgence
  banniereUrgence: {
    backgroundColor: COULEURS.ROUGE_URGENCE,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  banniereUrgenceGauche: { flex: 1 },
  banniereUrgenceTitre: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  banniereUrgenceFiabilite: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
  },
  boutonVoirCarte: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  boutonVoirCarteTexte: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },

  // Erreur
  erreurBandeau: {
    backgroundColor: '#FEF3CD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COULEURS.ORANGE_ALERTE,
  },
  erreurTexte: { color: '#7D4E00', fontSize: 13 },

  // Titre de section
  sectionTitre: {
    fontSize: 16,
    fontWeight: '700',
    color: COULEURS.TEXTE_PRINCIPAL,
    marginBottom: 10,
    marginTop: 6,
  },

  // Stats (liste verticale)
  statsCard: {
    backgroundColor: COULEURS.FOND_CARD,
    borderRadius: 12,
    marginBottom: 16,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  statLigne: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
  },
  statDot:    { width: 14, height: 14, borderRadius: 7, marginRight: 14 },
  statLabel:  { flex: 1, fontSize: 15, color: COULEURS.TEXTE_PRINCIPAL, fontWeight: '500' },
  statNombre: { fontSize: 22, fontWeight: '800', color: COULEURS.TEXTE_PRINCIPAL },
  statSep:    { height: 1, backgroundColor: COULEURS.SEPARATEUR, marginHorizontal: 16 },

  // Bouton IA
  boutonActualiser: {
    backgroundColor: COULEURS.VERT_PRINCIPAL,
    borderRadius: 8,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  boutonDesactive: { opacity: 0.6 },
  boutonContenu:   { flexDirection: 'row', alignItems: 'center' },
  boutonTexte:     { color: '#FFF', fontSize: 15, fontWeight: '700' },

  // Troupeau sain
  troupeauSain:      { alignItems: 'center', paddingVertical: 28 },
  troupeauSainTexte: { color: COULEURS.TEXTE_SECONDAIRE, fontSize: 16, fontWeight: '600' },

  // Cartes alertes
  carteAlerte: {
    backgroundColor: COULEURS.FOND_CARD,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    minHeight: 72,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  bandeLaterale:      { width: 5, alignSelf: 'stretch' },
  carteAlerteContenu: { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
  carteAlerteLigne:   { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 5 },
  carteAlerteId:      { color: COULEURS.TEXTE_PRINCIPAL, fontSize: 15, fontWeight: '700' },
  carteAlerteNom:     { color: COULEURS.TEXTE_SECONDAIRE, fontSize: 13 },
  carteAlerteDate:    { color: COULEURS.TEXTE_SECONDAIRE, fontSize: 12, marginBottom: 4 },
  lienHistorique:     { color: COULEURS.VERT_PRINCIPAL, fontSize: 12, fontWeight: '600' },
  badge:              { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTexte:         { color: '#FFF', fontSize: 11, fontWeight: '700' },

  // Mini carte
  miniCarteContainer: {
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  miniCarte: { flex: 1 },

  // Liste troupeau
  ligneVache: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COULEURS.FOND_CARD,
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  pointEtat:     { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  ligneVacheId:  { color: COULEURS.TEXTE_PRINCIPAL, fontSize: 14, fontWeight: '700', width: 56 },
  ligneVacheNom: { flex: 1, color: COULEURS.TEXTE_SECONDAIRE, fontSize: 13 },
  ligneVacheEtat: { fontSize: 12, fontWeight: '600' },

  // Widget météo
  meteoWidget: {
    backgroundColor:  '#FFFFFF',
    borderRadius:     12,
    padding:          16,
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
    marginBottom:     16,
    shadowColor:      '#000',
    shadowOffset:     { width: 0, height: 2 },
    shadowOpacity:    0.08,
    shadowRadius:     4,
    elevation:        2,
  },
  meteoIcone:   { fontSize: 40, marginRight: 12 },
  meteoTemp:    { fontSize: 28, fontWeight: '800', color: COULEURS.TEXTE_PRINCIPAL },
  meteoLieu:    { fontSize: 12, color: COULEURS.TEXTE_SECONDAIRE, marginTop: 2 },
  meteoDetails: { alignItems: 'flex-end', gap: 4 },
  meteoDetail:  { fontSize: 13, color: COULEURS.TEXTE_SECONDAIRE, fontWeight: '500' },

  // Date du cache
  dateMajCache: {
    color: COULEURS.TEXTE_SECONDAIRE,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
    fontStyle: 'italic',
  },

  // Vide
  vide:        { alignItems: 'center', paddingVertical: 40 },
  videTexte:   { color: COULEURS.TEXTE_PRINCIPAL, fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  videIndice:  { color: COULEURS.TEXTE_SECONDAIRE, fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
