import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { COULEURS } from '../../constants/couleurs';

// ✅ DEHORS du composant principal — ne sera pas recréé à chaque frappe
const Champ = ({ valeur, onChange, label, placeholder, obligatoire, ...props }) => (
  <>
    <Text style={styles.label}>{label}{obligatoire ? ' *' : ''}</Text>
    <TextInput
      style={styles.input}
      value={valeur}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={COULEURS.TEXTE_SECONDAIRE}
      blurOnSubmit={false}
      {...props}
    />
  </>
);

export default function RegisterScreen() {
  const [form, setForm] = useState({
    prenom: '', nom: '', exploitation: '',
    telephone: '', email: '', motDePasse: '', confirmerMdp: '',
    vetNom: '', vetTelephone: '',
  });
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur]         = useState(null);
  const [succes, setSucces]         = useState(false);
  const [voirMdp, setVoirMdp]       = useState(false);
  const [voirConfirm, setVoirConfirm] = useState(false);

  const majChamp = (champ, valeur) => setForm(f => ({ ...f, [champ]: valeur }));

  const sInscrire = async () => {
    const { prenom, nom, email, motDePasse } = form;
    if (!prenom || !nom || !email || !motDePasse) {
      setErreur('Veuillez remplir les champs obligatoires (*).');
      return;
    }
    if (motDePasse.length < 8) {
      setErreur('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (form.motDePasse !== form.confirmerMdp) {
      setErreur('Les mots de passe ne correspondent pas.');
      return;
    }
    try {
      setChargement(true);
      setErreur(null);
      const { data, error: erreurAuth } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: motDePasse,
      });
      if (erreurAuth) throw erreurAuth;
      if (data.user) {
        const { error: erreurProfil } = await supabase
          .from('profiles')
          .upsert({
            id: data.user.id,
            prenom: form.prenom,
            nom: form.nom,
            exploitation: form.exploitation,
            telephone: form.telephone,
          });
        if (erreurProfil) throw erreurProfil;

        if (form.vetTelephone.trim()) {
          await supabase.from('veterinaires').insert({
            user_id:   data.user.id,
            nom:       form.vetNom.trim() || 'Mon vétérinaire',
            telephone: form.vetTelephone.trim(),
          });
        }
      }
      setSucces(true);
    } catch (e) {
      if (e.message?.includes('already registered')) {
        setErreur('Cette adresse e-mail est déjà utilisée.');
      } else {
        setErreur('Erreur lors de la création du compte. Réessayez.');
      }
    } finally {
      setChargement(false);
    }
  };

  if (succes) {
    return (
      <View style={[styles.fond, styles.centrer]}>
        <StatusBar barStyle="dark-content" backgroundColor={COULEURS.FOND_PRINCIPAL} />
        <Image
          source={require('../../assets/logo_bovi_sense_clair.png')}
          style={{ width: 80, height: 80, marginBottom: 24 }}
          resizeMode="contain"
        />
        <Text style={styles.succesIcone}>✅</Text>
        <Text style={styles.succesToitre}>Compte créé !</Text>
        <Text style={styles.succesTexte}>
          Un e-mail de confirmation vous a été envoyé.{'\n'}
          Vérifiez votre boîte mail puis connectez-vous.
        </Text>
        <TouchableOpacity style={styles.bouton} onPress={() => router.replace('/(auth)/login')}>
          <Text style={styles.boutonTexte}>Retour à la connexion</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.fond}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor={COULEURS.FOND_PRINCIPAL} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.retour}>
            <Ionicons name="arrow-back" size={20} color={COULEURS.VERT_PRINCIPAL} />
            <Text style={styles.retourTexte}>Retour</Text>
          </TouchableOpacity>
          <Text style={styles.titrePage}>Créer mon compte</Text>
          <Text style={styles.sousTitrePage}>Renseignez vos informations d'éleveur</Text>
        </View>

        <View style={styles.card}>
          {erreur ? (
            <View style={styles.erreurContainer}>
              <Text style={styles.erreurTexte}>⚠️ {erreur}</Text>
            </View>
          ) : null}

          <View style={styles.rangee}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Champ valeur={form.prenom} onChange={v => majChamp('prenom', v)}
                label="Prénom" placeholder="Jean-Yves" obligatoire
                autoCapitalize="words" returnKeyType="next" />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Champ valeur={form.nom} onChange={v => majChamp('nom', v)}
                label="Nom" placeholder="Dupont" obligatoire
                autoCapitalize="words" returnKeyType="next" />
            </View>
          </View>

          <Champ valeur={form.exploitation} onChange={v => majChamp('exploitation', v)}
            label="Nom de l'exploitation" placeholder="GAEC des Prés Verts"
            autoCapitalize="words" returnKeyType="next" />

          <Champ valeur={form.telephone} onChange={v => majChamp('telephone', v)}
            label="Téléphone" placeholder="06 12 34 56 78"
            keyboardType="phone-pad" returnKeyType="next" />

          <Text style={styles.sectionTitre}>🏥 Vétérinaire (optionnel)</Text>

          <Champ valeur={form.vetNom} onChange={v => majChamp('vetNom', v)}
            label="Nom du vétérinaire" placeholder="Dr. Martin"
            autoCapitalize="words" returnKeyType="next" />

          <Champ valeur={form.vetTelephone} onChange={v => majChamp('vetTelephone', v)}
            label="Téléphone du vétérinaire" placeholder="06 12 34 56 78"
            keyboardType="phone-pad" returnKeyType="next" />

          <Champ valeur={form.email} onChange={v => majChamp('email', v)}
            label="Adresse e-mail" placeholder="jean-yves@exploitation.fr" obligatoire
            keyboardType="email-address" autoCapitalize="none"
            autoCorrect={false} returnKeyType="next" />

          <Text style={styles.label}>Mot de passe *</Text>
          <View style={styles.champMdpContainer}>
            <TextInput
              style={styles.champMdpInput}
              value={form.motDePasse}
              onChangeText={v => majChamp('motDePasse', v)}
              placeholder="Minimum 8 caractères"
              placeholderTextColor={COULEURS.TEXTE_SECONDAIRE}
              secureTextEntry={!voirMdp}
              editable={!chargement}
              blurOnSubmit={false}
              returnKeyType="next"
            />
            <TouchableOpacity onPress={() => setVoirMdp(v => !v)} style={styles.iconeOeil}>
              <Ionicons name={voirMdp ? 'eye-off' : 'eye'} size={20} color={COULEURS.TEXTE_SECONDAIRE} />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Confirmer le mot de passe *</Text>
          <View style={styles.champMdpContainer}>
            <TextInput
              style={styles.champMdpInput}
              value={form.confirmerMdp}
              onChangeText={v => majChamp('confirmerMdp', v)}
              placeholder="Répétez le mot de passe"
              placeholderTextColor={COULEURS.TEXTE_SECONDAIRE}
              secureTextEntry={!voirConfirm}
              editable={!chargement}
              blurOnSubmit={false}
              returnKeyType="done"
              onSubmitEditing={sInscrire}
            />
            <TouchableOpacity onPress={() => setVoirConfirm(v => !v)} style={styles.iconeOeil}>
              <Ionicons name={voirConfirm ? 'eye-off' : 'eye'} size={20} color={COULEURS.TEXTE_SECONDAIRE} />
            </TouchableOpacity>
          </View>

          <Text style={styles.mentionObligatoire}>* Champs obligatoires</Text>

          <TouchableOpacity
            style={[styles.bouton, chargement && styles.boutonDesactive]}
            onPress={sInscrire}
            disabled={chargement}
            activeOpacity={0.85}
          >
            {chargement ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.boutonTexte}>Créer mon compte éleveur</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fond:    { flex: 1, backgroundColor: COULEURS.FOND_PRINCIPAL },
  centrer: { justifyContent: 'center', alignItems: 'center', padding: 32 },
  scroll:  { flexGrow: 1, padding: 24, paddingBottom: 48 },
  header:  { marginBottom: 24, paddingTop: Platform.OS === 'ios' ? 12 : 4 },
  retour:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  retourTexte:   { color: COULEURS.VERT_PRINCIPAL, fontSize: 16, fontWeight: '600' },
  titrePage:     { fontSize: 26, fontWeight: '800', color: COULEURS.TEXTE_PRINCIPAL, marginBottom: 4 },
  sousTitrePage: { fontSize: 14, color: COULEURS.TEXTE_SECONDAIRE },
  card: {
    backgroundColor: COULEURS.FOND_CARD,
    borderRadius: 12, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  erreurContainer: {
    backgroundColor: '#FDECEA', borderRadius: 8, padding: 12,
    marginBottom: 16, borderWidth: 1, borderColor: COULEURS.ROUGE_URGENCE,
  },
  erreurTexte: { color: COULEURS.ROUGE_URGENCE, fontSize: 14 },
  label: {
    color: COULEURS.TEXTE_SECONDAIRE, fontSize: 13,
    fontWeight: '600', marginBottom: 6, marginTop: 4,
  },
  input: {
    backgroundColor: COULEURS.FOND_INPUT, color: COULEURS.TEXTE_PRINCIPAL,
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 15, borderWidth: 1, borderColor: COULEURS.SEPARATEUR,
    marginBottom: 12, minHeight: 52,
  },
  rangee:             { flexDirection: 'row' },
  mentionObligatoire: { color: COULEURS.TEXTE_SECONDAIRE, fontSize: 12, marginBottom: 16 },
  sectionTitre: {
    fontSize:       14,
    fontWeight:     '700',
    color:          COULEURS.VERT_PRINCIPAL,
    marginTop:      16,
    marginBottom:   8,
    borderTopWidth: 1,
    borderTopColor: COULEURS.SEPARATEUR,
    paddingTop:     16,
  },
  bouton: {
    backgroundColor: COULEURS.VERT_PRINCIPAL, borderRadius: 8,
    height: 52, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 4, elevation: 2,
  },
  boutonDesactive: { opacity: 0.6 },
  boutonTexte:     { color: '#FFF', fontSize: 16, fontWeight: '700' },
  champMdpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COULEURS.FOND_INPUT,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COULEURS.SEPARATEUR,
    marginBottom: 12,
    minHeight: 52,
    paddingLeft: 14,
    paddingRight: 8,
  },
  champMdpInput: {
    flex: 1,
    fontSize: 15,
    color: COULEURS.TEXTE_PRINCIPAL,
    paddingVertical: 14,
  },
  iconeOeil: {
    padding: 6,
    marginLeft: 4,
  },
  succesIcone:  { fontSize: 56, marginBottom: 8 },
  succesToitre: { fontSize: 24, fontWeight: '800', color: COULEURS.TEXTE_PRINCIPAL, marginBottom: 12, textAlign: 'center' },
  succesTexte:  { color: COULEURS.TEXTE_SECONDAIRE, textAlign: 'center', marginBottom: 32, lineHeight: 22 },
});