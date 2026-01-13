# 🎨 Frontend Architecture

Ce dossier contient l'interface web de ChrisStudio.

## 📁 Structure

```
public/
├── index.html      # Page principale
├── styles.css      # Styles (thème sombre moderne)
├── app.js          # Logique JavaScript
└── README.md       # Ce fichier
```

## 🏗️ Stack Technique

- **Pas de framework** : Vanilla JavaScript pour la légèreté
- **Socket.IO Client** : Communication en temps réel
- **CSS Grid & Flexbox** : Layout responsive
- **Variables CSS** : Thématisation facile

## 🎯 Composants Principaux

### 1. Formulaire de Génération
```javascript
// Sélection de chaîne + Saisie du sujet
generateForm.addEventListener('submit', ...)
```

### 2. Suivi de Progression
```javascript
// WebSocket pour les mises à jour en temps réel
socket.on('progress', data => addLog(data.message))
```

### 3. Historique
```javascript
// Chargement de l'historique via API
loadHistory() // Refresh toutes les 30s
```

### 4. Statistiques
```javascript
// Calcul des stats depuis l'historique
statTotal.textContent = history.length
```

## 🎨 Design System

### Couleurs
```css
--primary: #6366f1    /* Indigo */
--success: #10b981    /* Vert */
--warning: #f59e0b    /* Orange */
--error: #ef4444      /* Rouge */
--bg: #0f172a         /* Bleu foncé */
--bg-card: #1e293b    /* Gris-bleu */
```

### Typographie
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', ...
```

### Animations
- `fadeIn` : Apparition des résultats
- `slideIn` : Cartes de progression
- `pulse` : Étapes actives
- Transitions : 0.3s ease

## 🔌 API Communication

### REST Endpoints
```javascript
GET  /api/channels  // Liste des chaînes
GET  /api/history   // Historique des vidéos
POST /api/generate  // Lancer une génération
```

### WebSocket Events
```javascript
// Client → Server
socket.emit('subscribe', jobId)

// Server → Client
socket.on('progress', data)
socket.on('complete', data)
socket.on('error', data)
```

## 📱 Responsive Breakpoints

```css
/* Desktop */
@media (min-width: 1024px) {
  .main-content { grid-template-columns: 2fr 1fr; }
}

/* Mobile */
@media (max-width: 1024px) {
  .main-content { grid-template-columns: 1fr; }
}
```

## 🚀 Optimisations

1. **Lazy Loading** : Images chargées à la demande
2. **Debouncing** : Évite les requêtes excessives
3. **Caching** : Historique mis en cache
4. **Minification** : CSS/JS minifiés en production

## 🔧 Personnalisation

### Changer le thème
Modifier les variables CSS dans `styles.css` :
```css
:root {
  --primary: #your-color;
  --bg: #your-background;
  ...
}
```

### Ajouter des animations
```css
@keyframes myAnimation {
  from { ... }
  to { ... }
}

.my-element {
  animation: myAnimation 0.5s ease-out;
}
```

### Modifier le layout
Ajuster la grille dans `.main-content` :
```css
.main-content {
  grid-template-columns: 1fr 1fr 1fr; /* 3 colonnes */
}
```

## 🐛 Debugging

### Logs dans la console
```javascript
console.log('Socket connected:', socket.id)
console.log('Job started:', currentJobId)
```

### DevTools
- **Network** : Voir les requêtes API
- **WebSocket** : Monitorer Socket.IO
- **Console** : Logs JavaScript
- **Elements** : Inspecter le DOM

## 📦 Build pour Production

```bash
# Minifier CSS
npx csso styles.css -o styles.min.css

# Minifier JS
npx terser app.js -o app.min.js -c -m

# Mettre à jour index.html pour utiliser .min
```

## ♿ Accessibilité

- Labels sur tous les champs
- Contraste WCAG AA
- Navigation au clavier
- ARIA labels où nécessaire
- Erreurs clairement affichées

## 🔐 Sécurité

- Validation côté client
- Sanitization des entrées
- Pas de données sensibles exposées
- CORS configuré sur le serveur

## 🎓 Ressources

- [Socket.IO Client](https://socket.io/docs/v4/client-api/)
- [MDN CSS Grid](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Grid_Layout)
- [Web Accessibility](https://www.w3.org/WAI/WCAG21/quickref/)

---

**Interface conçue pour être simple, rapide et élégante !** ✨
