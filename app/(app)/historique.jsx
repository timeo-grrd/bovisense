import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, StatusBar, Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { COULEURS, libelleEtat } from '../../constants/couleurs';

// ─── Helpers ────────────────────────────────────────────────────
function getCouleurEtat(etat) {
  if (!etat) return '#999999';
  if (etat === 'Chute')            return '#C0392B';
  if (etat === 'Boiterie_Severe')  return '#E67E22';
  if (etat === 'Boiterie_Legere')  return '#F4A261';
  if (etat === 'Chaleurs')         return '#E9C46A';
  if (etat === 'Saine')            return '#2D5016';
  return '#999999';
}

function formaterDateComplete(iso) {
  if (!iso) return 'Date inconnue';
  const d = new Date(iso);
  const jour = d.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const heure = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${jour} à ${heure}`;
}

function computeGraphData(data) {
  const JOURS_COURT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const result = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const fin = new Date(d);
    fin.setDate(fin.getDate() + 1);
    const items = data.filter(item => {
      const dt = new Date(item.date_diagnostic);
      return dt >= d && dt < fin;
    });
    result.push({
      label:     JOURS_COURT[d.getDay()],
      saines:    items.filter(x => x.etat_sante === 'Saine').length,
      boiteries: items.filter(x => x.etat_sante?.startsWith('Boiterie')).length,
      urgences:  items.filter(x => x.etat_sante === 'Chute').length,
    });
  }
  return result;
}

// ─── Graphique barres empilées ────────────────────────────────────
function GraphiqueSemaine({ data }) {
  const CHART_H = 110;
  const maxTotal = Math.max(...data.map(d => d.saines + d.boiteries + d.urgences), 1);
  return (
    <View style={stylesGraph.conteneur}>
      <Text style={stylesGraph.titre}>Évolution sur 7 jours</Text>
      <View style={stylesGraph.barresRow}>
        {data.map((jour, i) => {
          const hS = Math.round((jour.saines    / maxTotal) * CHART_H);
          const hB = Math.round((jour.boiteries / maxTotal) * CHART_H);
          const hU = Math.round((jour.urgences  / maxTotal) * CHART_H);
          return (
            <View key={i} style={stylesGraph.colonne}>
              <View style={{ height: CHART_H, justifyContent: 'flex-end' }}>
                {hU > 0 && <View style={[stylesGraph.segment, { height: hU, backgroundColor: '#C0392B' }]} />}
                {hB > 0 && <View style={[stylesGraph.segment, { height: hB, backgroundColor: '#E67E22' }]} />}
                {hS > 0 && <View style={[stylesGraph.segment, { height: hS, backgroundColor: '#2D5016' }]} />}
              </View>
              <Text style={stylesGraph.labelJour}>{jour.label}</Text>
            </View>
          );
        })}
      </View>
      <View style={stylesGraph.legende}>
        {[
          { couleur: '#2D5016', label: 'Saines' },
          { couleur: '#E67E22', label: 'Boiteries' },
          { couleur: '#C0392B', label: 'Urgences' },
        ].map(({ couleur, label }) => (
          <View key={label} style={stylesGraph.legendeItem}>
            <View style={[stylesGraph.legendeDot, { backgroundColor: couleur }]} />
            <Text style={stylesGraph.legendeTexte}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const FILTRES = [
  { id: 'Tout',       label: 'Tout' },
  { id: 'Urgences',   label: '🔴 Urgences' },
  { id: 'Boiteries',  label: '🟠 Boiteries' },
  { id: 'Chaleurs',   label: '🟡 Chaleurs' },
  { id: 'Confirmées', label: '✅ Confirmées' },
  { id: 'Fausses',    label: '🔧 Fausses alertes' },
];

// ─── Écran principal ──────────────────────────────────────────────
export default function HistoriqueScreen() {
  const { id, nom } = useLocalSearchParams();
  const modeGlobal  = !id;

  const [historique,     setHistorique]     = useState([]);
  const [chargement,     setChargement]     = useState(true);
  const [erreur,         setErreur]         = useState(null);
  const [filtreActif,    setFiltreActif]    = useState('Tout');
  const [triDecroissant, setTriDecroissant] = useState(true);

  const chargerHistorique = useCallback(async () => {
    try {
      setErreur(null);
      setChargement(true);

      if (modeGlobal) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: colliers, error: errColliers } = await supabase
          .from('colliers')
          .select('id')
          .eq('user_id', user.id);

        if (errColliers) throw errColliers;

        const ids = (colliers ?? []).map(c => c.id);
        if (ids.length === 0) { setHistorique([]); return; }

        const { data, error } = await supabase
          .from('historique_sante')
          .select('*, colliers(id_vache, nom_vache)')
          .in('collier_id', ids)
          .order('date_diagnostic', { ascending: false })
          .limit(50);

        if (error) throw error;
        setHistorique(data ?? []);
      } else {
        const limite = new Date();
        limite.setDate(limite.getDate() - 15);

        const { data, error } = await supabase
          .from('historique_sante')
          .select('*')
          .eq('collier_id', id)
          .gte('date_diagnostic', limite.toISOString())
          .order('date_diagnostic', { ascending: false })
          .limit(30);

        if (error) throw error;
        setHistorique(data ?? []);
      }
    } catch {
      setErreur('Impossible de charger l\'historique.');
    } finally {
      setChargement(false);
    }
  }, [id, modeGlobal]);

  useEffect(() => { chargerHistorique(); }, [chargerHistorique]);

  // ── Filtrage + tri client-side ──
  const historiqueFiltre = historique
    .filter(item => {
      switch (filtreActif) {
        case 'Urgences':   return item.etat_sante === 'Chute';
        case 'Boiteries':  return item.etat_sante?.startsWith('Boiterie');
        case 'Chaleurs':   return item.etat_sante === 'Chaleurs';
        case 'Confirmées': return item.confirme === true;
        case 'Fausses':    return item.etat_sante === 'Fausse_alerte';
        default:           return true;
      }
    })
    .sort((a, b) => {
      const diff = new Date(b.date_diagnostic) - new Date(a.date_diagnostic);
      return triDecroissant ? diff : -diff;
    });

  const graphData = modeGlobal ? computeGraphData(historique) : null;

  const titre = modeGlobal
    ? 'Historique du troupeau'
    : `Historique — ${nom || id}`;

  const sousTitre = modeGlobal
    ? `${historiqueFiltre.length} entrée${historiqueFiltre.length !== 1 ? 's' : ''} affichée${historiqueFiltre.length !== 1 ? 's' : ''}`
    : `15 derniers jours · ${historique.length} diagnostic${historique.length !== 1 ? 's' : ''}`;

  return (
    <View style={styles.fond}>
      <StatusBar barStyle="dark-content" backgroundColor={COULEURS.FOND_CARD} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.retour}>
          <Ionicons name="arrow-back" size={22} color={COULEURS.VERT_PRINCIPAL} />
        </TouchableOpacity>
        <Text style={styles.headerTitre} numberOfLines={1}>{titre}</Text>
        <View style={{ width: 40 }} />
      </View>

      {chargement ? (
        <View style={styles.centrer}>
          <ActivityIndicator size="large" color={COULEURS.VERT_PRINCIPAL} />
          <Text style={styles.texteChargement}>Chargement…</Text>
        </View>
      ) : erreur ? (
        <View style={styles.centrer}>
          <Text style={styles.erreurTexte}>⚠️ Impossible de charger l'historique</Text>
          <TouchableOpacity style={styles.boutonReessayer} onPress={chargerHistorique}>
            <Text style={styles.boutonReessayerTexte}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContenu}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sousTitre}>{sousTitre}</Text>

          {/* ── Graphique 7 jours (mode global) ── */}
          {modeGlobal && graphData && <GraphiqueSemaine data={graphData} />}

          {/* ── Chips filtres + bouton tri (mode global) ── */}
          {modeGlobal && (
            <View style={styles.filtresRow}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsList}
              >
                {FILTRES.map(f => (
                  <TouchableOpacity
                    key={f.id}
                    style={[styles.chip, filtreActif === f.id && styles.chipActif]}
                    onPress={() => setFiltreActif(f.id)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.chipTexte, filtreActif === f.id && styles.chipTexteActif]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={styles.boutonTri}
                onPress={() => setTriDecroissant(v => !v)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={triDecroissant ? 'arrow-down' : 'arrow-up'}
                  size={14}
                  color={COULEURS.VERT_PRINCIPAL}
                />
                <Text style={styles.boutonTriTexte}>
                  {triDecroissant ? 'Récent' : 'Ancien'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Liste ── */}
          {historiqueFiltre.length === 0 ? (
            <View style={styles.vide}>
              <Text style={{ fontSize: 40, marginBottom: 16 }}>📊</Text>
              <Text style={styles.videTexte}>
                {modeGlobal
                  ? filtreActif === 'Tout'
                    ? 'Aucun diagnostic enregistré pour votre troupeau.'
                    : 'Aucun résultat pour ce filtre.'
                  : 'Aucun diagnostic enregistré pour cette vache sur les 15 derniers jours.'}
              </Text>
            </View>
          ) : (
            historiqueFiltre.map(item => {
              const couleur  = getCouleurEtat(item.etat_sante);
              const idVache  = item.colliers?.id_vache ?? (nom || id);
              const nomVache = item.colliers?.nom_vache;
              return (
                <View key={item.id} style={styles.carte}>
                  <View style={[styles.bandeLaterale, { backgroundColor: couleur }]} />
                  <View style={styles.carteContenu}>
                    {modeGlobal && (
                      <Text style={styles.carteVache}>
                        {idVache}{nomVache ? ` — ${nomVache}` : ''}
                      </Text>
                    )}
                    <Text style={styles.carteDate}>{formaterDateComplete(item.date_diagnostic)}</Text>
                    <View style={styles.carteLigne}>
                      <View style={[styles.badge, { backgroundColor: couleur }]}>
                        <Text style={styles.badgeTexte}>{libelleEtat(item.etat_sante)}</Text>
                      </View>
                      {item.confirme && (
                        <Text style={styles.confirmeTag}>✅ Confirmée</Text>
                      )}
                      {item.fiabilite_ia != null && (
                        <Text style={styles.carteFiabilite}>
                          {Math.round(item.fiabilite_ia > 1 ? item.fiabilite_ia : item.fiabilite_ia * 100)}%
                        </Text>
                      )}
                    </View>
                    <Text style={styles.carteCapteurs}>
                      {'👟'} {item.pas_2h != null ? Math.round(item.pas_2h) : '—'} pas
                      {'  🛏️'} {item.repos_min_2h != null ? Math.round(item.repos_min_2h) : '—'} min
                      {'  🌡️'} {item.temp_corp_c != null ? Number(item.temp_corp_c).toFixed(1) : '—'}°C corp
                      {'  ☀️'} {item.temp_ext_c != null ? Number(item.temp_ext_c).toFixed(1) : '—'}°C ext
                    </Text>
                  </View>
                </View>
              );
            })
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles graphique ─────────────────────────────────────────────
const stylesGraph = StyleSheet.create({
  conteneur: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  titre: {
    fontSize: 14,
    fontWeight: '700',
    color: COULEURS.TEXTE_PRINCIPAL,
    marginBottom: 12,
  },
  barresRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 4,
    marginBottom: 8,
  },
  colonne:    { flex: 1, alignItems: 'center', gap: 4 },
  segment:    { width: '100%', minHeight: 2, borderRadius: 2 },
  labelJour:  { fontSize: 11, color: COULEURS.TEXTE_SECONDAIRE, fontWeight: '500', marginTop: 4 },
  legende:    { flexDirection: 'row', gap: 16, justifyContent: 'center', marginTop: 4 },
  legendeItem:{ flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendeDot: { width: 10, height: 10, borderRadius: 5 },
  legendeTexte:{ fontSize: 11, color: COULEURS.TEXTE_SECONDAIRE },
});

// ─── Styles écran ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: COULEURS.FOND_PRINCIPAL },
  centrer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  texteChargement: { color: COULEURS.TEXTE_SECONDAIRE, marginTop: 12 },

  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingTop:        Platform.OS === 'ios' ? 52 : 36,
    paddingBottom:     14,
    paddingHorizontal: 16,
    backgroundColor:   COULEURS.FOND_CARD,
    borderBottomWidth: 1,
    borderBottomColor: COULEURS.SEPARATEUR,
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: 1 },
    shadowOpacity:     0.06,
    shadowRadius:      3,
    elevation:         2,
  },
  retour: { width: 40, alignItems: 'flex-start' },
  headerTitre: {
    flex:       1,
    textAlign:  'center',
    fontSize:   17,
    fontWeight: '700',
    color:      COULEURS.TEXTE_PRINCIPAL,
  },

  scroll:        { flex: 1 },
  scrollContenu: { paddingHorizontal: 16, paddingTop: 16 },

  sousTitre: {
    color:        COULEURS.TEXTE_SECONDAIRE,
    fontSize:     13,
    fontWeight:   '500',
    marginBottom: 14,
  },

  // Filtres + tri
  filtresRow: {
    flexDirection:  'row',
    alignItems:     'center',
    marginBottom:   14,
    gap:            8,
  },
  chipsList: { flexDirection: 'row', gap: 8, paddingRight: 4 },
  chip: {
    backgroundColor:  '#F0F0F0',
    borderRadius:     20,
    paddingHorizontal: 12,
    paddingVertical:  7,
  },
  chipActif:      { backgroundColor: COULEURS.VERT_PRINCIPAL },
  chipTexte:      { fontSize: 13, color: '#333333', fontWeight: '500' },
  chipTexteActif: { color: '#FFFFFF', fontWeight: '700' },
  boutonTri: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              4,
    paddingHorizontal: 10,
    paddingVertical:  7,
    borderWidth:      1,
    borderColor:      COULEURS.VERT_PRINCIPAL,
    borderRadius:     20,
  },
  boutonTriTexte: { fontSize: 12, color: COULEURS.VERT_PRINCIPAL, fontWeight: '600' },

  // Cartes
  carte: {
    backgroundColor: '#FFFFFF',
    borderRadius:    12,
    marginBottom:    10,
    flexDirection:   'row',
    overflow:        'hidden',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.07,
    shadowRadius:    4,
    elevation:       2,
  },
  bandeLaterale: { width: 5 },
  carteContenu:  { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
  carteVache: {
    color:        COULEURS.TEXTE_PRINCIPAL,
    fontSize:     13,
    fontWeight:   '700',
    marginBottom: 4,
  },
  carteDate: {
    color:         COULEURS.TEXTE_SECONDAIRE,
    fontSize:      12,
    marginBottom:  8,
    textTransform: 'capitalize',
  },
  carteLigne:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' },
  badge:         { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTexte:    { color: '#FFF', fontSize: 12, fontWeight: '700' },
  confirmeTag:   { fontSize: 11, color: '#2D5016', fontWeight: '600' },
  carteFiabilite:{ color: COULEURS.TEXTE_SECONDAIRE, fontSize: 13, fontWeight: '500' },
  carteCapteurs: { color: COULEURS.TEXTE_SECONDAIRE, fontSize: 12, lineHeight: 18 },

  // Vide
  vide:      { alignItems: 'center', paddingVertical: 48 },
  videTexte: { color: COULEURS.TEXTE_SECONDAIRE, fontSize: 15, textAlign: 'center', lineHeight: 24 },

  // Erreur
  erreurTexte:         { color: COULEURS.ROUGE_URGENCE, fontSize: 15, textAlign: 'center', marginBottom: 16 },
  boutonReessayer:     { backgroundColor: COULEURS.VERT_PRINCIPAL, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24 },
  boutonReessayerTexte:{ color: '#FFF', fontSize: 15, fontWeight: '700' },
});
