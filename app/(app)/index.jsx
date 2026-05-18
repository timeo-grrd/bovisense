import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Image,
  ActivityIndicator, RefreshControl, StatusBar, Platform, Alert,
  InteractionManager, Animated,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from 'react-native-maps';

const PROVIDER_CARTE = Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT;
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { analyserTroupeau } from '../../services/aiService';
import { demarrerScheduler } from '../../services/scheduler';
import { envoyerNotificationUrgence } from '../../services/notifications';
import { COULEURS, couleurEtat, libelleEtat } from '../../constants/couleurs';
import { normaliserEtat } from '../../constants/normalisation';
import { tempsRelatif } from '../../utils/temps';
import * as Location from 'expo-location';
import { useConnexion } from '../../services/connexion';
import { sauvegarderVaches, chargerVachesCache, sauvegarderMeteo, chargerMeteoCache } from '../../services/cache';
import BanniereHorsLigne from '../../components/BanniereHorsLigne';
import Toast from '../../components/Toast';

const REGION_DEFAUT = { latitude: 48.0712, longitude: -1.6325, latitudeDelta: 0.025, longitudeDelta: 0.025 };
const ETATS_URGENTS = ['Chute', 'Boiterie_Severe', 'En chaleur'];

export default function HomeScreen() {
  const [colliers, setColliers]                 = useState([]);
  const [profil, setProfil]                     = useState(null);
  const [chargement, setChargement]             = useState(true);
  const [analyse, setAnalyse]                   = useState(false);
  const [erreur, setErreur]                     = useState(null);
  const [rafraichissement, setRafraichissement] = useState(false);
  const [meteo, setMeteo]                       = useState(null);
  const [toastVisible, setToastVisible]         = useState(false);
  const [toastMessage, setToastMessage]         = useState('');
  const [toastType, setToastType]               = useState('info');
  const [dateMaj, setDateMaj]                   = useState(null);
  const [derniereActu, setDerniereActu]         = useState(null);

  const { estConnecte, estConnectePrecedentRef } = useConnexion();
  const estConnecteRef = useRef(estConnecte);
  estConnecteRef.current = estConnecte;
  const scrollRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.15, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  const afficherToast = useCallback((message, type = 'info') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  }, []);

  const chargerDonnees = useCallback(async () => {
    console.log('=== CHARGEMENT VACHES ===');
    try {
      setErreur(null);
      if (estConnecteRef.current) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const [{ data: profilData }, { data: coliersData, error: errColliers }] =
          await Promise.all([
            supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
            supabase.from('colliers').select('*').eq('user_id', user.id).neq('en_paturage', false).order('etat_sante'),
          ]);

        if (errColliers) throw errColliers;
        const vachesNormalisees = (coliersData ?? []).map(v => ({
          ...v, etat_sante: normaliserEtat(v.etat_sante),
        }));
        setProfil(profilData);
        setColliers(vachesNormalisees);
        await sauvegarderVaches(vachesNormalisees);
        console.log('=== CACHE SAUVEGARDÉ ===', vachesNormalisees.length, 'vaches');
        setDateMaj(new Date());
      } else {
        console.log('=== MODE HORS LIGNE ===');
        const cache = await chargerVachesCache();
        if (cache.vaches.length > 0) {
          setColliers(cache.vaches);
          if (cache.dateMaj) setDateMaj(cache.dateMaj);
        }
      }
    } catch {
      console.log('=== MODE HORS LIGNE ===');
      setErreur('Impossible de charger les données du troupeau.');
      const cache = await chargerVachesCache();
      if (cache.vaches.length > 0) {
        setColliers(cache.vaches);
        if (cache.dateMaj) setDateMaj(cache.dateMaj);
      }
    } finally {
      setChargement(false);
      setRafraichissement(false);
    }
  }, []);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => { chargerDonnees(); });
    return () => task.cancel();
  }, [chargerDonnees]);

  useEffect(() => {
    const chargerProfil = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data } = await supabase
            .from('profiles')
            .select('prenom, nom')
            .eq('id', session.user.id)
            .single();
          if (data) setProfil(data);
        }
      } catch {}
    };
    chargerProfil();
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('bovisense_derniere_actu').then(val => {
      if (val) setDerniereActu(new Date(val));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const arreter = demarrerScheduler(() => {
      chargerDonnees();
      setDerniereActu(new Date());
    });
    return arreter;
  }, [chargerDonnees]);

  useEffect(() => {
    const obtenirMeteo = async () => {
      try {
        if (!estConnecteRef.current) {
          const cache = await chargerMeteoCache();
          if (cache) setMeteo(cache);
          return;
        }
        const { status } = await Location.requestForegroundPermissionsAsync();
        let latitude = 48.0712, longitude = -1.6325, ville = 'Mon exploitation';
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
          latitude  = pos.coords.latitude;
          longitude = pos.coords.longitude;
          const adresse = await Location.reverseGeocodeAsync({ latitude, longitude });
          if (adresse.length > 0) ville = adresse[0].city || adresse[0].region || 'Mon exploitation';
        }
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode,windspeed_10m,relative_humidity_2m&timezone=Europe/Paris`;
        const data = await (await fetch(url)).json();
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
        if (cache) setMeteo(cache);
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

  const actualiser = useCallback(async () => {
    if (!estConnecteRef.current) {
      Alert.alert('Hors ligne', "La connexion internet est nécessaire pour analyser les vaches via l'IA.");
      return;
    }
    if (analyse || colliers.length === 0) return;
    try {
      setAnalyse(true);
      setErreur(null);
      const etatsAvant = new Map(colliers.map(v => [v.id, v.etat_sante]));
      const resultats  = await analyserTroupeau(colliers);
      for (const vache of resultats) {
        const etatAvant = etatsAvant.get(vache.id);
        const etatApres = normaliserEtat(vache.etat_sante);
        if (ETATS_URGENTS.includes(etatApres) && etatAvant !== etatApres) {
          await envoyerNotificationUrgence(vache.id_vache, etatApres);
        }
      }
      setColliers(resultats);
      const maintenant = new Date();
      setDerniereActu(maintenant);
      await AsyncStorage.setItem('bovisense_derniere_actu', maintenant.toISOString());
    } catch {
      setErreur("Erreur lors de l'analyse IA. Vérifiez votre connexion.");
    } finally {
      setAnalyse(false);
    }
  }, [analyse, colliers]);

  const onRafraichir = () => { setRafraichissement(true); chargerDonnees(); };

  const stats = useMemo(() => ({
    saines:           colliers.filter(v => v.etat_sante === 'Saine').length,
    boiteriesLegeres: colliers.filter(v => v.etat_sante === 'Boiterie_Legere').length,
    boiteriesSeveres: colliers.filter(v => v.etat_sante === 'Boiterie_Severe').length,
    chaleurs:         colliers.filter(v => v.etat_sante === 'En chaleur').length,
    urgences:         colliers.filter(v => v.etat_sante === 'Chute').length,
    total:            colliers.length,
  }), [colliers]);

  const vachesUrgence = useMemo(() =>
    colliers.filter(v => v.etat_sante === 'Chute'),
  [colliers]);

  const dernieresAlertes = useMemo(() =>
    colliers
      .filter(v => v.etat_sante !== 'Saine' && v.etat_sante !== 'Normale')
      .sort((a, b) => new Date(b.derniere_maj) - new Date(a.derniere_maj))
      .slice(0, 5),
  [colliers]);

  const regionCarte = useMemo(() => {
    const valides = colliers.filter(c => c.latitude && c.longitude);
    if (valides.length > 0) {
      return {
        latitude:      valides.reduce((s, c) => s + c.latitude,  0) / valides.length,
        longitude:     valides.reduce((s, c) => s + c.longitude, 0) / valides.length,
        latitudeDelta:  0.025,
        longitudeDelta: 0.025,
      };
    }
    return REGION_DEFAUT;
  }, [colliers]);

  const allerSurCarte = (vache) => {
    router.push({ pathname: '/(app)/map', params: { focusId: vache.id } });
  };

  if (chargement) {
    return (
      <View style={styles.centrer}>
        <StatusBar barStyle="dark-content" backgroundColor={COULEURS.FOND_PRINCIPAL} />
        <ActivityIndicator size="large" color={COULEURS.VERT_PRINCIPAL} />
        <Text style={styles.texteChargement}>Chargement du troupeau…</Text>
      </View>
    );
  }

  const labelDerniereActu = derniereActu
    ? new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(derniereActu)
    : null;

  return (
    <View style={styles.fond}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ── Header 2 lignes ── */}
      <View style={styles.entete}>
        <View style={styles.enteteL1}>
          <View style={styles.enteteGauche}>
            <Image
              source={require('../../assets/logo_bovi_sense_clair.png')}
              style={styles.enteteLogoImg}
              resizeMode="contain"
            />
            <Text style={styles.enteteTitre}>BoviSense</Text>
          </View>
          {meteo && (
            <TouchableOpacity
              style={styles.meteoBadge}
              onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
              activeOpacity={0.7}
            >
              <Text style={styles.meteoBadgeIcone}>{iconeMeteo(meteo.weathercode)}</Text>
              <Text style={styles.meteoBadgeTemp}>{meteo.temperature}°C</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.enteteBonjour}>
          Bonjour, {profil?.prenom ?? 'Éleveur'} 👋
        </Text>
      </View>

      <BanniereHorsLigne visible={!estConnecte} />

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContenu, { paddingBottom: 96 }]}
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
            <View style={styles.meteoL1}>
              <Text style={styles.meteoIconeGrande}>{iconeMeteo(meteo.weathercode)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.meteoTempGrande}>{meteo.temperature}°C</Text>
                <Text style={styles.meteoVille}>📍 {meteo.ville}</Text>
              </View>
            </View>
            <View style={styles.meteoL2}>
              <Text style={styles.meteoInfo}>💧 {meteo.humidite}%</Text>
              <Text style={styles.meteoDivider}>|</Text>
              <Text style={styles.meteoInfo}>💨 {meteo.vent} km/h</Text>
              {labelDerniereActu && (
                <>
                  <Text style={styles.meteoDivider}>|</Text>
                  <Text style={styles.meteoInfo}>🕐 {labelDerniereActu}</Text>
                </>
              )}
            </View>
          </View>
        )}

        {/* ── Bannières urgence (max 2) ── */}
        {vachesUrgence.slice(0, 2).map(vache => (
          <View key={vache.id} style={styles.banniereUrgence}>
            <Animated.View style={[styles.banniereBord, { opacity: pulseAnim }]} />
            <View style={styles.banniereContenu}>
              <Text style={styles.banniereId}>🚨 {vache.id_vache}</Text>
              <View style={styles.banniereEtatBadge}>
                <Text style={styles.banniereEtatTexte}>{libelleEtat(vache.etat_sante)}</Text>
              </View>
              <Text style={styles.banniereDescription}>Chute détectée — intervention requise</Text>
            </View>
            <TouchableOpacity
              style={styles.boutonLocaliser}
              onPress={() => allerSurCarte(vache)}
              activeOpacity={0.8}
            >
              <Text style={styles.boutonLocaliserTexte}>Localiser →</Text>
            </TouchableOpacity>
          </View>
        ))}
        {vachesUrgence.length > 2 && (
          <View style={styles.banniereResume}>
            <Text style={styles.banniereResumeTexte}>
              ⚠️ +{vachesUrgence.length - 2} autre{vachesUrgence.length - 2 > 1 ? 's' : ''} urgence{vachesUrgence.length - 2 > 1 ? 's' : ''}
            </Text>
          </View>
        )}

        {/* ── Erreur réseau ── */}
        {erreur && (
          <View style={styles.erreurBandeau}>
            <Text style={styles.erreurTexte}>⚠️ {erreur}</Text>
          </View>
        )}

        {/* ── Stats horizontales ── */}
        <Text style={styles.sectionTitre}>État du troupeau</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsScroll}
        >
          {[
            { label: 'Saines',            count: stats.saines,           couleur: '#2D5016', bg: '#F0F7F0' },
            { label: 'Chaleurs',          count: stats.chaleurs,         couleur: '#E9C46A', bg: '#FFFBF0' },
            { label: 'Boiterie\nlégère',  count: stats.boiteriesLegeres, couleur: '#F4A261', bg: '#FFF8F0' },
            { label: 'Boiterie\nsévère',  count: stats.boiteriesSeveres, couleur: '#E67E22', bg: '#FFF5EC' },
            { label: 'Urgences',          count: stats.urgences,         couleur: '#C0392B', bg: '#FFF0F0' },
          ].map(stat => (
            <View key={stat.label} style={[styles.statCard, { backgroundColor: stat.bg, borderLeftColor: stat.couleur }]}>
              <Text style={[styles.statNombre, { color: stat.couleur }]}>{stat.count}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </ScrollView>

        {/* ── Alertes récentes ── */}
        <View style={styles.sectionTitreRow}>
          <Text style={styles.sectionTitre}>⚡ Alertes récentes</Text>
          {dernieresAlertes.length > 0 && (
            <View style={styles.badgeCount}>
              <Text style={styles.badgeCountTexte}>{dernieresAlertes.length}</Text>
            </View>
          )}
        </View>

        {dernieresAlertes.length === 0 ? (
          <View style={styles.troupeauSain}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>✅</Text>
            <Text style={styles.troupeauSainTexte}>Troupeau en bonne santé</Text>
          </View>
        ) : (
          dernieresAlertes.map(vache => (
            <TouchableOpacity
              key={vache.id}
              style={styles.carteAlerte}
              onPress={() => router.push({ pathname: '/(app)/historique', params: { id: vache.id, nom: vache.id_vache } })}
              activeOpacity={0.8}
            >
              <View style={[styles.bandeLaterale, { backgroundColor: couleurEtat(vache.etat_sante) }]} />
              <View style={styles.carteAlerteContenu}>
                <View style={styles.carteAlerteLigne}>
                  <Text style={styles.carteAlerteId}>{vache.id_vache}</Text>
                  {vache.nom_vache ? <Text style={styles.carteAlerteNom}>{vache.nom_vache}</Text> : null}
                  <View style={[styles.badge, { backgroundColor: couleurEtat(vache.etat_sante) }]}>
                    <Text style={styles.badgeTexte}>{libelleEtat(vache.etat_sante)}</Text>
                  </View>
                </View>
                <Text style={styles.carteAlerteDate}>{tempsRelatif(vache.derniere_maj)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COULEURS.TEXTE_SECONDAIRE} />
            </TouchableOpacity>
          ))
        )}

        {/* ── Mini carte 140px ── */}
        {colliers.length > 0 && (
          <>
            <Text style={styles.sectionTitre}>Localisation</Text>
            <TouchableOpacity activeOpacity={0.9} onPress={() => router.push('/(app)/map')}>
              <View style={styles.miniCarteContainer}>
                <MapView
                  style={styles.miniCarte}
                  provider={PROVIDER_CARTE}
                  initialRegion={regionCarte}
                  mapType="standard"
                  scrollEnabled={false}
                  zoomEnabled={false}
                  pitchEnabled={false}
                  rotateEnabled={false}
                  pointerEvents="none"
                  loadingEnabled={true}
                  loadingIndicatorColor="#2D5016"
                  loadingBackgroundColor="#F5F0E8"
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
                <View style={styles.miniCarteOverlay}>
                  <Text style={styles.miniCarteOverlayTexte}>Voir la carte complète →</Text>
                </View>
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
            <Text style={styles.videIndice}>Ajoutez vos premiers colliers dans l'onglet Paramètres</Text>
          </View>
        )}

        {dateMaj && !estConnecte && (
          <Text style={styles.dateMajCache}>
            Données en cache du {dateMaj.toLocaleDateString('fr-FR')} à {dateMaj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
      </ScrollView>

      {/* ── Bouton actualiser flottant ── */}
      <View style={styles.boutonFlottantContainer}>
        <TouchableOpacity
          style={[styles.boutonFlottant, analyse && styles.boutonDesactive]}
          onPress={actualiser}
          disabled={analyse}
          activeOpacity={0.85}
        >
          {analyse ? (
            <View style={styles.boutonContenu}>
              <ActivityIndicator color="#FFF" size="small" />
              <Text style={[styles.boutonTexte, { marginLeft: 10 }]}>Analyse en cours…</Text>
            </View>
          ) : (
            <View style={styles.boutonContenu}>
              <Text style={{ fontSize: 16, marginRight: 8 }}>🔄</Text>
              <Text style={styles.boutonTexte}>Actualiser via IA</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <Toast message={toastMessage} visible={toastVisible} type={toastType} />
    </View>
  );
}

function iconeMeteo(code) {
  if (code === 0)  return '☀️';
  if (code <= 3)   return '⛅';
  if (code <= 48)  return '🌫️';
  if (code <= 67)  return '🌧️';
  if (code <= 77)  return '❄️';
  if (code <= 82)  return '🌦️';
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

const styles = StyleSheet.create({
  fond:    { flex: 1, backgroundColor: COULEURS.FOND_PRINCIPAL },
  centrer: { flex: 1, backgroundColor: COULEURS.FOND_PRINCIPAL, justifyContent: 'center', alignItems: 'center' },
  texteChargement: { color: COULEURS.TEXTE_SECONDAIRE, marginTop: 12, fontSize: 15 },

  // ── Header 2 lignes ──
  entete: {
    backgroundColor:   '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop:        Platform.OS === 'ios' ? 52 : 36,
    paddingBottom:     12,
    borderBottomWidth: 1,
    borderBottomColor: COULEURS.SEPARATEUR,
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: 1 },
    shadowOpacity:     0.06,
    shadowRadius:      3,
    elevation:         2,
  },
  enteteL1: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   4,
  },
  enteteGauche:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  enteteLogoImg: { width: 32, height: 32 },
  enteteTitre: {
    fontSize:   20,
    fontWeight: '800',
    color:      COULEURS.VERT_PRINCIPAL,
    letterSpacing: 0.5,
  },
  enteteBonjour: {
    fontSize:  14,
    color:     COULEURS.TEXTE_SECONDAIRE,
    fontWeight: '500',
    marginTop:  2,
  },
  meteoBadge: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             4,
    backgroundColor: '#F0F7F0',
    borderRadius:    20,
    paddingHorizontal: 10,
    paddingVertical:   5,
  },
  meteoBadgeIcone: { fontSize: 16 },
  meteoBadgeTemp:  { fontSize: 14, fontWeight: '700', color: COULEURS.VERT_PRINCIPAL },

  scroll:        { flex: 1 },
  scrollContenu: { paddingHorizontal: 16, paddingTop: 16 },

  // ── Widget météo ──
  meteoWidget: {
    backgroundColor: '#F0F7F0',
    borderRadius:    16,
    padding:         16,
    marginBottom:    12,
  },
  meteoL1: {
    flexDirection: 'row',
    alignItems:    'center',
    marginBottom:  10,
  },
  meteoIconeGrande: { fontSize: 48, marginRight: 14 },
  meteoTempGrande:  { fontSize: 36, fontWeight: '800', color: COULEURS.TEXTE_PRINCIPAL },
  meteoVille:       { fontSize: 13, color: COULEURS.TEXTE_SECONDAIRE, marginTop: 2 },
  meteoL2: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  meteoInfo:    { fontSize: 13, color: COULEURS.TEXTE_SECONDAIRE, fontWeight: '500' },
  meteoDivider: { color: COULEURS.SEPARATEUR, fontSize: 13 },

  // ── Bannières urgence (blanc + bord rouge) ──
  banniereUrgence: {
    backgroundColor: '#FFFFFF',
    borderRadius:    12,
    marginBottom:    10,
    flexDirection:   'row',
    alignItems:      'center',
    overflow:        'hidden',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.08,
    shadowRadius:    4,
    elevation:       2,
  },
  banniereBord: {
    width:           5,
    alignSelf:       'stretch',
    backgroundColor: COULEURS.ROUGE_URGENCE,
  },
  banniereContenu:     { flex: 1, paddingHorizontal: 12, paddingVertical: 12 },
  banniereId:          { fontSize: 15, fontWeight: '800', color: COULEURS.TEXTE_PRINCIPAL, marginBottom: 3 },
  banniereEtatBadge:   { backgroundColor: COULEURS.ROUGE_URGENCE + '20', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', marginBottom: 4 },
  banniereEtatTexte:   { fontSize: 11, color: COULEURS.ROUGE_URGENCE, fontWeight: '700' },
  banniereDescription: { fontSize: 12, color: COULEURS.TEXTE_SECONDAIRE },
  boutonLocaliser: {
    backgroundColor: COULEURS.VERT_PRINCIPAL,
    borderRadius:    8,
    paddingHorizontal: 12,
    paddingVertical:   8,
    marginRight:       12,
  },
  boutonLocaliserTexte: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  banniereResume: {
    backgroundColor: '#FFF0F0',
    borderRadius:    8,
    borderWidth:     1,
    borderColor:     COULEURS.ROUGE_URGENCE + '40',
    padding:         12,
    marginBottom:    12,
    alignItems:      'center',
  },
  banniereResumeTexte: { color: COULEURS.ROUGE_URGENCE, fontSize: 13, fontWeight: '700' },

  // ── Erreur ──
  erreurBandeau: {
    backgroundColor: '#FEF3CD',
    borderRadius:    8,
    padding:         12,
    marginBottom:    16,
    borderWidth:     1,
    borderColor:     COULEURS.ORANGE_ALERTE,
  },
  erreurTexte: { color: '#7D4E00', fontSize: 13 },

  // ── Titres de section ──
  sectionTitre: {
    fontSize:   16,
    fontWeight: '700',
    color:      COULEURS.TEXTE_PRINCIPAL,
    marginBottom: 10,
    marginTop:    6,
  },
  sectionTitreRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    marginBottom:  10,
    marginTop:     6,
  },
  badgeCount: {
    backgroundColor:   COULEURS.ROUGE_URGENCE,
    borderRadius:      10,
    minWidth:          20,
    height:            20,
    justifyContent:    'center',
    alignItems:        'center',
    paddingHorizontal: 6,
  },
  badgeCountTexte: { color: '#FFF', fontSize: 11, fontWeight: '800' },

  // ── Stats horizontales ──
  statsScroll: { paddingRight: 16, gap: 10, marginBottom: 16 },
  statCard: {
    borderRadius:   12,
    padding:        14,
    minWidth:       90,
    alignItems:     'center',
    borderLeftWidth: 3,
  },
  statNombre: { fontSize: 28, fontWeight: '800', marginBottom: 2 },
  statLabel:  { fontSize: 11, color: '#666', textAlign: 'center', lineHeight: 15 },

  // ── Troupeau sain ──
  troupeauSain:      { alignItems: 'center', paddingVertical: 28 },
  troupeauSainTexte: { color: COULEURS.TEXTE_SECONDAIRE, fontSize: 16, fontWeight: '600' },

  // ── Cartes alertes ──
  carteAlerte: {
    backgroundColor: '#FFFFFF',
    borderRadius:    12,
    marginBottom:    10,
    flexDirection:   'row',
    alignItems:      'center',
    overflow:        'hidden',
    minHeight:       64,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.06,
    shadowRadius:    3,
    elevation:       1,
  },
  bandeLaterale:      { width: 4, alignSelf: 'stretch' },
  carteAlerteContenu: { flex: 1, paddingHorizontal: 14, paddingVertical: 10 },
  carteAlerteLigne:   { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  carteAlerteId:      { color: COULEURS.TEXTE_PRINCIPAL, fontSize: 15, fontWeight: '700' },
  carteAlerteNom:     { color: COULEURS.TEXTE_SECONDAIRE, fontSize: 13 },
  carteAlerteDate:    { color: COULEURS.TEXTE_SECONDAIRE, fontSize: 12 },
  badge:              { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTexte:         { color: '#FFF', fontSize: 11, fontWeight: '700' },

  // ── Mini carte 140px ──
  miniCarteContainer: {
    height:       140,
    borderRadius: 12,
    overflow:     'hidden',
    marginBottom: 16,
    shadowColor:  '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation:    2,
  },
  miniCarte:        { flex: 1 },
  miniCarteOverlay: {
    position:        'absolute',
    bottom:          0,
    left:            0,
    right:           0,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.88)',
    alignItems:      'center',
  },
  miniCarteOverlayTexte: {
    fontSize:   13,
    fontWeight: '700',
    color:      COULEURS.VERT_PRINCIPAL,
  },

  // ── Liste troupeau ──
  ligneVache: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  '#FFFFFF',
    borderRadius:     10,
    paddingVertical:  13,
    paddingHorizontal: 14,
    marginBottom:     8,
    shadowColor:      '#000',
    shadowOffset:     { width: 0, height: 1 },
    shadowOpacity:    0.05,
    shadowRadius:     2,
    elevation:        1,
  },
  pointEtat:      { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  ligneVacheId:   { color: COULEURS.TEXTE_PRINCIPAL, fontSize: 14, fontWeight: '700', width: 56 },
  ligneVacheNom:  { flex: 1, color: COULEURS.TEXTE_SECONDAIRE, fontSize: 13 },
  ligneVacheEtat: { fontSize: 12, fontWeight: '600' },

  // ── Cache ──
  dateMajCache: {
    color:     COULEURS.TEXTE_SECONDAIRE,
    fontSize:  11,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
    fontStyle: 'italic',
  },

  // ── Vide ──
  vide:       { alignItems: 'center', paddingVertical: 40 },
  videTexte:  { color: COULEURS.TEXTE_PRINCIPAL, fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  videIndice: { color: COULEURS.TEXTE_SECONDAIRE, fontSize: 14, textAlign: 'center', lineHeight: 22 },

  // ── Bouton flottant ──
  boutonFlottantContainer: {
    position: 'absolute',
    bottom:   Platform.OS === 'ios' ? 98 : 90,
    left:     32,
    right:    32,
    alignItems: 'center',
  },
  boutonFlottant: {
    backgroundColor: COULEURS.VERT_PRINCIPAL,
    borderRadius:    28,
    paddingVertical:   14,
    paddingHorizontal: 28,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.25,
    shadowRadius:    8,
    elevation:       8,
  },
  boutonDesactive: { opacity: 0.6 },
  boutonContenu:   { flexDirection: 'row', alignItems: 'center' },
  boutonTexte:     { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
