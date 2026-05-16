# BoviSense 🐄

Application mobile de surveillance de troupeau bovin par IA, développée avec React Native + Expo + Supabase.

---

## Stack technique

| Technologie | Usage |
|---|---|
| React Native + Expo SDK 54 | Application mobile cross-platform |
| Expo Router v6 | Navigation file-based |
| Supabase | Auth + base de données PostgreSQL |
| react-native-maps | Carte interactive des vaches |
| expo-camera | Scan QR code des colliers |
| Azure AI (API REST) | Analyse de l'état de santé |

---

## Installation en 5 étapes

### Étape 1 — Installer les dépendances

```bash
cd bovisense
npm install --legacy-peer-deps
```

### Étape 2 — Créer le projet Supabase et configurer

1. Allez sur [supabase.com](https://supabase.com) → New Project
2. Notez votre **Project URL** et votre **anon/public key**
3. Ouvrez `lib/supabase.js` et remplacez :
   ```js
   const SUPABASE_URL  = 'VOTRE_SUPABASE_URL';
   const SUPABASE_ANON_KEY = 'VOTRE_SUPABASE_ANON_KEY';
   ```

### Étape 3 — Créer les tables (schéma SQL)

Dans le dashboard Supabase → **SQL Editor** → New query, collez et exécutez le contenu de :

```
supabase/schema.sql
```

### Étape 4 — Charger les données de démo

1. Dans **Authentication → Users → Add user**, créez l'utilisateur :
   - Email : `jean-yves@bovisense.fr`
   - Password : `Demo1234!`
2. Copiez l'UUID généré
3. Dans `supabase/seeds_demo.sql`, remplacez `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa` par cet UUID
4. Exécutez le fichier dans le **SQL Editor**

### Étape 5 — Lancer l'application

```bash
npx expo start
```

Scannez le QR code avec **Expo Go** (iOS ou Android).

---

## Compte de démonstration

| Champ | Valeur |
|---|---|
| Email | `jean-yves@bovisense.fr` |
| Mot de passe | `Demo1234!` |
| Exploitation | GAEC des Prés Verts |

---

## Configuration Google Maps (optionnel pour la production)

Pour utiliser Google Maps en build de production :

1. Obtenez une clé sur [Google Cloud Console](https://console.cloud.google.com)
2. Activez les APIs : **Maps SDK for Android**, **Maps SDK for iOS**
3. Dans `app.json`, remplacez :
   - `VOTRE_GOOGLE_MAPS_IOS_KEY`
   - `VOTRE_GOOGLE_MAPS_ANDROID_KEY`

> En développement avec **Expo Go**, la carte fonctionne sans clé API.

---

## Structure du projet

```
bovisense/
├── app/
│   ├── _layout.jsx          — Auth guard global
│   ├── (auth)/
│   │   ├── login.jsx        — Connexion
│   │   └── register.jsx     — Création de compte
│   └── (app)/
│       ├── _layout.jsx      — Tab navigator
│       ├── index.jsx        — Tableau de bord
│       ├── map.jsx          — Carte du troupeau
│       └── settings.jsx     — Paramètres
├── constants/
│   └── couleurs.js          — Charte graphique
├── lib/
│   └── supabase.js          — Client Supabase
├── services/
│   └── aiService.js         — API Azure IA
└── supabase/
    ├── schema.sql           — Schéma BDD
    └── seeds_demo.sql       — Données de démo
```

---

## Fonctionnalités

- **Authentification** — Connexion / inscription avec Supabase Auth
- **Tableau de bord** — Vue d'ensemble du troupeau avec alertes urgences
- **Analyse IA** — Appel Azure pour prédire l'état de chaque animal
- **Carte interactive** — Marqueurs colorés, panneau info, navigation GPS
- **Gestion des colliers** — Ajout via formulaire ou scan QR
- **Gestion du vétérinaire** — Appel direct depuis l'app

---

## Charte graphique

| Couleur | Code | Usage |
|---|---|---|
| Fond principal | `#0D1B0F` | Fond d'écran |
| Vert bouton | `#40916C` | Actions principales |
| Rouge urgence | `#D62828` | Alertes critiques |
| Orange alerte | `#F4A261` | Boiterie |
| Jaune chaleurs | `#E9C46A` | Détection chaleurs |
