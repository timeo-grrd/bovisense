import { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  Linking, Platform, StatusBar, Switch, Image, Animated, ScrollView, Alert, TextInput,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from 'react-native-maps';

const PROVIDER_CARTE = Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT;
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { COULEURS } from '../../constants/couleurs';
import { normaliserEtat, getCouleurEtat, getLabelEtat } from '../../constants/normalisation';
import { useConnexion } from '../../services/connexion';
import { sauvegarderVaches, chargerVachesCache, sauvegarderVeterinaire, chargerVeterinaireCache } from '../../services/cache';
import BanniereHorsLigne from '../../components/BanniereHorsLigne';

const REGION_DEFAUT = {
  latitude:       48.0712,
  longitude:     -1.6325,
  latitudeDelta:   0.02,
  longitudeDelta:  0.02,
};

const FILTRES_DISPONIBLES = [
  { cle: 'Saine',           label: 'Saines',             couleur: '#2D5016' },
  { cle: 'Boiterie_Legere', label: 'Boiteries légères',  couleur: '#F4A261' },
  { cle: 'Boiterie_Severe', label: 'Boiteries sévères',  couleur: '#E67E22' },
  { cle: 'En chaleur',      label: 'En chaleur',         couleur: '#E9C46A' },
  { cle: 'Chute',           label: 'Urgences',           couleur: '#C0392B' },
];

export default function MapScreen() {
  const { focusId } = useLocalSearchParams();
  const { estConnecte } = useConnexion();
  const estConnecteRef = useRef(estConnecte);
  estConnecteRef.current = estConnecte;

  const mapRef        = useRef(null);
  const hauteurPanel  = useRef(new Animated.Value(280)).current;

  const [colliers, setColliers]                   = useState([]);
  const [chargement, setChargement]               = useState(true);
  const [erreur, setErreur]                       = useState(null);
  const [vacheSelectionnee, setVacheSelectionnee] = useState(null);
  const [filtresActifs, setFiltresActifs]         = useState(
    FILTRES_DISPONIBLES.map(f => f.cle)
  );
  const [legendeOuverte, setLegendeOuverte]       = useState(true);
  const [veterinaire, setVeterinaire]             = useState(null);
  const [recherche, setRecherche]                 = useState('');
  const [antecedents, setAntecedents]             = useState(0);

  const chargerColliers = useCallback(async () => {
    try {
      setErreur(null);
      let donnees = [];
      let vetData = null;

      if (estConnecteRef.current) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const [{ data, error }, { data: vetDataRaw }] = await Promise.all([
          supabase.from('colliers').select('*').eq('user_id', user.id).neq('en_paturage', false),
          supabase.from('veterinaires').select('*').eq('user_id', user.id).maybeSingle(),
        ]);

        if (error) throw error;
        donnees = (data ?? [])
          .map(v => ({ ...v, etat_sante: normaliserEtat(v.etat_sante) }));
        vetData = vetDataRaw ?? null;

        await sauvegarderVaches(donnees);
        console.log('Cache mis à jour avec', donnees.length, 'vaches');
        if (vetData) await sauvegarderVeterinaire(vetData);
      } else {
        const cacheVaches = await chargerVachesCache();
        const cacheVet    = await chargerVeterinaireCache();
        if (cacheVaches.vaches.length > 0) donnees = cacheVaches.vaches;
        if (cacheVet)    vetData  = cacheVet;
      }

      setColliers(donnees);
      setVeterinaire(vetData);

      if (focusId && donnees.length > 0) {
        const cible = donnees.find(v => v.id === focusId);
        if (cible && mapRef.current) {
          setTimeout(() => {
            mapRef.current?.animateToRegion({
              latitude:      cible.latitude,
              longitude:     cible.longitude,
              latitudeDelta:  0.005,
              longitudeDelta: 0.005,
            }, 800);
          }, 600);
          setVacheSelectionnee(cible);
        }
      }
    } catch {
      setErreur('Impossible de charger la position du troupeau.');
      const cacheVaches = await chargerVachesCache();
      if (cacheVaches.vaches.length > 0) setColliers(cacheVaches.vaches);
    } finally {
      setChargement(false);
    }
  }, [focusId]);

  useEffect(() => { chargerColliers(); }, [chargerColliers]);

  const basculerFiltre = (cle) => {
    setFiltresActifs(prev =>
      prev.includes(cle) ? prev.filter(f => f !== cle) : [...prev, cle]
    );
  };

  const basculerLegende = () => {
    const targetHeight = legendeOuverte ? 50 : 280;
    Animated.timing(hauteurPanel, {
      toValue:  targetHeight,
      duration: 250,
      useNativeDriver: false,
    }).start();
    setLegendeOuverte(v => !v);
  };

  const ouvrirNavigation = async (vache) => {
    const lat   = vache.latitude;
    const lng   = vache.longitude;
    const label = encodeURIComponent(vache.nom_vache || vache.id_vache);
    const urls  = {
      ios:     `maps://app?daddr=${lat},${lng}&q=${label}`,
      android: `google.navigation:q=${lat},${lng}`,
      web:     `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    };
    const urlNatif = Platform.select({ ios: urls.ios, android: urls.android });
    try {
      if (urlNatif && await Linking.canOpenURL(urlNatif)) {
        await Linking.openURL(urlNatif);
      } else {
        await Linking.openURL(urls.web);
      }
    } catch {
      await Linking.openURL(urls.web);
    }
  };

  const verifierAntecedents = useCallback(async (vache) => {
    try {
      const { count } = await supabase
        .from('historique_sante')
        .select('*', { count: 'exact', head: true })
        .eq('collier_id', vache.id)
        .or('confirme.eq.true,etat_sante.in.(Chute,Boiterie_Severe)');
      setAntecedents(count || 0);
    } catch {
      setAntecedents(0);
    }
  }, []);

  useEffect(() => {
    if (vacheSelectionnee) {
      setAntecedents(0);
      verifierAntecedents(vacheSelectionnee);
    }
  }, [vacheSelectionnee, verifierAntecedents]);

  const confirmerAlerte = async (vache) => {
    if (!estConnecteRef.current) {
      Alert.alert('Hors ligne', 'Impossible de confirmer l\'alerte sans connexion internet.');
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('historique_sante').insert({
        collier_id:  vache.id,
        user_id:     user.id,
        id_vache:    vache.id_vache,
        etat_sante:  vache.etat_sante,
        confirme:    true,
      });
    } catch {
      // Non-bloquant
    }
  };

  const signalerFausseAlerte = async (vache) => {
    if (!estConnecteRef.current) {
      Alert.alert('Hors ligne', 'Impossible de corriger l\'état sans connexion internet.');
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('colliers').update({ etat_sante: 'Saine' }).eq('id', vache.id);
      await supabase.from('historique_sante').insert({
        collier_id:  vache.id,
        user_id:     user.id,
        id_vache:    vache.id_vache,
        etat_sante:  'Fausse_alerte',
        confirme:    false,
      });
      setVacheSelectionnee(null);
      chargerColliers();
      Alert.alert('Corrigé', 'La vache a été remise en état Saine.');
    } catch {
      Alert.alert('Erreur', 'Impossible de corriger l\'état. Vérifiez votre connexion.');
    }
  };

  const colliersVisibles = useMemo(() => colliers.filter(v => {
    const matchFiltre = filtresActifs.includes(v.etat_sante) ||
      (v.etat_sante === 'Boiterie légère' && filtresActifs.includes('Boiterie_Legere')) ||
      !FILTRES_DISPONIBLES.some(f => f.cle === v.etat_sante);
    const q = recherche.toLowerCase();
    const matchRecherche = recherche === '' ||
      v.id_vache?.toLowerCase().includes(q) ||
      (v.nom_vache?.toLowerCase().includes(q) ?? false);
    return matchFiltre && matchRecherche;
  }), [colliers, filtresActifs, recherche]);

  useEffect(() => {
    if (!recherche.trim() || colliersVisibles.length !== 1) return;
    const v = colliersVisibles[0];
    if (v.latitude && v.longitude && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude:      v.latitude,
        longitude:     v.longitude,
        latitudeDelta:  0.005,
        longitudeDelta: 0.005,
      }, 800);
    }
  }, [colliersVisibles, recherche]);

  const compteurs = {
    saines:           colliers.filter(v => v.etat_sante === 'Saine').length,
    boiteriesLegeres: colliers.filter(v => v.etat_sante === 'Boiterie_Legere').length,
    boiteriesSeveres: colliers.filter(v => v.etat_sante === 'Boiterie_Severe').length,
    chaleurs:         colliers.filter(v => v.etat_sante === 'En chaleur').length,
    urgences:         colliers.filter(v => v.etat_sante === 'Chute').length,
  };

  const panelOuvert = vacheSelectionnee !== null;

  if (chargement) {
    return (
      <View style={styles.centrer}>
        <StatusBar barStyle="dark-content" backgroundColor={COULEURS.FOND_PRINCIPAL} />
        <ActivityIndicator size="large" color={COULEURS.VERT_PRINCIPAL} />
        <Text style={styles.texteChargement}>Chargement de la carte…</Text>
      </View>
    );
  }

  return (
    <View style={styles.fond}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Carte plein écran */}
      <MapView
        ref={mapRef}
        style={styles.carte}
        provider={PROVIDER_CARTE}
        initialRegion={REGION_DEFAUT}
        mapType="standard"
        showsUserLocation
        showsMyLocationButton={false}
        loadingEnabled={true}
        loadingIndicatorColor="#2D5016"
        loadingBackgroundColor="#F5F0E8"
      >
        {colliersVisibles.map(vache => {
          if (!vache.latitude || !vache.longitude) return null;
          return (
            <MarqueurVache
              key={vache.id}
              vache={vache}
              onPress={setVacheSelectionnee}
            />
          );
        })}
      </MapView>

      <BanniereHorsLigne visible={!estConnecte} />

      {/* ── Header flottant ── */}
      <View style={styles.headerMap}>
        <Image
          source={require('../../assets/logo_bovi_sense_clair.png')}
          style={styles.headerLogoImg}
          resizeMode="contain"
        />
        <Text style={styles.headerTitre}>BOVISENSE</Text>
        <Text style={styles.headerCompte}>{colliersVisibles.length}/{colliers.length}</Text>
      </View>

      {/* ── Barre de recherche ── */}
      <View style={styles.barreRecherche}>
        <Ionicons name="search" size={16} color="#666" />
        <TextInput
          placeholder="Rechercher une vache… ex: V-045"
          value={recherche}
          onChangeText={setRecherche}
          style={styles.inputRecherche}
          placeholderTextColor="#999"
          autoCapitalize="characters"
          returnKeyType="search"
        />
        {recherche.length > 0 && (
          <TouchableOpacity onPress={() => setRecherche('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Erreur ── */}
      {erreur && (
        <View style={styles.erreurFlottant}>
          <Text style={styles.erreurTexte}>⚠️ {erreur}</Text>
        </View>
      )}

      {/* ── Panneau info vache sélectionnée ── */}
      {vacheSelectionnee && (
        <View style={[styles.panneauInfo, { bottom: 16 }]}>
          <View style={styles.panneauInfoEntete}>
            <View style={{ flex: 1 }}>
              <Text style={styles.panneauInfoId}>
                {vacheSelectionnee.id_vache}
                {vacheSelectionnee.nom_vache ? ` — ${vacheSelectionnee.nom_vache}` : ''}
              </Text>
              <View style={styles.panneauInfoEtatRow}>
                <View style={[styles.pointEtat, { backgroundColor: getCouleurEtat(vacheSelectionnee.etat_sante) }]} />
                <Text style={[styles.panneauInfoEtat, { color: getCouleurEtat(vacheSelectionnee.etat_sante) }]}>
                  {getLabelEtat(vacheSelectionnee.etat_sante)}
                </Text>
              </View>
              <Text style={styles.panneauInfoCoords}>
                {vacheSelectionnee.latitude.toFixed(4)}, {vacheSelectionnee.longitude.toFixed(4)}
              </Text>
              {vacheSelectionnee.fiabilite_ia != null && (
                <Text style={styles.panneauInfoFiabilite}>
                  Fiabilité IA : {Math.round(vacheSelectionnee.fiabilite_ia > 1 ? vacheSelectionnee.fiabilite_ia : vacheSelectionnee.fiabilite_ia * 100)}%
                </Text>
              )}
              {antecedents > 0 && (
                <View style={styles.badgeAntecedents}>
                  <Ionicons name="medical" size={12} color="#C0392B" />
                  <Text style={styles.badgeAntecedentsTexte}>
                    {antecedents} antécédent{antecedents > 1 ? 's' : ''} médical{antecedents > 1 ? 'aux' : ''}
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity style={styles.boutonFermer} onPress={() => setVacheSelectionnee(null)}>
              <Ionicons name="close-circle" size={26} color={COULEURS.TEXTE_SECONDAIRE} />
            </TouchableOpacity>
          </View>

          <View style={styles.donneesCapteur}>
            <DonneeCapteur icone="👟" label="Pas / 2h"  valeur={`${Math.round(vacheSelectionnee.pas_2h)} pas`} />
            <DonneeCapteur icone="🛌" label="Repos"     valeur={`${Math.round(vacheSelectionnee.repos_min_2h)} min`} />
            <DonneeCapteur icone="🌡️" label="T. corp."  valeur={`${Number(vacheSelectionnee.temp_corp_c).toFixed(1)}°C`} />
            <DonneeCapteur icone="🌤️" label="T. ext."   valeur={`${Number(vacheSelectionnee.temp_ext_c).toFixed(1)}°C`} />
          </View>

          <View style={styles.boutonsPanneauRow}>
            <TouchableOpacity
              style={styles.boutonNavigation}
              onPress={() => ouvrirNavigation(vacheSelectionnee)}
              activeOpacity={0.85}
            >
              <Ionicons name="navigate" size={18} color="#FFF" />
              <Text style={styles.boutonNavigationTexte}>Itinéraire</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.boutonHistorique}
              onPress={() => router.push({
                pathname: '/(app)/historique',
                params: { id: vacheSelectionnee.id, nom: vacheSelectionnee.id_vache },
              })}
              activeOpacity={0.85}
            >
              <Text style={styles.boutonHistoriqueTexte}>📋 Historique</Text>
            </TouchableOpacity>
          </View>

          {vacheSelectionnee.etat_sante !== 'Saine' && vacheSelectionnee.etat_sante !== 'Normale' && (
            <View style={styles.boutonsFausseAlerteRow}>
              <TouchableOpacity
                style={styles.boutonConfirmer}
                onPress={() => confirmerAlerte(vacheSelectionnee)}
                activeOpacity={0.85}
              >
                <Text style={styles.boutonConfirmerTexte}>✅ Confirmer l'alerte</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.boutonFausseAlerte}
                onPress={() => signalerFausseAlerte(vacheSelectionnee)}
                activeOpacity={0.85}
              >
                <Text style={styles.boutonFausseAlerteTexte}>🔧 Fausse alerte</Text>
              </TouchableOpacity>
            </View>
          )}

          {veterinaire ? (
            <TouchableOpacity
              style={styles.boutonVet}
              onPress={() => Linking.openURL(`tel:${veterinaire.telephone}`)}
              activeOpacity={0.85}
            >
              <Text style={styles.boutonVetTexte}>📞 Appeler le vétérinaire</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.boutonVetDesactive}>
              <Text style={styles.boutonVetDesactiveTexte}>⚠️ Aucun vétérinaire configuré</Text>
              <TouchableOpacity onPress={() => router.push('/(app)/settings')} activeOpacity={0.7}>
                <Text style={styles.lienSettings}>Ajouter dans Paramètres →</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* ── Panneau filtres & légende (caché quand le panel info est ouvert) ── */}
      {!panelOuvert && (
        <Animated.View style={[styles.filtresPanel, { height: hauteurPanel, overflow: 'hidden' }]}>
          <TouchableOpacity onPress={basculerLegende} activeOpacity={0.7}>
            <View style={styles.filtresPanelHandle} />
            <View style={styles.filtresPanelTitreRow}>
              <Text style={styles.filtresPanelTitre}>Légende & Filtres</Text>
              <Ionicons
                name={legendeOuverte ? 'chevron-down' : 'chevron-up'}
                size={16}
                color={COULEURS.TEXTE_SECONDAIRE}
              />
            </View>
          </TouchableOpacity>

          <ScrollView
            scrollEnabled={true}
            style={{ maxHeight: 200 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {FILTRES_DISPONIBLES.map((filtre, index) => (
              <View key={filtre.cle}>
                <View style={styles.filtreToggleLigne}>
                  <View style={[styles.filtreDot, { backgroundColor: filtre.couleur }]} />
                  <Text style={styles.filtreLabel}>Afficher {filtre.label}</Text>
                  <Text style={styles.filtreCompte}>
                    ({
                      filtre.cle === 'Saine'           ? compteurs.saines :
                      filtre.cle === 'Boiterie_Legere' ? compteurs.boiteriesLegeres :
                      filtre.cle === 'Boiterie_Severe' ? compteurs.boiteriesSeveres :
                      filtre.cle === 'En chaleur'      ? compteurs.chaleurs :
                      filtre.cle === 'Chute'           ? compteurs.urgences : 0
                    })
                  </Text>
                  <Switch
                    value={filtresActifs.includes(filtre.cle)}
                    onValueChange={() => basculerFiltre(filtre.cle)}
                    trackColor={{ false: COULEURS.SEPARATEUR, true: filtre.couleur }}
                    thumbColor="#FFFFFF"
                  />
                </View>
                {index < FILTRES_DISPONIBLES.length - 1 && (
                  <View style={styles.filtreSeparateur} />
                )}
              </View>
            ))}
          </ScrollView>
        </Animated.View>
      )}
    </View>
  );
}

const MarqueurVache = memo(function MarqueurVache({ vache, onPress }) {
  const couleur = getCouleurEtat(vache.etat_sante);
  return (
    <Marker
      coordinate={{ latitude: vache.latitude, longitude: vache.longitude }}
      onPress={() => onPress(vache)}
    >
      <View style={[styles.marqueur, { backgroundColor: couleur }]}>
        <Text style={styles.marqueurTexte}>🐄</Text>
      </View>
    </Marker>
  );
}, (prev, next) => prev.vache.etat_sante === next.vache.etat_sante);

function DonneeCapteur({ icone, label, valeur }) {
  return (
    <View style={styles.donnee}>
      <Text style={styles.donneeIcone}>{icone}</Text>
      <Text style={styles.donneeValeur}>{valeur}</Text>
      <Text style={styles.donneeLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fond:    { flex: 1, backgroundColor: '#000' },
  marqueur: {
    width:          36,
    height:         36,
    borderRadius:   18,
    justifyContent: 'center',
    alignItems:     'center',
    borderWidth:    2,
    borderColor:    'rgba(255,255,255,0.7)',
    elevation:      4,
    shadowColor:    '#000',
    shadowOffset:   { width: 0, height: 2 },
    shadowOpacity:  0.35,
    shadowRadius:   4,
  },
  marqueurTexte: { fontSize: 16 },
  centrer: { flex: 1, backgroundColor: COULEURS.FOND_PRINCIPAL, justifyContent: 'center', alignItems: 'center' },
  texteChargement: { color: COULEURS.TEXTE_SECONDAIRE, marginTop: 12 },
  carte:   { flex: 1 },

  // Header flottant
  headerMap: {
    position:         'absolute',
    top:              Platform.OS === 'ios' ? 52 : 36,
    left:             16,
    right:            16,
    backgroundColor:  'rgba(255,255,255,0.96)',
    borderRadius:     12,
    paddingHorizontal: 16,
    paddingVertical:  10,
    flexDirection:    'row',
    alignItems:       'center',
    shadowColor:      '#000',
    shadowOffset:     { width: 0, height: 2 },
    shadowOpacity:    0.15,
    shadowRadius:     6,
    elevation:        4,
  },
  headerLogoImg: { width: 28, height: 28, marginRight: 8 },
  headerTitre:   { flex: 1, fontSize: 16, fontWeight: '800', color: COULEURS.TEXTE_PRINCIPAL, letterSpacing: 2 },
  headerCompte:  { fontSize: 13, color: COULEURS.TEXTE_SECONDAIRE, fontWeight: '600' },

  // Erreur
  erreurFlottant: {
    position:        'absolute',
    top:             Platform.OS === 'ios' ? 116 : 100,
    left:            16,
    right:           16,
    backgroundColor: '#FEF3CD',
    borderRadius:    8,
    padding:         12,
    borderWidth:     1,
    borderColor:     COULEURS.ORANGE_ALERTE,
  },
  erreurTexte: { color: '#7D4E00', fontSize: 13 },

  // Panneau info vache
  panneauInfo: {
    position:        'absolute',
    left:            16,
    right:           16,
    backgroundColor: '#FFFFFF',
    borderRadius:    16,
    padding:         16,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.15,
    shadowRadius:    10,
    elevation:       8,
  },
  panneauInfoEntete:  { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  panneauInfoId:      { color: COULEURS.TEXTE_PRINCIPAL, fontSize: 18, fontWeight: '800' },
  panneauInfoEtatRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  pointEtat:          { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  panneauInfoEtat:    { fontSize: 14, fontWeight: '600' },
  panneauInfoCoords:    { color: COULEURS.TEXTE_SECONDAIRE, fontSize: 12, marginTop: 4 },
  panneauInfoFiabilite: { color: COULEURS.VERT_PRINCIPAL, fontSize: 12, fontWeight: '600', marginTop: 3 },
  badgeAntecedents: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  '#FDECEA',
    borderRadius:     12,
    paddingHorizontal: 8,
    paddingVertical:  4,
    gap:              4,
    alignSelf:        'flex-start',
    marginTop:        4,
  },
  badgeAntecedentsTexte: { fontSize: 11, color: '#C0392B', fontWeight: '600' },
  boutonFermer: { padding: 2 },

  donneesCapteur: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 14 },
  donnee:         { alignItems: 'center' },
  donneeIcone:    { fontSize: 18, marginBottom: 2 },
  donneeValeur:   { color: COULEURS.TEXTE_PRINCIPAL, fontSize: 14, fontWeight: '700' },
  donneeLabel:    { color: COULEURS.TEXTE_SECONDAIRE, fontSize: 11 },

  boutonsPanneauRow: { flexDirection: 'row', gap: 10 },
  boutonNavigation: {
    flex:            1,
    backgroundColor: COULEURS.VERT_PRINCIPAL,
    borderRadius:    8,
    height:          44,
    flexDirection:   'row',
    justifyContent:  'center',
    alignItems:      'center',
    gap:             6,
  },
  boutonNavigationTexte: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  boutonHistorique: {
    flex:        1,
    borderRadius: 8,
    height:      44,
    justifyContent: 'center',
    alignItems:  'center',
    borderWidth: 1.5,
    borderColor: COULEURS.VERT_PRINCIPAL,
  },
  boutonHistoriqueTexte: { color: COULEURS.VERT_PRINCIPAL, fontSize: 14, fontWeight: '700' },

  boutonsFausseAlerteRow: {
    flexDirection: 'row',
    gap:           10,
    marginTop:     10,
  },
  boutonConfirmer: {
    flex:            1,
    backgroundColor: '#2D5016',
    borderRadius:    8,
    height:          40,
    justifyContent:  'center',
    alignItems:      'center',
  },
  boutonConfirmerTexte: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  boutonFausseAlerte: {
    flex:        1,
    borderRadius: 8,
    height:      40,
    justifyContent: 'center',
    alignItems:  'center',
    borderWidth: 1.5,
    borderColor: '#C0392B',
  },
  boutonFausseAlerteTexte: { color: '#C0392B', fontSize: 13, fontWeight: '700' },

  boutonVet: {
    backgroundColor: COULEURS.VERT_PRINCIPAL,
    borderRadius:    8,
    height:          44,
    justifyContent:  'center',
    alignItems:      'center',
    marginTop:       10,
  },
  boutonVetTexte: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  boutonVetDesactive: {
    backgroundColor: '#F0F0F0',
    borderRadius:    8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems:      'center',
    marginTop:       10,
    gap:             4,
  },
  boutonVetDesactiveTexte: { color: COULEURS.TEXTE_SECONDAIRE, fontSize: 13, fontWeight: '600' },
  lienSettings:            { color: COULEURS.VERT_PRINCIPAL, fontSize: 12, fontWeight: '600' },

  // Barre de recherche
  barreRecherche: {
    position:         'absolute',
    top:              Platform.OS === 'ios' ? 112 : 96,
    left:             16,
    right:            16,
    backgroundColor:  '#FFFFFF',
    borderRadius:     25,
    paddingHorizontal: 16,
    paddingVertical:  10,
    flexDirection:    'row',
    alignItems:       'center',
    gap:              8,
    shadowColor:      '#000',
    shadowOffset:     { width: 0, height: 2 },
    shadowOpacity:    0.15,
    shadowRadius:     4,
    elevation:        4,
    zIndex:           10,
  },
  inputRecherche: {
    flex:      1,
    fontSize:  14,
    color:     '#1A1A1A',
    paddingVertical: 0,
  },

  // Panneau filtres
  filtresPanel: {
    position:        'absolute',
    bottom:          0,
    left:            0,
    right:           0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom:   Platform.OS === 'ios' ? 32 : 16,
    paddingTop:      10,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: -3 },
    shadowOpacity:   0.12,
    shadowRadius:    8,
    elevation:       8,
  },
  filtresPanelHandle: {
    width:       40,
    height:      4,
    backgroundColor: COULEURS.SEPARATEUR,
    borderRadius: 2,
    alignSelf:   'center',
    marginBottom: 8,
  },
  filtresPanelTitreRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   8,
  },
  filtresPanelTitre: {
    fontSize:   15,
    fontWeight: '700',
    color:      COULEURS.TEXTE_PRINCIPAL,
  },
  filtreToggleLigne: {
    flexDirection: 'row',
    alignItems:    'center',
    paddingVertical: 10,
    minHeight:     48,
  },
  filtreDot:       { width: 14, height: 14, borderRadius: 7, marginRight: 12 },
  filtreLabel:     { flex: 1, fontSize: 14, color: COULEURS.TEXTE_PRINCIPAL, fontWeight: '500' },
  filtreCompte:    { fontSize: 13, color: COULEURS.TEXTE_SECONDAIRE, marginRight: 12 },
  filtreSeparateur:{ height: 1, backgroundColor: COULEURS.SEPARATEUR },
});
