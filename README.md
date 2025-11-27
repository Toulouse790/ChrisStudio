# ChrisStudio

🎬 **Plateforme de création automatisée de vidéos YouTube** alimentée par l'IA.

## 🚀 Fonctionnalités

- 📝 Génération automatique de métadonnées (titre, description, tags)
- 🎥 Création de vidéos avec IA générative
- 🖼️ Génération de thumbnails
- 🎙️ Voix-off IA multilingue
- 📊 Templates de contenu réutilisables
- 🎵 Mixage audio (voix + musique)
- 💧 Watermarks et intro/outro
- 📝 Sous-titres automatiques
- 📅 Calendrier éditorial avec suggestions IA
- 🔗 **Upload automatique sur YouTube** (OAuth2)

## 📺 Chaînes Configurées

| Chaîne | Thème | YouTube |
|--------|-------|---------|
| **Et Si...** | Scénarios alternatifs, hypothèses | [@EtSi-official](https://youtube.com/@EtSi-official) |
| **L'Odyssée Humaine** | Histoire de l'humanité | [@LOdysseeHumaine](https://youtube.com/@LOdysseeHumaine) |
| **Dossiers Classifiés** | Mystères et affaires non résolues | [@DossiersClassifies](https://youtube.com/@DossiersClassifies) |

## 💻 Installation

**Prérequis :** Node.js 18+

1. Cloner le repo :
   ```bash
   git clone https://github.com/Toulouse790/youtube-creator-studio.git
   cd chrisstudio
   ```

2. Installer les dépendances :
   ```bash
   npm install
   ```

3. Configurer les clés API :
   - Créez un fichier `.env.local`
   - Ajoutez vos clés :
     ```env
     # Clé API pour la génération de contenu IA
     API_KEY=votre_clé_api_gemini
     
     # (Optionnel) YouTube Data API pour l'upload automatique
     VITE_YOUTUBE_CLIENT_ID=votre_client_id
     VITE_YOUTUBE_CLIENT_SECRET=votre_client_secret
     ```

4. Lancer le serveur de développement :
   ```bash
   npm run dev
   ```

## 🔐 Configuration YouTube API (Optionnel)

Pour activer l'upload automatique sur YouTube :

1. **Créer un projet Google Cloud** :
   - Allez sur [console.cloud.google.com](https://console.cloud.google.com)
   - Créez un nouveau projet

2. **Activer YouTube Data API v3** :
   - APIs & Services > Library
   - Recherchez "YouTube Data API v3"
   - Cliquez sur "Enable"

3. **Configurer l'écran de consentement OAuth** :
   - APIs & Services > OAuth consent screen
   - Type: External
   - Ajoutez les scopes :
     - `youtube.upload`
     - `youtube.readonly`
     - `youtube.force-ssl`

4. **Créer les credentials OAuth 2.0** :
   - APIs & Services > Credentials
   - Create Credentials > OAuth client ID
   - Application type: Web application
   - Authorized redirect URIs: `https://votre-domaine.vercel.app/oauth/callback`

5. **Copier les credentials dans `.env.local`**

## 📦 Déploiement

### Vercel (Recommandé)
```bash
npm install -g vercel
vercel
```

### Build manuel
```bash
npm run build
```

## 📄 Licence

© 2025 Toulouse790. Tous droits réservés.

## 👨‍💻 Auteur

**Toulouse790**
- GitHub: [@Toulouse790](https://github.com/Toulouse790)
- Projet: [ChrisStudio](https://github.com/Toulouse790/youtube-creator-studio)
