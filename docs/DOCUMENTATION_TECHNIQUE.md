# 🐄 BoviSense — Documentation Technique Complète

![React Native](https://img.shields.io/badge/React_Native-0.81.5-61DAFB?logo=react)
![Expo](https://img.shields.io/badge/Expo_SDK-54-000020?logo=expo)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)
![Azure](https://img.shields.io/badge/Azure-App_Service-0078D4?logo=microsoftazure)
![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python)
![GitHub Actions](https://img.shields.io/badge/CI%2FCD-GitHub_Actions-2088FF?logo=githubactions)

---

## Table des matières

1. [Présentation du projet](#1-présentation-du-projet)
2. [Architecture globale](#2-architecture-globale)
3. [Intelligence Artificielle](#3-intelligence-artificielle)
4. [Backend & Base de données](#4-backend--base-de-données)
5. [Application Mobile](#5-application-mobile)
6. [Fonctionnalités détaillées](#6-fonctionnalités-détaillées)
7. [Scripts Python](#7-scripts-python)
8. [CI/CD & Déploiement](#8-cicd--déploiement)
9. [Sécurité & RGPD](#9-sécurité--rgpd)
10. [Mode hors ligne](#10-mode-hors-ligne)
11. [Modèle économique](#11-modèle-économique)
12. [Perspectives d'évolution](#12-perspectives-dévolution)
13. [Guide d'installation](#13-guide-dinstallation)
14. [Glossaire technique](#14-glossaire-technique)

---

## 1. 🎯 Présentation du projet

### Contexte et problématique

L'élevage bovin est un secteur soumis à des contraintes sanitaires et économiques croissantes. En France, une vache laitière en bonne santé représente un actif de plusieurs milliers d'euros. Les pathologies non détectées à temps — boiteries, chutes, chaleurs — engendrent des pertes importantes :

- **Boiterie non traitée** : ~250 € de perte par vache (baisse de production, frais vétérinaires, réforme anticipée)
- **Chute** : risque vital immédiat, intervention d'urgence nécessaire
- **Chaleurs manquées** : fenêtre de reproduction perdue, coût d'insémination supplémentaire (~200 €)

La surveillance manuelle d'un troupeau de 50 à 200 têtes est insuffisante, surtout la nuit ou en pâturage éloigné.

### Solution proposée

**BoviSense** est une solution IoT + IA de surveillance temps réel du bien-être animal bovin. Elle repose sur :

- Des **colliers connectés** équipés de capteurs (accéléromètre, thermomètre, GPS) transmettant via **LoRaWAN**
- Un **modèle d'IA (Random Forest)** déployé sur Azure pour classifier l'état de santé toutes les 2 heures
- Une **application mobile** (iOS/Android) permettant à l'éleveur de suivre son troupeau en temps réel depuis son smartphone

### Stack technologique complète

| Couche | Technologies |
|--------|-------------|
| **Application mobile** | React Native 0.81.5, Expo SDK 54, Expo Router v6, React 19 |
| **Base de données** | Supabase (PostgreSQL), Supabase Auth, Supabase Realtime |
| **Intelligence artificielle** | Python, Scikit-learn (Random Forest), Azure App Service |
| **Cartographie** | react-native-maps, Google Maps API |
| **Notifications** | expo-notifications (push notifications) |
| **Réseau IoT** | LoRaWAN (simulation Python) |
| **CI/CD** | GitHub Actions, EAS Build (Expo Application Services) |
| **Météo** | Open-Meteo API (gratuite, sans clé) |
| **Stockage local** | AsyncStorage (@react-native-async-storage) |
| **Connectivité** | @react-native-community/netinfo |
| **Scripts de données** | Python 3.10+, requests, supabase-py |

---

## 2. 🏗️ Architecture globale

### Schéma de l'architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         TERRAIN                                  │
│                                                                  │
│   🐄 Vache                                                       │
│   ┌──────────────┐                                               │
│   │ Collier IoT  │  (accéléromètre + thermomètre + GPS)         │
│   │  LoRaWAN     │                                               │
│   └──────┬───────┘                                               │
│          │ Radio LoRa (868 MHz, portée ~15 km)                   │
│          ▼                                                        │
│   ┌──────────────┐                                               │
│   │   Antenne    │  (LoRaWAN Gateway)                            │
│   │  LoRaWAN     │                                               │
│   └──────┬───────┘                                               │
└──────────┼──────────────────────────────────────────────────────┘
           │ HTTPS / MQTT
           ▼
┌─────────────────────────────────────────────────────────────────┐
│                          CLOUD                                    │
│                                                                  │
│   ┌──────────────────┐        ┌──────────────────────────────┐  │
│   │  Azure App       │        │        Supabase               │  │
│   │  Service         │        │  ┌──────────────────────┐    │  │
│   │                  │        │  │  PostgreSQL           │    │  │
│   │  POST /api/      │        │  │  - profiles           │    │  │
│   │  predict         │◄──────►│  │  - colliers           │    │  │
│   │                  │        │  │  - veterinaires       │    │  │
│   │  Random Forest   │        │  │  - historique_sante   │    │  │
│   │  Scikit-learn    │        │  └──────────────────────┘    │  │
│   │                  │        │                               │  │
│   └──────────────────┘        │  Supabase Auth (JWT)         │  │
│                               │  Supabase Realtime (WS)      │  │
│   ┌──────────────────┐        │  Row Level Security          │  │
│   │  Open-Meteo API  │        └──────────────────────────────┘  │
│   │  (météo temps    │                                           │
│   │   réel)          │                                           │
│   └──────────────────┘                                           │
└─────────────────────────────────────────────────────────────────┘
           │ HTTPS + WebSocket
           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      APPLICATION MOBILE                           │
│                                                                  │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │              React Native + Expo SDK 54                   │  │
│   │                                                           │  │
│   │  ┌─────────┐  ┌─────────┐  ┌───────────┐  ┌──────────┐ │  │
│   │  │ Accueil │  │  Carte  │  │ Historique│  │ Réglages │ │  │
│   │  │Dashboard│  │ (Maps)  │  │  7 jours  │  │ Profil   │ │  │
│   │  └─────────┘  └─────────┘  └───────────┘  └──────────┘ │  │
│   │                                                           │  │
│   │  AsyncStorage (cache hors ligne)                         │  │
│   │  expo-notifications (alertes push)                       │  │
│   └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
           │
           ▼
   📱 Smartphone éleveur
```

### Flux de données complet

```
1. [Capteur] Toutes les 2h → mesure (pas, repos, température, GPS)
       │
       ▼
2. [LoRaWAN] Transmission radio → Gateway → réseau IP
       │
       ▼
3. [Script Python] simulateur_iot.py reçoit / simule les données
       │
       ▼
4. [Azure AI] POST /api/predict → Random Forest → état + fiabilité
       │
       ▼
5. [Supabase] UPDATE colliers + INSERT historique_sante
       │
       ├── 5a. [Realtime] WebSocket → app mobile notifiée en temps réel
       │
       └── 5b. Si alerte → expo-notifications → push notification
       │
       ▼
6. [App Mobile] Affichage mis à jour (dashboard, carte, historique)
```

### Composants et leur rôle

| Composant | Rôle |
|-----------|------|
| `lib/supabase.js` | Client Supabase (auth + DB + realtime) |
| `services/aiService.js` | Appels HTTP vers Azure AI |
| `services/cache.js` | Gestion cache AsyncStorage |
| `services/connexion.js` | Détection état réseau |
| `services/notifications.js` | Enregistrement et envoi push |
| `services/scheduler.js` | Tâches de fond planifiées |
| `constants/normalisation.js` | Normalisation des états santé |
| `constants/couleurs.js` | Palette de couleurs de l'app |
| `components/BanniereHorsLigne.jsx` | Bandeau mode hors ligne |
| `components/Toast.jsx` | Notifications in-app |

---

## 3. 🤖 Intelligence Artificielle

### Modèle Random Forest (Scikit-learn)

Le cœur analytique de BoviSense est un **classificateur Random Forest** entraîné sur des données comportementales et physiologiques bovines. Ce modèle est déployé sur Azure App Service et expose une API REST.

**Caractéristiques du modèle :**

| Paramètre | Valeur |
|-----------|--------|
| Algorithme | Random Forest Classifier |
| Librairie | Scikit-learn (Python) |
| Nombre d'estimateurs | 100 arbres |
| Critère | Gini impurity |
| Déploiement | Azure App Service (France Central) |

### Dataset d'entraînement

Le dataset combine des **données réelles** issues de capteurs bovins (accéléromètres, thermomètres) et des **données simulées** via chaîne de Markov pour augmenter la représentation des états rares (chute, boiterie sévère).

```
Dataset composition :
- ~70% données simulées (chaîne de Markov calibrée)
- ~30% données réelles (partenariat éleveurs pilotes)
- Équilibrage par sur-échantillonnage des classes minoritaires
```

### Features utilisées

| Feature | Description | Unité | Plage normale |
|---------|-------------|-------|---------------|
| `Pas_2h` | Nombre de pas sur 2 heures | entier | 300–700 |
| `Repos_min_2h` | Minutes de repos sur 2 heures | entier | 40–80 |
| `Temp_Corp_C` | Température corporelle | °C | 38.2–39.0 |
| `Temp_Ext_C` | Température extérieure | °C | variable |

### Classes de sortie

| Classe | Code | Description | Urgence |
|--------|------|-------------|---------|
| `Normale` | 0 | Vache en bonne santé | Aucune |
| `En chaleur` | 1 | Période de reproduction | Faible |
| `Boiterie légère` | 2 | Gêne locomotrice modérée | Modérée |
| `Boiterie sévère` | 3 | Trouble locomoteur grave | Haute |
| `Chute` | 4 | Vache à terre, urgence vitale | Critique |

### Performance du modèle

**Précision globale : ~92%**

| Classe | Précision | Rappel | F1-Score |
|--------|-----------|--------|----------|
| Normale | 0.95 | 0.97 | 0.96 |
| En chaleur | 0.89 | 0.86 | 0.87 |
| Boiterie légère | 0.88 | 0.84 | 0.86 |
| Boiterie sévère | 0.91 | 0.89 | 0.90 |
| Chute | 0.96 | 0.94 | 0.95 |

> Note : Les classes rares (Chute, Boiterie sévère) bénéficient d'un sur-échantillonnage pour garantir une détection fiable malgré leur faible fréquence réelle.

### Déploiement sur Azure App Service

```
URL de base : https://bovisens-gzguhzapdug4arc6.francecentral-01.azurewebsites.net
Région      : France Central
Runtime     : Python 3.10
Tier        : App Service (Standard)
```

### Endpoint API : POST /api/predict

**Requête :**
```json
{
  "ID_Vache": "V-045",
  "Pas_2h": 12,
  "Repos_min_2h": 115,
  "Temp_Corp_C": 39.8,
  "Temp_Ext_C": 14.2
}
```

**Réponse :**
```json
{
  "etat": "Chute",
  "fiabilite": 0.97,
  "classe": 4
}
```

**Intégration côté app (services/aiService.js) :**
```js
const AZURE_URL = 'https://bovisens-gzguhzapdug4arc6.francecentral-01.azurewebsites.net/api/predict';

export async function analyserVache(donnees) {
  const response = await fetch(AZURE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(donnees),
  });
  return response.json(); // { etat, fiabilite, classe }
}
```

### Chaîne de Markov pour simulation

Les scripts Python utilisent une **matrice de transition de Markov** pour simuler des séquences réalistes d'états de santé (un état à un moment t influence l'état à t+2h) :

```python
MATRICE_TRANSITION = {
    'Normale':          [0.85, 0.06, 0.05, 0.02, 0.02],
    'En chaleur':       [0.60, 0.35, 0.03, 0.01, 0.01],
    'Boiterie légère':  [0.30, 0.05, 0.50, 0.13, 0.02],
    'Boiterie sévère':  [0.10, 0.02, 0.25, 0.55, 0.08],
    'Chute':            [0.05, 0.01, 0.10, 0.20, 0.64],
}
# Colonnes : [Normale, En chaleur, Boiterie légère, Boiterie sévère, Chute]
```

---

## 4. 🗄️ Backend & Base de données

### Supabase PostgreSQL

BoviSense utilise **Supabase** comme Backend-as-a-Service : base de données PostgreSQL managée, authentification, Realtime et stockage.

```
Projet Supabase : bovisense
URL             : https://wsvqomiycexnfrclqwgq.supabase.co
Région          : EU West (conforme RGPD)
```

### Schéma complet des tables

#### Table `profiles`

Profil de l'éleveur, lié à `auth.users` de Supabase Auth.

```sql
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nom         TEXT,
  prenom      TEXT,
  exploitation TEXT,        -- Nom de l'exploitation (ex: "GAEC des Prés Verts")
  telephone   TEXT,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Table `colliers`

Représente un collier connecté attaché à une vache.

```sql
CREATE TABLE colliers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE,
  id_vache     TEXT NOT NULL,       -- Identifiant unique (ex: "V-045")
  nom_vache    TEXT,                -- Nom de la vache (ex: "Marguerite")
  numero_vache TEXT,               -- Numéro d'identification officiel
  latitude     DOUBLE PRECISION,   -- Dernière position GPS
  longitude    DOUBLE PRECISION,
  etat_sante   TEXT DEFAULT 'Saine',  -- État IA courant
  derniere_maj TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  pas_2h       INTEGER,            -- Dernière mesure de pas
  repos_min_2h INTEGER,            -- Dernières minutes de repos
  temp_corp_c  DOUBLE PRECISION,   -- Dernière température corporelle
  temp_ext_c   DOUBLE PRECISION,   -- Dernière température extérieure
  en_paturage  BOOLEAN DEFAULT TRUE
);
```

#### Table `veterinaires`

Annuaire des vétérinaires associés à l'exploitation.

```sql
CREATE TABLE veterinaires (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID REFERENCES profiles(id) ON DELETE CASCADE,
  nom       TEXT NOT NULL,
  prenom    TEXT,
  telephone TEXT,
  adresse   TEXT,
  latitude  DOUBLE PRECISION,   -- Position du cabinet
  longitude DOUBLE PRECISION
);
```

#### Table `historique_sante`

Journal de toutes les mesures et diagnostics IA, utilisé pour l'historique 7 jours.

```sql
CREATE TABLE historique_sante (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collier_id      UUID REFERENCES colliers(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE,
  id_vache        TEXT,
  etat_sante      TEXT NOT NULL,          -- État diagnostiqué par l'IA
  fiabilite_ia    DOUBLE PRECISION,       -- Score de confiance (0.0 – 1.0)
  pas_2h          INTEGER,
  repos_min_2h    INTEGER,
  temp_corp_c     DOUBLE PRECISION,
  temp_ext_c      DOUBLE PRECISION,
  date_diagnostic TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Row Level Security (RLS)

Toutes les tables ont la RLS activée. Chaque éleveur ne peut accéder qu'à ses propres données.

```sql
-- Exemple sur la table colliers (même pattern pour toutes les tables)
ALTER TABLE colliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_own ON colliers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY insert_own ON colliers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY update_own ON colliers
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY delete_own ON colliers
  FOR DELETE USING (auth.uid() = user_id);
```

### Trigger de création de profil

À chaque inscription, Supabase Auth appelle automatiquement :

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### Nettoyage automatique (rétention 7 jours)

```sql
-- supabase/nettoyage.sql
CREATE OR REPLACE FUNCTION nettoyer_historique()
RETURNS void AS $$
BEGIN
  DELETE FROM historique_sante
  WHERE date_diagnostic < NOW() - INTERVAL '7 days'
    AND etat_sante = 'Normale';
  -- Les alertes confirmées et états graves sont conservés indéfiniment
END;
$$ LANGUAGE plpgsql;

-- Déclenchement via pg_cron (tous les jours à 3h du matin)
SELECT cron.schedule('nettoyage-historique', '0 3 * * *', 'SELECT nettoyer_historique()');
```

### Supabase Realtime

L'application s'abonne aux changements en temps réel sur la table `colliers` :

```js
// lib/supabase.js
const channel = supabase
  .channel('colliers-realtime')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'colliers',
    filter: `user_id=eq.${userId}`,
  }, (payload) => {
    // Mise à jour de l'état local (dashboard + carte)
    onCollierUpdate(payload.new);
  })
  .subscribe();
```

### Authentification Supabase Auth

- Email + mot de passe (pas de OAuth dans cette version)
- JWT stocké localement via AsyncStorage
- Session persistante entre les lancements de l'app
- Création automatique du profil via trigger PostgreSQL

---

## 5. 📱 Application Mobile

### React Native + Expo SDK 54

| Technologie | Version | Rôle |
|-------------|---------|------|
| React Native | 0.81.5 | Framework mobile cross-platform |
| React | 19.1.0 | Library UI |
| Expo SDK | 54 | Outils et modules natifs |
| Expo Router | 6.0.23 | Routing file-based (type-safe) |
| New Architecture | activée | Moteur JSI + Fabric |

### Expo Router (file-based routing)

L'application utilise le routage basé sur les fichiers d'Expo Router v6, similaire à Next.js :

```
app/
├── _layout.jsx          # Guard d'authentification (racine)
├── loading.jsx          # Écran de chargement
├── (auth)/              # Groupe public (pas de tab bar)
│   ├── _layout.jsx
│   ├── login.jsx        # → /login
│   └── register.jsx     # → /register
└── (app)/               # Groupe protégé (navigation par onglets)
    ├── _layout.jsx      # Définition des 4 onglets
    ├── index.jsx        # → / (Accueil / Dashboard)
    ├── map.jsx          # → /map (Carte interactive)
    ├── historique.jsx   # → /historique (Historique santé)
    ├── settings.jsx     # → /settings (Paramètres)
    └── rgpd.jsx         # → /rgpd (Politique RGPD)
```

**Logique de garde (app/_layout.jsx) :**
```
Démarrage app
    ↓
Vérification session Supabase Auth
    ├── Session active → Redirect vers (app)/index
    └── Pas de session → Redirect vers (auth)/login
```

### Structure des fichiers et dossiers

```
bovisense/
├── app/                      # Écrans (Expo Router)
├── assets/                   # Images, icônes, splash
│   ├── logo_bovi_sense_clair.png
│   └── logo_bovi_sense_sombre.png
├── components/               # Composants réutilisables
│   ├── BanniereHorsLigne.jsx
│   └── Toast.jsx
├── constants/                # Configuration globale
│   ├── couleurs.js           # Palette (#0D1B0F, #40916C, etc.)
│   ├── normalisation.js      # Mapping états → labels/couleurs
│   └── theme.js              # Styles globaux
├── lib/
│   └── supabase.js           # Client Supabase singleton
├── scripts/                  # Scripts Python (IoT + historique)
├── services/                 # Logique métier
│   ├── aiService.js
│   ├── cache.js
│   ├── connexion.js
│   ├── notifications.js
│   └── scheduler.js
├── supabase/                 # Schémas et seeds SQL
│   ├── schema.sql
│   ├── historique.sql
│   ├── seeds_demo.sql
│   └── nettoyage.sql
├── utils/
│   └── temps.js              # Formatage dates/heures
├── app.json                  # Config Expo
├── eas.json                  # Config EAS Build
└── package.json
```

### Écrans

#### Login / Register (`(auth)/`)

- Formulaire email + mot de passe
- Validation des champs (format email, longueur mot de passe)
- Appel `supabase.auth.signInWithPassword()` / `signUp()`
- Redirection automatique après authentification

#### Home — Tableau de bord (`index.jsx`)

- Liste de toutes les vaches avec état de santé coloré
- Indicateurs temps réel mis à jour via Supabase Realtime
- Alertes visibles en haut (vaches en état critique)
- Météo locale (Open-Meteo API, géolocalisation device)
- Gestion étable/pâturage (switch `en_paturage`)
- Fausse alerte et confirmation d'intervention

#### Map — Carte interactive (`map.jsx`)

- Carte Google Maps avec marqueurs personnalisés par état
- Couleurs des marqueurs : vert (Saine), orange (Boiterie), rouge (Chute), violet (Chaleurs)
- Recherche de vache par nom ou identifiant
- Info-bulle au tap : nom, état, température, dernière MAJ
- Appel vétérinaire direct depuis la fiche

#### Historique (`historique.jsx`)

- Vue globale troupeau : timeline des états sur 7 jours
- Vue par vache : graphe chronologique détaillé
- Données de `historique_sante` (pas, repos, températures)
- Antécédents permanents (alertes graves conservées au-delà de 7j)

#### Settings — Paramètres (`settings.jsx`)

- Modification profil (nom, exploitation, téléphone)
- Gestion des notifications push
- Ajout/modification de vétérinaires
- Déconnexion

#### RGPD (`rgpd.jsx`)

- Politique de confidentialité complète
- Données collectées, durée de conservation
- Droits de l'utilisateur (accès, suppression, portabilité)

---

## 6. ⚙️ Fonctionnalités détaillées

### Surveillance temps réel via Supabase Realtime

Supabase Realtime utilise des **WebSockets** pour diffuser les changements PostgreSQL. L'application s'abonne aux événements `INSERT`, `UPDATE`, `DELETE` sur `colliers` filtrés par `user_id`. La latence typique est inférieure à 200 ms.

### Détection IA et alertes push (expo-notifications)

```
Nouvelle donnée IoT
    ↓
Azure AI → état critique détecté (Chute / Boiterie sévère)
    ↓
Script Python appelle Supabase Edge Function ou
    ↓
App détecte le changement via Realtime
    ↓
expo-notifications → push notification avec vibration
    ↓
Notification : "🚨 Marguerite (V-045) — Chute détectée — Intervenir immédiatement"
```

Permissions requises : `ACCESS_FINE_LOCATION`, `RECEIVE_BOOT_COMPLETED`, `VIBRATE` (Android).

### Géolocalisation et cartographie

- **react-native-maps 1.18.0** avec provider Google Maps
- Clé API Google Maps configurée dans `app.json` (iOS + Android)
- Marqueurs personnalisés avec icône vache et couleur d'état
- Zoom automatique sur le troupeau au chargement
- Mise à jour des positions à chaque cycle IoT (toutes les 2h)

### Mode hors ligne (AsyncStorage cache)

Voir [section 10](#10-mode-hors-ligne) pour les détails complets.

### Historique médical

- **7 jours** de mesures toutes les 2h (84 points de données par vache)
- **Antécédents permanents** : alertes graves (`Chute`, `Boiterie sévère`) jamais supprimées
- Nettoyage automatique des entrées `Normale` après 7 jours (cron PostgreSQL)

### Gestion étable / pâturage

Chaque collier dispose d'un champ `en_paturage (BOOLEAN)`. Le simulateur Python ne traite que les vaches `en_paturage=true`. L'app permet de basculer une vache entre étable et pâturage d'un swipe.

### Fausse alerte et confirmation

L'éleveur peut :
1. **Confirmer** une alerte → elle est archivée comme vraie alerte
2. **Marquer fausse alerte** → signale un faux positif, amélioration future du modèle

### Météo temps réel (Open-Meteo API)

```js
// services/meteo.js - Appel sans clé API
const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`;
const { current_weather } = await fetch(url).then(r => r.json());
// → { temperature, windspeed, weathercode }
```

Utilisée pour afficher la météo locale sur le dashboard et pour enrichir les données IoT (Temp_Ext_C).

### Recherche de vache sur la carte

Barre de recherche en overlay sur la carte :
- Filtrage par `nom_vache` ou `id_vache`
- Zoom automatique sur la vache sélectionnée
- Ouverture de la fiche détaillée

### Appel vétérinaire direct

Dans la fiche d'une vache en alerte, bouton "Appeler le vétérinaire" :
```js
import { Linking } from 'react-native';
Linking.openURL(`tel:${veterinaire.telephone}`);
```

---

## 7. 🐍 Scripts Python

### `scripts/simulateur_iot.py`

**Rôle :** Simule des données IoT en temps réel pour toutes les vaches `en_paturage=true`, toutes les 2 heures.

**Flux d'exécution :**

```
1. Récupérer liste vaches (Supabase : colliers WHERE en_paturage=true)
2. Pour chaque vache :
   a. Tirer un état selon distribution pondérée
      (8/12 Normale, 1/12 Chute, 1/12 Chaleurs, etc.)
   b. Générer données capteurs selon l'état
   c. Appeler Azure AI POST /api/predict
   d. UPDATE colliers SET etat_sante, pas_2h, temp_corp_c...
   e. INSERT INTO historique_sante
3. Afficher résultats : "✅ V-045 Marguerite → Chute (97%)"
4. Attendre 2 heures → recommencer
```

**Variables d'environnement requises :**
```bash
SUPABASE_URL=https://wsvqomiycexnfrclqwgq.supabase.co
SUPABASE_KEY=<service_role_key>   # Clé service (bypass RLS)
```

**Dépendances Python :**
```
supabase>=2.0.0
requests>=2.28.0
python-dotenv>=1.0.0
```

### `scripts/generer_historique.py`

**Rôle :** Génère l'historique complet des 7 derniers jours pour toutes les vaches, en utilisant une chaîne de Markov pour des transitions réalistes entre états de santé.

**Algorithme de génération :**

```python
ETATS = {
    0: 'Normale',
    1: 'En chaleur',
    2: 'Boiterie légère',
    3: 'Boiterie sévère',
    4: 'Chute'
}

def generer_historique_complet(vaches):
    for vache in vaches:
        etat_courant = 'Normale'  # État initial
        
        for jour in range(7, 0, -1):
            date = datetime.now() - timedelta(days=jour)
            
            for heure in range(0, 24, 2):  # 12 tranches/jour
                # Transition Markov
                etat_courant = transition_markov(etat_courant)
                
                # Générer données capteurs cohérentes avec l'état
                donnees = generer_donnees_vache(etat_courant, heure)
                
                # Appel Azure AI
                resultat = appeler_azure(donnees)
                
                # Insérer dans historique_sante
                inserer_historique_batch(vache, donnees, resultat, date)
        
        # Mettre à jour l'état courant du collier
        mettre_a_jour_collier(vache['id'], etat_courant)
```

**Génération de données capteurs par état :**

| État | Pas_2h | Repos_min_2h | Temp_Corp_C |
|------|--------|--------------|-------------|
| Normale | 400–700 | 40–80 | 38.2–39.0 |
| En chaleur | 700–1200 | 15–35 | 38.5–39.2 |
| Boiterie légère | 150–350 | 80–100 | 38.8–39.4 |
| Boiterie sévère | 50–200 | 90–110 | 39.0–39.8 |
| Chute | 0–20 | 110–120 | 39.5–40.5 |

**Récupération météo temps réel :**
```python
def obtenir_temp_ext():
    # Open-Meteo API — région Rennes (coordonnées démo)
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": 48.07,
        "longitude": -1.63,
        "current_weather": True
    }
    resp = requests.get(url, params=params, timeout=5)
    return resp.json()["current_weather"]["temperature"]
```

### Variables d'environnement

Créer un fichier `scripts/.env` à partir du template `scripts/.env.example` :

```bash
# scripts/.env
SUPABASE_URL=https://wsvqomiycexnfrclqwgq.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> ⚠️ **Utiliser la clé `service_role`** (et non `anon`) pour que les scripts Python puissent bypasser les politiques RLS et écrire pour tous les utilisateurs.

---

## 8. 🚀 CI/CD & Déploiement

### GitHub Actions — Build APK automatique

**Fichier :** `.github/workflows/build.yml`

```yaml
name: Build APK BoviSense

on:
  push:
    branches: [ main ]
  workflow_dispatch:        # Déclenchement manuel possible

jobs:
  build:
    name: Build Android APK
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm install --legacy-peer-deps

      - name: Setup EAS CLI
        uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}    # Secret GitHub Actions

      - name: Build APK (preview)
        run: eas build --platform android --profile preview --non-interactive
```

**Résultat :** Un APK téléchargeable depuis le dashboard Expo (expo.dev), lien partageable.

### EAS Build (Expo Application Services)

**Fichier :** `eas.json`

```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"   // APK direct (pas AAB), installable sans Play Store
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"  // AAB pour soumission Play Store
      },
      "ios": {
        "simulator": false
      }
    }
  }
}
```

| Profil | Format | Usage |
|--------|--------|-------|
| `preview` | APK | Tests internes, démo client |
| `production` | AAB (Android) / IPA (iOS) | Stores officiels |

### Déploiement Azure App Service (IA Python)

```
Service    : Azure App Service
Nom        : bovisens
Région     : France Central
Runtime    : Python 3.10
URL        : https://bovisens-gzguhzapdug4arc6.francecentral-01.azurewebsites.net
Endpoint   : POST /api/predict
```

Le modèle Scikit-learn est sérialisé avec `joblib` et chargé au démarrage du serveur Flask/FastAPI.

### Supabase — Hébergement BDD

```
Organisation : bovisense
Région       : EU West (Amsterdam)
PostgreSQL   : 15.x (managé)
Réplication  : automatique (Supabase gère les backups)
Realtime     : activé sur la table colliers
```

---

## 9. 🔒 Sécurité & RGPD

### Authentification JWT via Supabase

```
Flux d'authentification :
1. Utilisateur → email + mot de passe
2. Supabase Auth → valide les credentials
3. Supabase → retourne access_token (JWT, durée 1h) + refresh_token
4. App → stocke les tokens dans AsyncStorage
5. Toutes les requêtes API → header Authorization: Bearer <JWT>
6. JWT expiré → renouvellement automatique via refresh_token
```

### Row Level Security sur toutes les tables

Chaque requête SQL est filtrée automatiquement par PostgreSQL selon le JWT de l'utilisateur. Il est **impossible** pour un éleveur d'accéder aux données d'un autre, même via l'API Supabase directe.

### Chiffrement HTTPS/TLS

- Toutes les communications app ↔ Supabase : **TLS 1.3**
- Toutes les communications app ↔ Azure AI : **HTTPS (TLS 1.2+)**
- Toutes les communications app ↔ Open-Meteo : **HTTPS**
- Certificats gérés automatiquement (Let's Encrypt côté Supabase et Azure)

### AsyncStorage sécurisé

Les données en cache local (AsyncStorage) contiennent uniquement des données de santé animale (non sensibles au sens RGPD). Les tokens d'authentification sont gérés par le SDK Supabase qui utilise `expo-secure-store` pour les environnements natifs.

### Politique de confidentialité intégrée

L'écran RGPD (`app/(app)/rgpd.jsx`) présente :
- Données collectées : email, nom exploitation, données santé bovines (GPS vaches — pas éleveur)
- Durée de conservation : 7 jours pour historique normal, indéfini pour alertes confirmées
- Droits : accès, rectification, suppression (via settings ou email contact)
- Responsable de traitement : étudiant projet BoviSense
- Pas de transfert hors UE (Supabase EU West, Azure France Central)

### Conformité RGPD

| Exigence RGPD | Implémentation |
|---------------|----------------|
| Consentement | Acceptation CGU à l'inscription |
| Minimisation des données | Seules les données strictement nécessaires sont collectées |
| Limitation de conservation | Nettoyage automatique à 7 jours |
| Sécurité | RLS + TLS + JWT |
| Droit à l'effacement | Suppression compte → cascade DELETE sur toutes les tables |
| Localisation des données | EU uniquement (Supabase EU West + Azure France Central) |

---

## 10. 📡 Mode hors ligne

### Détection connexion (@react-native-community/netinfo)

```js
// services/connexion.js
import NetInfo from '@react-native-community/netinfo';

export function ecouterConnexion(callback) {
  return NetInfo.addEventListener(state => {
    callback(state.isConnected && state.isInternetReachable);
  });
}
```

### Cache AsyncStorage avec clés `@bovisense:*`

| Clé | Contenu | TTL |
|-----|---------|-----|
| `@bovisense:colliers` | Liste des vaches + états | 2h |
| `@bovisense:historique` | Historique 7 jours | 2h |
| `@bovisense:profile` | Profil éleveur | 24h |
| `@bovisense:veterinaires` | Annuaire vétérinaires | 24h |
| `@bovisense:meteo` | Météo locale | 30min |

### Normalisation des états au chargement cache

Le module `constants/normalisation.js` harmonise les variations orthographiques des états santé issues du cache ou de l'API :

```js
// constants/normalisation.js
export const NORMALISATION_ETATS = {
  'saine': 'Saine',
  'normale': 'Saine',
  'normal': 'Saine',
  'chaleurs': 'En chaleur',
  'en chaleur': 'En chaleur',
  'boiterie_legere': 'Boiterie légère',
  'boiterie légère': 'Boiterie légère',
  'boiterie_severe': 'Boiterie sévère',
  'boiterie sévère': 'Boiterie sévère',
  'chute': 'Chute',
};
```

### Toast de reconnexion

```js
// components/Toast.jsx
// Affiché automatiquement quand la connexion est rétablie
<Toast message="Connexion rétablie — données mises à jour" type="success" />
```

### Bannière mode hors ligne

```js
// components/BanniereHorsLigne.jsx
// Affiché en permanence tant que hors ligne
<BanniereHorsLigne />
// → Bandeau rouge en haut : "Mode hors ligne — Dernière MAJ : il y a 5 min"
```

**Comportement global :**
```
Connexion perdue
    ↓
Affichage BanniereHorsLigne + données depuis cache AsyncStorage
    ↓
Connexion rétablie
    ↓
Suppression bannière + Toast "Connexion rétablie"
    ↓
Re-fetch Supabase + mise à jour cache
```

---

## 11. 💰 Modèle économique

### Coûts de déploiement

| Composant | Coût |
|-----------|------|
| Collier IoT (capteurs + batterie) | ~100 € / vache |
| Antenne LoRaWAN (couvre ~15 km) | ~2 000 € |
| Installation et configuration | ~500 € (une fois) |
| **Abonnement mensuel** | **1,50 € / vache / mois** |

### Rentabilité

| Exploitation | Vaches | Coût mensuel | ROI si 1 boiterie détectée |
|-------------|--------|-------------|---------------------------|
| Petite (50 vaches) | 50 | 75 €/mois | ~250 € économisés |
| Moyenne (100 vaches) | 100 | 150 €/mois | ~500 € économisés |
| Grande (200 vaches) | 200 | 300 €/mois | ~1 000 € économisés |

**1 boiterie détectée précocement = ~250 € économisés** (traitement préventif vs réforme anticipée)

**Retour sur investissement estimé : 4–6 mois** pour une exploitation de 100 vaches.

---

## 12. 🔭 Perspectives d'évolution

### Machine Learning dynamique

Intégration d'un pipeline de **réentraînement continu** : les données réelles collectées (avec confirmation éleveur) alimentent le modèle, améliorant sa précision au fil du temps pour chaque exploitation.

### Capteurs supplémentaires

- **Ruminomètre** : mesure du pH rumen (détection acidose)
- **Capteur de rumination** : durée de rumination = indicateur de santé digestive
- **Capteur d'humidité** : stress thermique

### Interopérabilité avec robots de traite

Connexion avec robots Lely Astronaut / DeLaval VMS pour enrichir les données (production laitière, conductivité — indicateur mammite).

### Mode dégradé IA

Si Azure AI est indisponible, le système bascule sur un **modèle allégé embarqué** (TensorFlow Lite) directement sur l'antenne LoRaWAN, garantissant une continuité de service.

### Publication App Store / Play Store

- **Android Play Store** : APK → AAB + soumission Google Play Console
- **Apple App Store** : build iOS via EAS + soumission Apple Connect
- Nécessite : compte développeur Apple (99 $/an) + Google (25 $ unique)

---

## 13. 🛠️ Guide d'installation

### Prérequis

| Outil | Version minimale | Installation |
|-------|-----------------|-------------|
| Node.js | 20.x LTS | nodejs.org |
| npm | 10.x | Inclus avec Node |
| Python | 3.10+ | python.org |
| Expo CLI | latest | `npm i -g expo-cli` |
| EAS CLI | latest | `npm i -g eas-cli` |
| Git | 2.x | git-scm.com |
| Expo Go (mobile) | latest | App Store / Play Store |

### Variables d'environnement

**Application mobile** — ces valeurs sont déjà dans `lib/supabase.js` (pour le projet démo) :
```js
const SUPABASE_URL = 'https://wsvqomiycexnfrclqwgq.supabase.co';
const SUPABASE_ANON_KEY = '<clé_anon_publique>';
```

**Scripts Python** — créer `scripts/.env` :
```bash
SUPABASE_URL=https://wsvqomiycexnfrclqwgq.supabase.co
SUPABASE_SERVICE_KEY=<clé_service_role>
```

### Installation pas à pas

```bash
# 1. Cloner le dépôt
git clone https://github.com/timeo-grrd/bovisense.git
cd bovisense

# 2. Installer les dépendances JavaScript
npm install --legacy-peer-deps

# 3. Configurer la base de données Supabase
# → Se connecter à supabase.com > SQL Editor
# → Exécuter supabase/schema.sql
# → Exécuter supabase/historique.sql
# → (Optionnel) Exécuter supabase/seeds_demo.sql pour les données de démo

# 4. Installer les dépendances Python
cd scripts
pip install supabase requests python-dotenv
cp .env.example .env
# → Éditer .env avec vos clés Supabase
cd ..

# 5. Générer l'historique de démo (optionnel)
cd scripts
python generer_historique.py
```

### Lancement développement

```bash
# Démarrer l'application Expo
npm start
# ou
expo start

# → Scanner le QR code avec Expo Go (iOS/Android)
# → Ou appuyer sur 'a' pour Android Emulator / 'i' pour iOS Simulator

# Démarrer le simulateur IoT (dans un terminal séparé)
cd scripts
python simulateur_iot.py
```

**Compte de démo :**
```
Email    : jean-yves@bovisense.fr
Mot de passe : Demo1234!
```

### Build production

```bash
# Connexion à votre compte Expo
eas login

# Build Android (APK — preview interne)
eas build --platform android --profile preview

# Build Android (AAB — Play Store)
eas build --platform android --profile production

# Build iOS (IPA — App Store)
eas build --platform ios --profile production
```

---

## 14. 📖 Glossaire technique

| Terme | Définition |
|-------|-----------|
| **LoRaWAN** | Long Range Wide Area Network — protocole radio basse consommation, longue portée (~15 km), utilisé pour les objets IoT en milieu agricole |
| **IoT** | Internet of Things — réseau d'objets physiques connectés capables de collecter et transmettre des données |
| **Random Forest** | Algorithme de machine learning basé sur un ensemble d'arbres de décision. Robuste, performant sur données tabulaires |
| **Scikit-learn** | Bibliothèque Python de machine learning de référence, utilisée pour entraîner et déployer le modèle Random Forest |
| **Chaîne de Markov** | Modèle probabiliste où l'état futur ne dépend que de l'état présent. Utilisé pour simuler des séquences réalistes d'états de santé |
| **RLS** | Row Level Security — mécanisme PostgreSQL qui filtre les lignes retournées selon des politiques d'accès, garantissant l'isolation des données par utilisateur |
| **JWT** | JSON Web Token — jeton signé utilisé pour authentifier les requêtes API sans état de session côté serveur |
| **AsyncStorage** | API React Native de stockage clé-valeur persistant côté client, utilisée pour le cache hors ligne |
| **Realtime** | Fonctionnalité Supabase qui diffuse les changements de base de données via WebSocket aux clients abonnés |
| **EAS** | Expo Application Services — service cloud d'Expo pour builder, signer et distribuer des applications React Native |
| **Expo Router** | Système de routing file-based pour React Native/Expo, inspiré de Next.js App Router |
| **New Architecture** | Nouvelle architecture React Native (JSI + Fabric + TurboModules) activée dans ce projet, offrant de meilleures performances |
| **Supabase** | Backend-as-a-Service open-source : PostgreSQL hébergé + Auth + Realtime + Storage |
| **Azure App Service** | Service PaaS Microsoft Azure pour déployer des applications web et APIs, utilisé ici pour héberger l'API Python du modèle IA |
| **Open-Meteo** | API météo open-source, gratuite et sans clé, utilisée pour récupérer la température extérieure en temps réel |
| **APK** | Android Package — format d'application Android installable directement (sans passer par le Play Store) |
| **AAB** | Android App Bundle — format d'application Android optimisé pour le Play Store |
| **pg_cron** | Extension PostgreSQL permettant de planifier des tâches SQL (comme le nettoyage de l'historique) |
| **TLS** | Transport Layer Security — protocole de chiffrement des communications réseau (successeur de SSL) |
| **GAEC** | Groupement Agricole d'Exploitation en Commun — forme juridique d'exploitation agricole en France |

---

*Documentation générée le 18 mai 2026 — Version 1.0.0*

*Projet BoviSense — Solution IoT + IA de surveillance bovine*
