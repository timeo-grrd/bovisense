import { View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function RGPDScreen() {
  return (
    <View style={styles.fond}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F0E8" />

      <View style={styles.entete}>
        <TouchableOpacity onPress={() => router.back()} style={styles.boutonRetour} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.enteteTitre}>Politique de confidentialité</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContenu}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.carte}>

          <Section titre="1. Responsable du traitement">
            <Paragraphe texte="BoviSense — Application mobile de surveillance bovine" />
            <Paragraphe texte="Développé dans le cadre d'un projet étudiant à Sup De Vinci" />
            <Paragraphe texte="Contact : bovisense.app@gmail.com" />
          </Section>

          <Section titre="2. Données collectées">
            <Paragraphe texte="Nous collectons les données suivantes :" />
            <Puce texte="Données de compte : adresse e-mail, nom, prénom, nom de l'exploitation, numéro de téléphone" />
            <Puce texte="Données du troupeau : identifiants des vaches, état de santé, données capteurs (pas, repos, température)" />
            <Puce texte="Données de localisation : coordonnées GPS des animaux" />
            <Puce texte="Données vétérinaires : nom et téléphone du vétérinaire" />
          </Section>

          <Section titre="3. Finalité du traitement">
            <Paragraphe texte="Les données sont utilisées pour :" />
            <Puce texte="Surveiller la santé du troupeau via intelligence artificielle" />
            <Puce texte="Envoyer des alertes en cas de situation critique" />
            <Puce texte="Générer un historique médical des animaux" />
            <Puce texte="Améliorer les algorithmes de détection de maladies" />
          </Section>

          <Section titre="4. Base légale">
            <Paragraphe texte="Le traitement repose sur :" />
            <Puce texte="L'exécution du contrat (utilisation de l'application)" />
            <Puce texte="Le consentement explicite de l'utilisateur" />
            <Puce texte="L'intérêt légitime de l'éleveur à surveiller son troupeau" />
          </Section>

          <Section titre="5. Conservation des données">
            <Puce texte="Diagnostics normaux : 7 jours glissants" />
            <Puce texte="Alertes confirmées et antécédents médicaux : durée indéfinie" />
            <Puce texte="Données de compte : jusqu'à suppression du compte" />
            <Puce texte="Données de localisation : non conservées au-delà de 24h" />
          </Section>

          <Section titre="6. Partage des données">
            <Paragraphe texte="Vos données sont hébergées sur :" />
            <Puce texte="Supabase (infrastructure cloud sécurisée, Union Européenne)" />
            <Puce texte="Microsoft Azure (modèle IA, France Central)" />
            <Paragraphe texte="Aucune donnée n'est vendue ou partagée à des tiers commerciaux." />
          </Section>

          <Section titre="7. Vos droits (RGPD)">
            <Paragraphe texte="Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits suivants :" />
            <Puce texte="Droit d'accès à vos données personnelles" />
            <Puce texte="Droit de rectification des données inexactes" />
            <Puce texte='Droit à l&apos;effacement ("droit à l&apos;oubli")' />
            <Puce texte="Droit à la portabilité de vos données" />
            <Puce texte="Droit d'opposition au traitement" />
            <Puce texte="Droit à la limitation du traitement" />
            <Paragraphe texte="Pour exercer ces droits, contactez-nous à : bovisense.app@gmail.com" />
          </Section>

          <Section titre="8. Sécurité">
            <Paragraphe texte="Nous mettons en œuvre les mesures suivantes :" />
            <Puce texte="Chiffrement des communications (HTTPS/TLS)" />
            <Puce texte="Authentification sécurisée via Supabase Auth" />
            <Puce texte="Accès aux données restreint par utilisateur (RLS)" />
            <Puce texte="Aucune donnée sensible stockée en clair" />
          </Section>

          <Section titre="9. Cookies et traceurs">
            <Paragraphe texte="L'application n'utilise pas de cookies." />
            <Paragraphe texte="Des données sont stockées localement sur votre appareil (AsyncStorage) uniquement pour le fonctionnement hors ligne." />
          </Section>

          <Section titre="10. Contact et réclamations">
            <Paragraphe texte="Pour toute question : bovisense.app@gmail.com" />
            <Paragraphe texte="Vous pouvez également saisir la CNIL :" />
            <Paragraphe texte="www.cnil.fr — 3 Place de Fontenoy, 75007 Paris" />
          </Section>

          <Text style={styles.dateMaj}>Dernière mise à jour : Mai 2026</Text>

        </View>
      </ScrollView>
    </View>
  );
}

function Section({ titre, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitre}>{titre}</Text>
      {children}
    </View>
  );
}

function Paragraphe({ texte }) {
  return <Text style={styles.paragraphe}>{texte}</Text>;
}

function Puce({ texte }) {
  return (
    <View style={styles.puceRow}>
      <Text style={styles.pucePuce}>•</Text>
      <Text style={styles.puceTexte}>{texte}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fond: {
    flex: 1,
    backgroundColor: '#F5F0E8',
  },
  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#DDDDDD',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  boutonRetour: {
    padding: 8,
    marginLeft: -4,
  },
  enteteTitre: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
    textAlign: 'center',
  },
  scroll: { flex: 1 },
  scrollContenu: { padding: 16, paddingBottom: 40 },
  carte: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  section: {
    marginTop: 20,
    marginBottom: 4,
  },
  sectionTitre: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D5016',
    marginBottom: 8,
  },
  paragraphe: {
    fontSize: 14,
    color: '#333333',
    lineHeight: 22,
    marginBottom: 4,
  },
  puceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
    paddingLeft: 4,
  },
  pucePuce: {
    fontSize: 14,
    color: '#2D5016',
    marginRight: 8,
    lineHeight: 22,
  },
  puceTexte: {
    flex: 1,
    fontSize: 14,
    color: '#333333',
    lineHeight: 22,
  },
  dateMaj: {
    marginTop: 24,
    fontSize: 12,
    color: '#666666',
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
