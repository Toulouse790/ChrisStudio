# 📚 Examples

Ce dossier contient des exemples de sorties générées par le YouTube Creator Studio.

## 📄 sample-script.json

Un exemple de script généré par OpenAI GPT-4 pour la chaîne "What If...".

**Thème:** "What If Humans Could Live Forever?"

**Structure:**
- Titre accrocheur
- Hook (10 premières secondes)
- 6 sections principales (~90-110 secondes chacune)
- Conclusion engageante
- Durée totale: 9 minutes (540 secondes)

**Chaque section contient:**
- `narration`: Le texte à lire
- `visualType`: "image" ou "video"
- `searchQuery`: Mots-clés pour Pexels
- `duration`: Durée en secondes
- `transition`: Type de transition

## 🎬 Utilisation

Pour générer un script similaire:

```bash
npm run generate what-if "What if humans could live forever?"
```

Pour générer la vidéo complète:

```bash
npm run generate:full what-if "What if humans could live forever?"
```

## 📊 Statistiques du Sample

- **Mots:** ~1,350
- **Sections:** 6
- **Images:** 4
- **Vidéos:** 2
- **Durée:** 9 minutes
- **Tokens (approx):** ~2,000
