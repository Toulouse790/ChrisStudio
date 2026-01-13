# 📅 Système de Calendrier et Publication YouTube

## ✨ Nouvelles Fonctionnalités

### 1. **Planification Automatique**
- **3 vidéos par semaine** générées automatiquement pour chaque chaîne
- Planning par défaut :
  - **What If** : Lundi, Mercredi, Vendredi à 10h00
  - **Human Odyssey** : Mardi, Jeudi, Samedi à 14h00
  - **Classified Files** : Lundi, Mercredi, Vendredi à 18h00

### 2. **Interface Calendrier**
Accédez au calendrier via : http://localhost:3000/calendar.html

#### Fonctionnalités :
- 📅 Vue calendrier de toutes les vidéos planifiées
- 🎯 Filtres par statut (en attente, génération, prêtes, publiées)
- ➕ Planification manuelle de vidéos personnalisées
- 👁️ Prévisualisation vidéo avant publication
- 📤 Publication directe sur YouTube
- 🗑️ Suppression de vidéos planifiées

### 3. **Statuts des Vidéos**
- **Pending** : En attente de génération
- **Generating** : Génération en cours
- **Ready** : Prête à être prévisualisée et publiée
- **Published** : Publiée sur YouTube
- **Failed** : Échec de génération

### 4. **Publication YouTube**
- Configuration complète (titre, description, tags, catégorie)
- Choix de visibilité (privée, non répertoriée, publique)
- Publication immédiate ou programmée
- Lien direct vers la vidéo publiée

## 🚀 Démarrage Rapide

### 1. Configuration YouTube API (Optionnel)

Pour activer la publication automatique sur YouTube :

```bash
# Créer un projet sur Google Cloud Console
# https://console.cloud.google.com

# Activer YouTube Data API v3

# Créer des identifiants OAuth 2.0
# URI de redirection : http://localhost:3000/oauth2callback

# Ajouter au .env
YOUTUBE_CLIENT_ID=votre_client_id
YOUTUBE_CLIENT_SECRET=votre_client_secret
YOUTUBE_REFRESH_TOKEN=votre_refresh_token
```

### 2. Démarrer le serveur

```bash
npm run dev
```

Le scheduler démarre automatiquement et :
- ✅ Génère un planning pour les 4 prochaines semaines
- ✅ Vérifie chaque minute si des vidéos doivent être générées
- ✅ Lance automatiquement la génération à l'heure programmée

### 3. Accéder au calendrier

```
http://localhost:3000/calendar.html
```

## 📋 Utilisation

### Planifier une vidéo manuellement

1. Allez sur le calendrier
2. Remplissez le formulaire :
   - Sélectionnez une chaîne
   - Choisissez la date et l'heure
   - Entrez le sujet de la vidéo
3. Cliquez sur "Planifier"

### Prévisualiser une vidéo

1. Attendez que le statut passe à "Prête"
2. Cliquez sur "👁️ Prévisualiser"
3. Visionnez la vidéo dans le lecteur
4. Fermez avec la croix ou ESC

### Publier sur YouTube

1. Cliquez sur "📤 Publier"
2. Modifiez le titre et la description si nécessaire
3. Ajoutez des tags séparés par des virgules
4. Choisissez la catégorie et la visibilité
5. Cliquez sur "Publier maintenant"

**Note** : La publication YouTube nécessite la configuration de l'API YouTube (voir ci-dessus)

## 🔧 API Endpoints

### Calendrier

```bash
# Obtenir les vidéos planifiées (30 jours par défaut)
GET /api/schedule?days=30

# Planifier une nouvelle vidéo
POST /api/schedule
Body: {
  "channelId": "what-if",
  "topic": "What if the Earth stopped spinning?",
  "date": "2026-01-20T10:00:00Z"
}

# Supprimer une vidéo
DELETE /api/schedule/:id

# Mettre à jour une vidéo
PUT /api/schedule/:id
Body: { "status": "ready" }
```

### YouTube

```bash
# Publier sur YouTube
POST /api/youtube/upload
Body: {
  "videoId": "what-if-1234567890",
  "config": {
    "title": "What if...",
    "description": "...",
    "tags": ["science", "education"],
    "category": "28",
    "privacy": "public"
  }
}

# Obtenir l'URL d'autorisation OAuth
GET /api/youtube/auth-url
```

## 📊 Structure des Données

### ScheduledVideo

```typescript
{
  id: string;
  channelId: string;
  topic: string;
  scheduledDate: Date;
  status: 'pending' | 'generating' | 'ready' | 'published' | 'failed';
  scriptPath?: string;
  audioPath?: string;
  videoPath?: string;
  youtubeUrl?: string;
  error?: string;
  createdAt: Date;
  publishedAt?: Date;
}
```

### VideoSchedule

```typescript
{
  channelId: string;
  weekday: number; // 0-6 (0 = Dimanche)
  time: string; // Format HH:mm
  enabled: boolean;
}
```

## 🎯 Workflow Automatique

```
1. ⏰ Scheduler vérifie l'heure toutes les minutes
2. 📋 Vidéos "pending" dont la date est dépassée → génération
3. 🎬 Pipeline complet : Script → Voice → Assets → Video
4. ✅ Statut → "ready" avec chemins des fichiers
5. 👁️ Utilisateur prévisualise depuis le calendrier
6. 📤 Publication manuelle sur YouTube
7. 🎉 Statut → "published" avec URL YouTube
```

## 💡 Personnalisation

### Modifier le Planning

Éditez `data/schedules.json` :

```json
[
  {
    "channelId": "what-if",
    "weekday": 1,
    "time": "10:00",
    "enabled": true
  }
]
```

### Ajouter des Sujets Prédéfinis

Éditez `src/services/video-scheduler.ts` dans la méthode `generateTopicIdea()` :

```typescript
const topics = {
  'what-if': [
    'What if humans could breathe underwater?',
    'What if AI became sentient?',
    // Ajoutez vos sujets...
  ]
};
```

## 🔔 Notifications

Le calendrier envoie des notifications desktop quand :
- ✅ Une vidéo est prête
- ❌ Une génération échoue

Acceptez les notifications au premier chargement de la page.

## 📁 Fichiers Créés

```
data/
  scheduler.json    # Base de données des vidéos planifiées
  schedules.json    # Configuration des plannings

public/
  calendar.html     # Interface du calendrier
  calendar.js       # Logique du calendrier

src/
  services/
    scheduler-db.ts          # Gestion base de données
    video-scheduler.ts       # Logique de planification
    youtube-uploader.ts      # Upload YouTube
  types/
    scheduler.ts             # Types TypeScript
```

## 🎬 Prochaines Étapes

1. **Configurez l'API YouTube** pour la publication automatique
2. **Accédez au calendrier** et visualisez les 4 prochaines semaines
3. **Prévisualisez les vidéos** prêtes avant publication
4. **Publiez sur YouTube** en un clic !

## 🆘 Résolution de Problèmes

### "YouTube credentials not configured"
→ Ajoutez `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN` au `.env`

### Vidéos en statut "failed"
→ Vérifiez les logs du serveur et l'erreur affichée dans le calendrier

### Planning ne se génère pas
→ Vérifiez que le scheduler est démarré (message "📅 Video Scheduler started" dans les logs)

---

**🎉 Profitez de votre studio automatisé !**
