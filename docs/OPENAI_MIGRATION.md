# 🔄 Migration vers OpenAI GPT-4

Le système a été migré de Claude AI (Anthropic) vers OpenAI GPT-4o.

## ✅ Ce qui a changé

### Variables d'environnement
```bash
# Avant
ANTHROPIC_API_KEY=sk-ant-...

# Après
OPENAI_API_KEY=sk-proj-...
```

### Modèle utilisé
- **Avant**: `claude-sonnet-4-20250514`
- **Après**: `gpt-4o`

### Coût par vidéo
- **Avant**: ~$0.10-0.20 (Claude)
- **Après**: ~$0.05-0.15 (GPT-4o)

## 🚀 Configuration

### 1. Obtenez votre clé OpenAI

1. Allez sur [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Créez un nouveau projet (si nécessaire)
3. Cliquez sur "Create new secret key"
4. Copiez la clé (format: `sk-proj-...`)

### 2. Configurez votre .env

```bash
# Remplacez dans votre .env
OPENAI_API_KEY=sk-proj-votre_clé_ici
PEXELS_API_KEY=votre_clé_pexels
```

### 3. Redémarrez le serveur

```bash
npm run server:dev
```

## 📊 Comparaison

| Fonctionnalité | Claude Sonnet 4 | GPT-4o |
|----------------|-----------------|--------|
| **Script 9min** | $0.08-0.12 | $0.03-0.08 |
| **Métadonnées SEO** | $0.02-0.08 | $0.02-0.07 |
| **Qualité** | Excellente | Excellente |
| **Vitesse** | ~10-15s | ~8-12s |
| **Max tokens** | 4096 | 4096 |
| **Context** | 200K | 128K |

## 🎯 Avantages GPT-4o

✅ **Moins cher** : ~50% moins cher que Claude
✅ **Plus rapide** : Génération légèrement plus rapide
✅ **Crédits disponibles** : Vous avez déjà des crédits
✅ **Multimodal** : Support futur des images/vidéos
✅ **API stable** : Infrastructure mature

## 🔧 Modifications techniques

### script-generator.ts
```typescript
// Avant
import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const response = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  ...
});

// Après
import OpenAI from 'openai';
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const response = await client.chat.completions.create({
  model: 'gpt-4o',
  ...
});
```

### youtube-metadata-generator.ts
Même changement - remplacé Anthropic SDK par OpenAI SDK.

## ⚠️ Important

### Votre fichier .env a été automatiquement mis à jour
La variable `ANTHROPIC_API_KEY` a été renommée en `OPENAI_API_KEY`.

### Ajoutez votre clé OpenAI
```bash
# Éditez votre .env
nano .env

# Ou
code .env
```

Remplacez la valeur de `OPENAI_API_KEY` par votre vraie clé.

## 🧪 Test

Testez la génération :

```bash
# Test rapide
npm run generate what-if "What if humans could fly?"

# Ou via l'interface web
npm run server:dev
# Accédez à http://localhost:3000
```

## 🆘 Résolution de problèmes

### Erreur: "OPENAI_API_KEY not found"
→ Vérifiez que votre `.env` contient bien `OPENAI_API_KEY=sk-proj-...`

### Erreur: "Incorrect API key provided"
→ Vérifiez que votre clé est valide sur https://platform.openai.com/api-keys

### Erreur: "Insufficient quota"
→ Ajoutez des crédits sur https://platform.openai.com/settings/organization/billing

### Script moins créatif qu'avant
→ Augmentez `temperature` dans script-generator.ts (actuellement 0.8)

## 📈 Monitoring

Surveillez votre utilisation :
- Dashboard: https://platform.openai.com/usage
- Coût par requête: $0.01-0.05 pour un script complet
- Limite: Dépend de votre plan (Free/Pay-as-you-go/Tier)

## 🎉 C'est tout !

Votre studio est maintenant configuré avec OpenAI GPT-4o. Profitez de vos crédits pour générer des vidéos ! 🚀
