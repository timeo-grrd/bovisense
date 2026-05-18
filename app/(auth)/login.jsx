import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Alert, StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { COULEURS } from '../../constants/couleurs';

export default function LoginScreen() {
  const [form, setForm]             = useState({ email: '', motDePasse: '' });
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur]         = useState(null);
  const [voirMdp, setVoirMdp]       = useState(false);

  const updateForm = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const seConnecter = async () => {
    if (!form.email.trim() || !form.motDePasse.trim()) {
      setErreur('Veuillez remplir tous les champs.');
      return;
    }
    try {
      setChargement(true);
      setErreur(null);
      const { data, error } = await supabase.auth.signInWithPassword({
        email:    form.email.trim().toLowerCase(),
        password: form.motDePasse,
      });
      if (error) throw error;
      if (data?.session) { router.replace('/(app)'); }
    } catch (e) {
      setErreur(
        e.message === 'Invalid login credentials'
          ? 'Email ou mot de passe incorrect.'
          : 'Erreur de connexion. Vérifiez votre réseau.'
      );
    } finally {
      setChargement(false);
    }
  };

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
        {/* Logo & titre */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/logo_bovi_sense_clair.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.logoTitre}>BOVISENSE</Text>
          <Text style={styles.logoSousTitre}>La santé de votre troupeau, dans votre poche.</Text>
        </View>

        {/* Erreur */}
        {erreur ? (
          <View style={styles.erreurContainer}>
            <Text style={styles.erreurTexte}>⚠️ {erreur}</Text>
          </View>
        ) : null}

        {/* Champ email */}
        <View style={styles.inputContainer}>
          <Ionicons name="mail-outline" size={20} color={COULEURS.TEXTE_SECONDAIRE} style={styles.inputIcone} />
          <TextInput
            style={styles.input}
            value={form.email}
            onChangeText={v => updateForm('email', v)}
            placeholder="eleveur@ferme.com"
            placeholderTextColor={COULEURS.TEXTE_SECONDAIRE}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!chargement}
            blurOnSubmit={false}
            returnKeyType="next"
          />
        </View>

        {/* Champ mot de passe */}
        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={20} color={COULEURS.TEXTE_SECONDAIRE} style={styles.inputIcone} />
          <TextInput
            style={styles.input}
            value={form.motDePasse}
            onChangeText={v => updateForm('motDePasse', v)}
            placeholder="••••••••"
            placeholderTextColor={COULEURS.TEXTE_SECONDAIRE}
            secureTextEntry={!voirMdp}
            editable={!chargement}
            blurOnSubmit={false}
            returnKeyType="done"
            onSubmitEditing={seConnecter}
          />
          <TouchableOpacity onPress={() => setVoirMdp(v => !v)} style={styles.iconeOeil}>
            <Ionicons name={voirMdp ? 'eye-off' : 'eye'} size={20} color={COULEURS.TEXTE_SECONDAIRE} />
          </TouchableOpacity>
        </View>

        {/* Bouton connexion */}
        <TouchableOpacity
          style={[styles.boutonConnexion, chargement && styles.boutonDesactive]}
          onPress={seConnecter}
          disabled={chargement}
          activeOpacity={0.85}
        >
          {chargement ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.boutonConnexionTexte}>Se connecter →</Text>
          )}
        </TouchableOpacity>

        {/* Mot de passe oublié */}
        <TouchableOpacity
          style={styles.lienOubliContainer}
          onPress={() => Alert.alert('Réinitialisation', 'Contactez votre administrateur pour réinitialiser votre mot de passe.')}
        >
          <Text style={styles.lienOubli}>Mot de passe oublié ?</Text>
        </TouchableOpacity>

        {/* Séparateur */}
        <View style={styles.separateurContainer}>
          <View style={styles.separateurLigne} />
          <Text style={styles.separateurTexte}>Pas encore de compte ?</Text>
          <View style={styles.separateurLigne} />
        </View>

        {/* Bouton inscription outline */}
        <TouchableOpacity
          style={[styles.boutonInscription, chargement && styles.boutonDesactive]}
          onPress={() => router.push('/(auth)/register')}
          disabled={chargement}
          activeOpacity={0.85}
        >
          <Text style={styles.boutonInscriptionTexte}>Créer mon compte éleveur</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fond: {
    flex: 1,
    backgroundColor: COULEURS.FOND_PRINCIPAL,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 48,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoImage: {
    width: 80,
    height: 80,
    marginBottom: 14,
  },
  logoTitre: {
    fontSize: 32,
    fontWeight: '800',
    color: COULEURS.TEXTE_PRINCIPAL,
    letterSpacing: 3,
    marginBottom: 8,
  },
  logoSousTitre: {
    fontSize: 14,
    color: COULEURS.TEXTE_SECONDAIRE,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 16,
  },
  erreurContainer: {
    backgroundColor: '#FDECEA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COULEURS.ROUGE_URGENCE,
  },
  erreurTexte: {
    color: COULEURS.ROUGE_URGENCE,
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COULEURS.FOND_INPUT,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COULEURS.SEPARATEUR,
    marginBottom: 14,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  inputIcone: {
    marginRight: 10,
  },
  iconeOeil: {
    padding: 6,
    marginLeft: 4,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: COULEURS.TEXTE_PRINCIPAL,
    paddingVertical: 14,
  },
  boutonConnexion: {
    backgroundColor: COULEURS.VERT_PRINCIPAL,
    borderRadius: 8,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  boutonDesactive: {
    opacity: 0.6,
  },
  boutonConnexionTexte: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  lienOubliContainer: {
    alignItems: 'center',
    paddingVertical: 6,
    marginBottom: 22,
  },
  lienOubli: {
    color: COULEURS.TEXTE_SECONDAIRE,
    fontSize: 13,
  },
  separateurContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  separateurLigne: {
    flex: 1,
    height: 1,
    backgroundColor: COULEURS.SEPARATEUR,
  },
  separateurTexte: {
    color: COULEURS.TEXTE_SECONDAIRE,
    fontSize: 13,
    marginHorizontal: 12,
  },
  boutonInscription: {
    borderWidth: 2,
    borderColor: COULEURS.VERT_PRINCIPAL,
    borderRadius: 8,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  boutonInscriptionTexte: {
    color: COULEURS.VERT_PRINCIPAL,
    fontSize: 16,
    fontWeight: '700',
  },
});
