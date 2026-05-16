import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Image,
  ActivityIndicator, Modal, TextInput, Switch, Linking,
  Alert, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { COULEURS } from '../../constants/couleurs';
import { useConnexion } from '../../services/connexion';
import BanniereHorsLigne from '../../components/BanniereHorsLigne';

export default function SettingsScreen() {
  const [profil, setProfil]           = useState(null);
  const [veterinaire, setVeterinaire] = useState(null);
  const [troupeau, setTroupeau]       = useState([]);
  const [chargement, setChargement]   = useState(true);
  const [alertesPush, setAlertesPush] = useState(true);

  const { estConnecte } = useConnexion();

  // Modal collier
  const [modalCollier, setModalCollier]     = useState(false);
  const [scanActif, setScanActif]           = useState(false);
  const [idVache, setIdVache]               = useState('');
  const [idCapteur, setIdCapteur]           = useState('');
  const [nomVache, setNomVache]             = useState('');
  const [enregistrement, setEnregistrement] = useState(false);

  // Modal vétérinaire
  const [modalVeto, setModalVeto]           = useState(false);
  const [vetoForm, setVetoForm]             = useState({ nom: '', prenom: '', telephone: '', adresse: '' });
  const [sauvegardeVeto, setSauvegardeVeto] = useState(false);

  const [permission, requestPermission] = useCameraPermissions();

  const chargerDonnees = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: profilData }, { data: vetoData }, { data: troupeauData }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('veterinaires').select('*').eq('user_id', user.id).limit(1).maybeSingle(),
        supabase.from('colliers').select('id,id_vache,nom_vache,etat_sante,en_paturage').eq('user_id', user.id).order('id_vache'),
      ]);

      setProfil(profilData);
      setTroupeau(troupeauData ?? []);
      if (vetoData) {
        setVeterinaire(vetoData);
        setVetoForm({
          nom:       vetoData.nom ?? '',
          prenom:    vetoData.prenom ?? '',
          telephone: vetoData.telephone ?? '',
          adresse:   vetoData.adresse ?? '',
        });
      }
    } catch {
      // Données absentes au premier lancement
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => { chargerDonnees(); }, [chargerDonnees]);

  const seDeconnecter = () => {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vraiment vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Se déconnecter',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const basculerPaturage = async (id, valeur) => {
    setTroupeau(prev => prev.map(v => v.id === id ? { ...v, en_paturage: valeur } : v));
    try {
      await supabase.from('colliers').update({ en_paturage: valeur }).eq('id', id);
    } catch {
      setTroupeau(prev => prev.map(v => v.id === id ? { ...v, en_paturage: !valeur } : v));
    }
  };

  const toutMettreEnPaturage = async () => {
    setTroupeau(prev => prev.map(v => ({ ...v, en_paturage: true })));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('colliers').update({ en_paturage: true }).eq('user_id', user.id);
    } catch {
      chargerDonnees();
    }
  };

  const toutMettreALEtable = async () => {
    setTroupeau(prev => prev.map(v => ({ ...v, en_paturage: false })));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('colliers').update({ en_paturage: false }).eq('user_id', user.id);
    } catch {
      chargerDonnees();
    }
  };

  const appelerVeterinaire = () => {
    if (!veterinaire?.telephone) {
      Alert.alert('Aucun vétérinaire', 'Ajoutez votre vétérinaire via l\'option correspondante.');
      return;
    }
    Linking.openURL(`tel:${veterinaire.telephone.replace(/\s/g, '')}`);
  };

  const associerCollier = async () => {
    if (!estConnecte) {
      Alert.alert('Hors ligne', 'La connexion internet est nécessaire pour ajouter un collier.');
      return;
    }
    if (!idVache.trim()) {
      Alert.alert('Champ manquant', 'Veuillez renseigner l\'identifiant de la vache.');
      return;
    }
    try {
      setEnregistrement(true);
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('colliers').insert({
        user_id:      user.id,
        id_vache:     idVache.trim().toUpperCase(),
        nom_vache:    nomVache.trim() || null,
        numero_vache: idCapteur.trim() || null,
      });
      if (error) throw error;
      Alert.alert('Collier associé ✅', `La vache ${idVache.trim().toUpperCase()} a bien été ajoutée.`);
      setModalCollier(false);
      setIdVache('');
      setIdCapteur('');
      setNomVache('');
    } catch {
      Alert.alert('Erreur', 'Impossible d\'associer le collier. Vérifiez votre connexion.');
    } finally {
      setEnregistrement(false);
    }
  };

  const ouvrirScanner = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert('Permission refusée', 'BoviSense a besoin de la caméra pour scanner les QR codes.');
        return;
      }
    }
    setScanActif(true);
  };

  const onQRScan = ({ data }) => {
    setScanActif(false);
    setIdCapteur(data);
    Alert.alert('QR scanné ✅', `Capteur détecté : ${data}`);
  };

  const sauvegarderVeto = async () => {
    if (!estConnecte) {
      Alert.alert('Hors ligne', 'La connexion internet est nécessaire pour enregistrer le vétérinaire.');
      return;
    }
    if (!vetoForm.nom.trim() || !vetoForm.telephone.trim()) {
      Alert.alert('Champs manquants', 'Le nom et le téléphone sont obligatoires.');
      return;
    }
    try {
      setSauvegardeVeto(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (veterinaire?.id) {
        const { error } = await supabase.from('veterinaires').update({ ...vetoForm }).eq('id', veterinaire.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('veterinaires').insert({ user_id: user.id, ...vetoForm });
        if (error) throw error;
      }
      await chargerDonnees();
      setModalVeto(false);
      Alert.alert('Enregistré ✅', 'Les informations du vétérinaire ont été sauvegardées.');
    } catch {
      Alert.alert('Erreur', 'Impossible d\'enregistrer le vétérinaire.');
    } finally {
      setSauvegardeVeto(false);
    }
  };

  const initialesAvatar = () => {
    const p = profil?.prenom?.[0] ?? '';
    const n = profil?.nom?.[0] ?? '';
    return (p + n).toUpperCase() || '?';
  };

  if (chargement) {
    return (
      <View style={styles.centrer}>
        <StatusBar barStyle="dark-content" backgroundColor={COULEURS.FOND_PRINCIPAL} />
        <ActivityIndicator size="large" color={COULEURS.VERT_PRINCIPAL} />
      </View>
    );
  }

  return (
    <View style={styles.fond}>
      <StatusBar barStyle="dark-content" backgroundColor={COULEURS.FOND_CARD} />

      {/* ── En-tête ── */}
      <View style={styles.entete}>
        <Text style={styles.enteteTitre}>Mon Compte</Text>
      </View>

      <BanniereHorsLigne visible={!estConnecte} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContenu}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Card profil ── */}
        <View style={styles.profilCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarTexte}>{initialesAvatar()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profilNom}>
              {profil?.prenom} {profil?.nom}
            </Text>
            <Text style={styles.profilExploitation}>
              {profil?.exploitation ?? 'Exploitation non définie'}
            </Text>
            {profil?.telephone ? (
              <Text style={styles.profilTel}>📞 {profil.telephone}</Text>
            ) : null}
          </View>
        </View>

        {/* ── Liste options iOS ── */}
        <View style={styles.listeCard}>

          {/* Alertes Push */}
          <View style={styles.listeItem}>
            <View style={[styles.listeIconeContainer, { backgroundColor: '#FF9500' }]}>
              <Ionicons name="notifications" size={18} color="#FFF" />
            </View>
            <Text style={styles.listeItemLabel}>Gestion des alertes Push</Text>
            <Switch
              value={alertesPush}
              onValueChange={setAlertesPush}
              trackColor={{ false: COULEURS.SEPARATEUR, true: COULEURS.VERT_PRINCIPAL }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.listeSep} />

          {/* Ajouter capteur */}
          <TouchableOpacity
            style={styles.listeItem}
            onPress={() => setModalCollier(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.listeIconeContainer, { backgroundColor: COULEURS.VERT_PRINCIPAL }]}>
              <Ionicons name="hardware-chip" size={18} color="#FFF" />
            </View>
            <Text style={styles.listeItemLabel}>Ajouter un capteur / collier</Text>
            <Ionicons name="chevron-forward" size={18} color={COULEURS.TEXTE_SECONDAIRE} />
          </TouchableOpacity>

          <View style={styles.listeSep} />

          {/* Mon vétérinaire */}
          <TouchableOpacity
            style={styles.listeItem}
            onPress={() => setModalVeto(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.listeIconeContainer, { backgroundColor: '#34C759' }]}>
              <Ionicons name="medkit" size={18} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.listeItemLabel}>Mon vétérinaire</Text>
              {veterinaire && (
                <Text style={styles.listeItemSousTitre}>
                  Dr. {veterinaire.prenom} {veterinaire.nom}
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={COULEURS.TEXTE_SECONDAIRE} />
          </TouchableOpacity>

          <View style={styles.listeSep} />

          {/* Contacter le support */}
          <TouchableOpacity
            style={styles.listeItem}
            onPress={appelerVeterinaire}
            activeOpacity={0.7}
          >
            <View style={[styles.listeIconeContainer, { backgroundColor: '#007AFF' }]}>
              <Ionicons name="call" size={18} color="#FFF" />
            </View>
            <Text style={styles.listeItemLabel}>Contacter le support</Text>
            <Ionicons name="chevron-forward" size={18} color={COULEURS.TEXTE_SECONDAIRE} />
          </TouchableOpacity>

          <View style={styles.listeSep} />

          {/* RGPD */}
          <TouchableOpacity
            style={styles.listeItem}
            onPress={() => Alert.alert('Politique de confidentialité', 'Vos données sont traitées de manière sécurisée conformément au RGPD (Règlement Général sur la Protection des Données).')}
            activeOpacity={0.7}
          >
            <View style={[styles.listeIconeContainer, { backgroundColor: '#8E8E93' }]}>
              <Ionicons name="shield-checkmark" size={18} color="#FFF" />
            </View>
            <Text style={styles.listeItemLabel}>Politique de confidentialité (RGPD)</Text>
            <Ionicons name="chevron-forward" size={18} color={COULEURS.TEXTE_SECONDAIRE} />
          </TouchableOpacity>

        </View>

        {/* ── Gestion du troupeau ── */}
        {troupeau.length > 0 && (
          <View style={styles.troupeauSection}>
            <Text style={styles.troupeauTitre}>🏠 Gestion du troupeau</Text>
            <Text style={styles.troupeauSousTitre}>
              Masque les vaches à l'étable de la carte et de l'analyse IA.
            </Text>
            <ScrollView
              style={styles.troupeauListe}
              scrollEnabled={true}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
            >
              {troupeau.map((vache, index) => (
                <View key={vache.id}>
                  <View style={styles.troupeauLigne}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.troupeauVacheId}>
                        {vache.id_vache}{vache.nom_vache ? ` — ${vache.nom_vache}` : ''}
                      </Text>
                      <Text style={[styles.troupeauVacheEtat, { color: vache.en_paturage === false ? COULEURS.TEXTE_SECONDAIRE : COULEURS.VERT_PRINCIPAL }]}>
                        {vache.en_paturage === false ? '🏠 À l\'étable' : '🌿 En pâturage'}
                      </Text>
                    </View>
                    <Switch
                      value={vache.en_paturage !== false}
                      onValueChange={v => basculerPaturage(vache.id, v)}
                      trackColor={{ false: COULEURS.SEPARATEUR, true: COULEURS.VERT_PRINCIPAL }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                  {index < troupeau.length - 1 && <View style={styles.troupeauSep} />}
                </View>
              ))}
            </ScrollView>
            <View style={styles.troupeauBulkRow}>
              <TouchableOpacity style={styles.troupeauBoutonPaturage} onPress={toutMettreEnPaturage} activeOpacity={0.8}>
                <Text style={styles.troupeauBoutonPaturageTexte}>🌿 Tout en pâturage</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.troupeauBoutonEtable} onPress={toutMettreALEtable} activeOpacity={0.8}>
                <Text style={styles.troupeauBoutonEtableTexte}>🏠 Tout à l'étable</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Bouton déconnexion ── */}
        <TouchableOpacity style={styles.boutonDeconnexion} onPress={seDeconnecter} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={20} color={COULEURS.ROUGE_URGENCE} />
          <Text style={styles.boutonDeconnexionTexte}>Se déconnecter</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ══════════════════════════════════════════
          MODAL — Ajout collier
      ══════════════════════════════════════════ */}
      <Modal
        visible={modalCollier}
        animationType="slide"
        transparent
        onRequestClose={() => setModalCollier(false)}
      >
        <View style={styles.modalFond}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContenu}
          >
            <View style={styles.modalHandle} />

            <View style={styles.modalHeaderRow}>
              <TouchableOpacity onPress={() => { setModalCollier(false); setScanActif(false); }} style={styles.modalRetour}>
                <Ionicons name="arrow-back" size={22} color={COULEURS.VERT_PRINCIPAL} />
              </TouchableOpacity>
              <Text style={styles.modalTitre}>NOUVEAU CAPTEUR</Text>
              <View style={{ width: 32 }} />
            </View>

            {scanActif ? (
              <View style={styles.scannerContainer}>
                <CameraView
                  style={styles.camera}
                  facing="back"
                  onBarcodeScanned={onQRScan}
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                />
                <TouchableOpacity
                  style={styles.boutonAnnulerScan}
                  onPress={() => setScanActif(false)}
                >
                  <Text style={{ color: '#FFF', fontWeight: '700' }}>Annuler le scan</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.modalLogoContainer}>
                  <Image
                    source={require('../../assets/logo_bovi_sense_clair.png')}
                    style={{ width: 64, height: 64 }}
                    resizeMode="contain"
                  />
                  <Text style={styles.modalSousTitre}>
                    Associez un nouveau podomètre à une bête de votre troupeau.
                  </Text>
                </View>

                <Text style={styles.champLabel}>Sélectionner la vache</Text>
                <View style={styles.champAvecIcone}>
                  <Text style={styles.champIconeEmoji}>🐄</Text>
                  <TextInput
                    style={styles.champInputInline}
                    value={idVache}
                    onChangeText={setIdVache}
                    placeholder="ex: V-120"
                    placeholderTextColor={COULEURS.TEXTE_SECONDAIRE}
                    autoCapitalize="characters"
                  />
                </View>

                <Text style={styles.champLabel}>Nom de la vache</Text>
                <TextInput
                  style={styles.champInput}
                  value={nomVache}
                  onChangeText={setNomVache}
                  placeholder="ex: Marguerite"
                  placeholderTextColor={COULEURS.TEXTE_SECONDAIRE}
                  autoCapitalize="words"
                />

                <Text style={styles.champLabel}>ID du capteur (S/N)</Text>
                <View style={styles.champAvecIcone}>
                  <Ionicons name="barcode-outline" size={18} color={COULEURS.TEXTE_SECONDAIRE} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.champInputInline}
                    value={idCapteur}
                    onChangeText={setIdCapteur}
                    placeholder="Entrer l'ID"
                    placeholderTextColor={COULEURS.TEXTE_SECONDAIRE}
                  />
                </View>

                <TouchableOpacity style={styles.boutonQR} onPress={ouvrirScanner}>
                  <Ionicons name="qr-code-outline" size={20} color={COULEURS.TEXTE_PRINCIPAL} />
                  <Text style={styles.boutonQRTexte}>Scanner le QR Code du collier</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.boutonPrincipal, enregistrement && styles.boutonDesactive]}
                  onPress={associerCollier}
                  disabled={enregistrement}
                  activeOpacity={0.85}
                >
                  {enregistrement
                    ? <ActivityIndicator color="#FFF" />
                    : <Text style={styles.boutonTexte}>🔗 Associer le capteur</Text>
                  }
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.boutonAnnuler}
                  onPress={() => { setModalCollier(false); setScanActif(false); }}
                >
                  <Text style={styles.boutonAnnulerTexte}>Annuler</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════
          MODAL — Vétérinaire
      ══════════════════════════════════════════ */}
      <Modal
        visible={modalVeto}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVeto(false)}
      >
        <View style={styles.modalFond}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContenu}
          >
            <View style={styles.modalHandle} />

            <View style={styles.modalHeaderRow}>
              <TouchableOpacity onPress={() => setModalVeto(false)} style={styles.modalRetour}>
                <Ionicons name="arrow-back" size={22} color={COULEURS.VERT_PRINCIPAL} />
              </TouchableOpacity>
              <Text style={styles.modalTitre}>
                {veterinaire ? 'MON VÉTÉRINAIRE' : 'AJOUTER UN VÉTO'}
              </Text>
              <View style={{ width: 32 }} />
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {[
                { champ: 'nom',       label: 'Nom *',       placeholder: 'Martin' },
                { champ: 'prenom',    label: 'Prénom',      placeholder: 'Sophie' },
                { champ: 'telephone', label: 'Téléphone *', placeholder: '06 12 34 56 78', keyboard: 'phone-pad' },
                { champ: 'adresse',   label: 'Adresse',     placeholder: '12 Rue des Champs, 35000 Rennes' },
              ].map(({ champ, label, placeholder, keyboard }) => (
                <View key={champ}>
                  <Text style={styles.champLabel}>{label}</Text>
                  <TextInput
                    style={styles.champInput}
                    value={vetoForm[champ]}
                    onChangeText={v => setVetoForm(f => ({ ...f, [champ]: v }))}
                    placeholder={placeholder}
                    placeholderTextColor={COULEURS.TEXTE_SECONDAIRE}
                    keyboardType={keyboard ?? 'default'}
                    autoCapitalize={keyboard === 'phone-pad' ? 'none' : 'words'}
                  />
                </View>
              ))}

              <TouchableOpacity
                style={[styles.boutonPrincipal, sauvegardeVeto && styles.boutonDesactive]}
                onPress={sauvegarderVeto}
                disabled={sauvegardeVeto}
                activeOpacity={0.85}
              >
                {sauvegardeVeto
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={styles.boutonTexte}>Enregistrer</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity style={styles.boutonAnnuler} onPress={() => setModalVeto(false)}>
                <Text style={styles.boutonAnnulerTexte}>Annuler</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fond:    { flex: 1, backgroundColor: COULEURS.FOND_PRINCIPAL },
  centrer: { flex: 1, backgroundColor: COULEURS.FOND_PRINCIPAL, justifyContent: 'center', alignItems: 'center' },

  // En-tête
  entete: {
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: COULEURS.FOND_CARD,
    borderBottomWidth: 1,
    borderBottomColor: COULEURS.SEPARATEUR,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  enteteTitre: {
    fontSize: 20,
    fontWeight: '800',
    color: COULEURS.TEXTE_PRINCIPAL,
    letterSpacing: 0.5,
  },

  scroll:        { flex: 1 },
  scrollContenu: { padding: 16 },

  // Card profil
  profilCard: {
    backgroundColor: COULEURS.FOND_CARD,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COULEURS.VERT_PRINCIPAL,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarTexte:        { color: '#FFF', fontSize: 22, fontWeight: '800' },
  profilNom:          { color: COULEURS.TEXTE_PRINCIPAL, fontSize: 17, fontWeight: '700', marginBottom: 2 },
  profilExploitation: { color: COULEURS.TEXTE_SECONDAIRE, fontSize: 13, marginBottom: 2 },
  profilTel:          { color: COULEURS.TEXTE_SECONDAIRE, fontSize: 13 },

  // Liste iOS
  listeCard: {
    backgroundColor: COULEURS.FOND_CARD,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  listeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    minHeight: 56,
    gap: 14,
  },
  listeIconeContainer: {
    width: 34,
    height: 34,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listeItemLabel:    { flex: 1, fontSize: 15, color: COULEURS.TEXTE_PRINCIPAL, fontWeight: '500' },
  listeItemSousTitre:{ fontSize: 12, color: COULEURS.TEXTE_SECONDAIRE, marginTop: 1 },
  listeSep:          { height: 1, backgroundColor: COULEURS.SEPARATEUR, marginLeft: 64 },

  // Bouton déconnexion
  boutonDeconnexion: {
    borderWidth: 2,
    borderColor: COULEURS.ROUGE_URGENCE,
    borderRadius: 8,
    height: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'transparent',
  },
  boutonDeconnexionTexte: { color: COULEURS.ROUGE_URGENCE, fontSize: 16, fontWeight: '700' },

  // Modals
  modalFond: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContenu: {
    backgroundColor: COULEURS.FOND_PRINCIPAL,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '92%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: COULEURS.SEPARATEUR,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalRetour: { padding: 4 },
  modalTitre: {
    flex: 1,
    color: COULEURS.TEXTE_PRINCIPAL,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 1,
  },
  modalLogoContainer: {
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  modalSousTitre: {
    color: COULEURS.TEXTE_SECONDAIRE,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },

  champLabel: {
    color: COULEURS.TEXTE_SECONDAIRE,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 8,
  },
  champInput: {
    backgroundColor: COULEURS.FOND_INPUT,
    color: COULEURS.TEXTE_PRINCIPAL,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: COULEURS.SEPARATEUR,
    marginBottom: 4,
    minHeight: 52,
  },
  champAvecIcone: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COULEURS.FOND_INPUT,
    borderRadius: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COULEURS.SEPARATEUR,
    marginBottom: 4,
    minHeight: 52,
  },
  champIconeEmoji:  { fontSize: 18, marginRight: 8 },
  champInputInline: { flex: 1, fontSize: 15, color: COULEURS.TEXTE_PRINCIPAL, paddingVertical: 14 },

  boutonQR: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COULEURS.SEPARATEUR,
    borderRadius: 8,
    height: 52,
    marginTop: 12,
    marginBottom: 8,
    gap: 8,
    backgroundColor: COULEURS.FOND_INPUT,
  },
  boutonQRTexte: { color: COULEURS.TEXTE_PRINCIPAL, fontSize: 15, fontWeight: '600' },

  boutonPrincipal: {
    backgroundColor: COULEURS.VERT_PRINCIPAL,
    borderRadius: 8,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  boutonDesactive: { opacity: 0.6 },
  boutonTexte:     { color: '#FFF', fontSize: 16, fontWeight: '700' },

  boutonAnnuler: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  boutonAnnulerTexte: { color: COULEURS.TEXTE_SECONDAIRE, fontSize: 15 },

  scannerContainer: { borderRadius: 12, overflow: 'hidden', height: 300 },
  camera:           { flex: 1 },
  boutonAnnulerScan: {
    backgroundColor: COULEURS.ROUGE_URGENCE,
    padding: 14,
    alignItems: 'center',
    borderRadius: 8,
    marginTop: 12,
    height: 52,
    justifyContent: 'center',
  },

  // Gestion du troupeau
  troupeauSection: {
    backgroundColor: COULEURS.FOND_CARD,
    borderRadius: 12,
    marginBottom: 24,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  troupeauTitre: {
    fontSize: 15,
    fontWeight: '700',
    color: COULEURS.TEXTE_PRINCIPAL,
    marginBottom: 4,
  },
  troupeauSousTitre: {
    fontSize: 12,
    color: COULEURS.TEXTE_SECONDAIRE,
    marginBottom: 12,
    lineHeight: 17,
  },
  troupeauListe: {
    maxHeight: 300,
    borderWidth: 1,
    borderColor: COULEURS.SEPARATEUR,
    borderRadius: 8,
    marginBottom: 12,
  },
  troupeauLigne: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 52,
  },
  troupeauVacheId:   { color: COULEURS.TEXTE_PRINCIPAL, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  troupeauVacheEtat: { fontSize: 12, fontWeight: '500' },
  troupeauSep:       { height: 1, backgroundColor: COULEURS.SEPARATEUR },
  troupeauBulkRow:   { flexDirection: 'row', gap: 10 },
  troupeauBoutonPaturage: {
    flex: 1,
    backgroundColor: COULEURS.VERT_PRINCIPAL,
    borderRadius: 8,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  troupeauBoutonPaturageTexte: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  troupeauBoutonEtable: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: COULEURS.TEXTE_SECONDAIRE,
    borderRadius: 8,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  troupeauBoutonEtableTexte: { color: COULEURS.TEXTE_SECONDAIRE, fontSize: 13, fontWeight: '700' },
});
