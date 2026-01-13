# 🌐 Web Interface Guide

L'interface web offre une expérience visuelle moderne et intuitive pour générer vos vidéos YouTube.

## 🚀 Lancement

```bash
# Démarrer le serveur
npm run server

# Ou en mode développement (auto-reload)
npm run server:dev
```

Le serveur sera disponible sur **http://localhost:3000**

## ✨ Fonctionnalités

### 1️⃣ Création de Vidéo
- **Sélection de chaîne** : Choisissez parmi What If, Human Odyssey, ou Classified Files
- **Saisie du sujet** : Entrez votre idée de vidéo
- **Mode de génération** : Vidéo complète ou Audio uniquement
- **Lancement en un clic** 🚀

### 2️⃣ Suivi en Temps Réel
- **Barre de progression** animée
- **Étapes visuelles** : Script → Audio → Assets → Download → Compose
- **Log en direct** : Voir exactement ce qui se passe
- **WebSocket** : Mises à jour instantanées

### 3️⃣ Historique
- **Liste des vidéos** générées récemment
- **Téléchargement direct** : Vidéo, Audio, Script
- **Métadonnées** : Date, heure, chaîne
- **Badges colorés** par chaîne

### 4️⃣ Statistiques
- Total de vidéos générées
- Vidéos créées cette semaine
- Durée moyenne
- Informations sur les coûts

## 🎨 Interface

### Page Principale
```
┌─────────────────────────────────────────────┐
│     🎬 YouTube Creator Studio Header        │
└─────────────────────────────────────────────┘
┌──────────────────────┬──────────────────────┐
│  Création de Vidéo   │   Historique         │
│  ┌────────────────┐  │  ┌────────────────┐  │
│  │ Sélect. Chaîne │  │  │ Vidéo récente  │  │
│  │ Sujet vidéo    │  │  │ ...            │  │
│  │ Mode génération│  │  └────────────────┘  │
│  │ [Generate]     │  │                      │
│  └────────────────┘  │  📊 Statistiques     │
│                      │  ┌────────────────┐  │
│  📊 Progression      │  │ Total: 12      │  │
│  ┌────────────────┐  │  │ Semaine: 3     │  │
│  │ ████░░░░░ 45%  │  │  └────────────────┘  │
│  └────────────────┘  │                      │
└──────────────────────┴──────────────────────┘
```

## 🔌 API Endpoints

### GET `/api/channels`
Récupère la liste des chaînes disponibles.

**Response:**
```json
[
  {
    "id": "what-if",
    "name": "What If...",
    "description": "Hypothetical scenarios",
    "theme": "sci-fi"
  }
]
```

### POST `/api/generate`
Lance la génération d'une vidéo.

**Request:**
```json
{
  "channelId": "what-if",
  "topic": "What if AI became conscious?",
  "mode": "full"
}
```

**Response:**
```json
{
  "jobId": "1736760000000",
  "status": "started"
}
```

### GET `/api/history`
Récupère l'historique des vidéos générées.

**Response:**
```json
[
  {
    "id": "1736760000000",
    "channel": "what-if",
    "title": "What If AI Became Conscious?",
    "timestamp": 1736760000000,
    "hasVideo": true,
    "hasAudio": true,
    "videoPath": "/output/videos/what-if-1736760000000.mp4"
  }
]
```

## 🔄 WebSocket Events

### Client → Server
- `subscribe(jobId)` : S'abonner aux mises à jour d'un job

### Server → Client
- `progress` : Mise à jour de progression
  ```json
  { "message": "🎤 Generating audio..." }
  ```

- `complete` : Génération terminée
  ```json
  {
    "jobId": "123",
    "videoPath": "/output/videos/video.mp4",
    "message": "Complete!"
  }
  ```

- `error` : Erreur survenue
  ```json
  { "jobId": "123", "error": "Failed to generate" }
  ```

## 🎯 Utilisation

1. **Ouvrez** http://localhost:3000 dans votre navigateur
2. **Sélectionnez** une chaîne dans le menu déroulant
3. **Entrez** le sujet de votre vidéo
4. **Cliquez** sur "🚀 Generate Video"
5. **Observez** la progression en temps réel
6. **Téléchargez** votre vidéo une fois terminée !

## 🔧 Configuration

Le serveur utilise les mêmes variables d'environnement que le CLI :
- `ANTHROPIC_API_KEY` : Pour Claude
- `PEXELS_API_KEY` : Pour les assets
- `PORT` : Port du serveur (défaut: 3000)

## 📱 Responsive Design

L'interface s'adapte automatiquement :
- **Desktop** : Mise en page 2 colonnes
- **Tablet** : Mise en page ajustée
- **Mobile** : Colonne unique

## 🎨 Thème Sombre

Interface moderne avec :
- Thème sombre par défaut (reposant pour les yeux)
- Couleurs selon les chaînes
- Animations fluides
- Design minimaliste

## 🚀 Production

Pour déployer en production :

```bash
# Build le projet
npm run build

# Lancer en production
NODE_ENV=production node dist/server.js
```

## 🔐 Sécurité

⚠️ **Important pour la production :**
- Ajouter une authentification
- Limiter le rate limiting
- Valider les entrées utilisateur
- Utiliser HTTPS
- Configurer CORS correctement

## 📊 Monitoring

Le serveur log tous les événements :
- Connexions clients
- Générations lancées
- Erreurs
- Complétions

## 💡 Astuces

- **Plusieurs onglets** : Vous pouvez ouvrir plusieurs onglets et suivre plusieurs générations
- **Auto-refresh** : L'historique se rafraîchit toutes les 30 secondes
- **Logs en temps réel** : Scrollent automatiquement
- **Badges colorés** : Identifient rapidement les chaînes

---

**Profitez de votre interface graphique moderne !** 🎉
