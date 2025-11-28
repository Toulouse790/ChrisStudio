# 🎤 Configuration TTS Gratuit

Ce guide explique comment configurer le TTS (Text-to-Speech) **100% GRATUIT** pour ChrisStudio.

## Coût : 0€/mois pour 24+ vidéos

| Service | Limite gratuite | Vidéos/mois |
|---------|-----------------|-------------|
| Google Cloud TTS | 1 million caractères | ~80 vidéos |
| Cloudflare Workers | 100,000 requêtes/jour | Illimité |

---

## 📋 Étapes de configuration (10 minutes)

### Étape 1 : Créer une clé API Google Cloud TTS (gratuit)

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créez un nouveau projet (ou utilisez un existant)
3. Allez dans **APIs & Services > Library**
4. Recherchez "Cloud Text-to-Speech API" et **activez-le**
5. Allez dans **APIs & Services > Credentials**
6. Cliquez **Create Credentials > API Key**
7. Copiez la clé (ex: `AIzaSy...`)

### Étape 2 : Déployer le Cloudflare Worker (gratuit)

1. Allez sur [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Créez un compte gratuit si besoin
3. Cliquez **Workers & Pages > Create Application > Create Worker**
4. Donnez un nom (ex: `chrisstudio-tts`)
5. Cliquez **Deploy**
6. Cliquez **Edit code** (bouton en haut à droite)
7. **Supprimez tout** et collez le contenu de `cloudflare-worker-tts.js`
8. Cliquez **Save and Deploy**

### Étape 3 : Ajouter la variable d'environnement

1. Dans le worker, allez dans **Settings > Variables**
2. Cliquez **Add variable**
3. Nom: `GOOGLE_TTS_API_KEY`
4. Valeur: (collez votre clé API Google)
5. Cliquez **Save and Deploy**

### Étape 4 : Configurer ChrisStudio

1. Copiez l'URL de votre worker (ex: `https://chrisstudio-tts.votrenom.workers.dev`)
2. Ajoutez dans `.env.local` :

```
VITE_TTS_API_URL=https://chrisstudio-tts.votrenom.workers.dev
```

3. Redémarrez le serveur : `npm run dev`

---

## ✅ Test

Générez une vidéo. Vous devriez voir dans la console :
```
🎵 Proxy TTS: X chunks à générer
✅ Proxy TTS audio généré: X.XX MB
```

---

## 🎙️ Voix disponibles (Google Cloud)

### Françaises (haute qualité Wavenet)
- `fr-FR-Wavenet-A` - Femme 1
- `fr-FR-Wavenet-B` - Homme 1 (par défaut)
- `fr-FR-Wavenet-C` - Femme 2
- `fr-FR-Wavenet-D` - Homme 2
- `fr-FR-Wavenet-E` - Femme 3

### Standard (qualité normale, 4x plus de caractères gratuits)
- `fr-FR-Standard-A` - Femme
- `fr-FR-Standard-B` - Homme

---

## 💡 Conseils

- Les voix **Wavenet** sont plus naturelles mais consomment plus de quota
- Les voix **Standard** permettent ~4 millions de caractères/mois gratuits
- Pour changer de voix, modifiez `voice` dans `audioService.ts`

---

## 🆘 Problèmes courants

### "TTS API URL not configured"
→ Ajoutez `VITE_TTS_API_URL` dans `.env.local`

### "Proxy TTS error: 403"
→ Vérifiez que la clé API Google est bien ajoutée dans les variables Cloudflare

### "quota exceeded" (Google)
→ Vous avez dépassé 1M caractères/mois (rare). Attendez le 1er du mois.
