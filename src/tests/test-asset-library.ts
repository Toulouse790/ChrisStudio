/*
Ajoute au système de bibliothèque d’assets une logique de catégorisation et de réutilisation contrôlée.

But : réutiliser souvent les assets “génériques” (evergreen) même si les sujets changent (ex: Moyen Âge → Rome), et réutiliser rarement les assets “spécifiques”.

À faire :

Lors de l’indexation d’un asset dans library.json, ajouter :

- category: "evergreen" ou "episode_specific"
- keywords: liste de mots-clés normalisés

Déduire category automatiquement depuis searchQuery :

- episode_specific si présence d’entités/historiques très spécifiques (noms propres, dates, lieux précis, batailles, personnes)
- sinon evergreen

Ajouter des règles anti-répétition différentes :

- evergreen: réutilisable, mais pas plus d’1 fois dans les 7 jours
- episode_specific: réutilisable max 1 fois dans les 30 jours

Lors de la sélection locale, appliquer ce ratio par défaut (par chaîne) :

- human-odyssey: 70% evergreen / 30% episode_specific
- classified-files: 80% evergreen / 20% episode_specific
- what-if: 60% evergreen / 40% episode_specific

Si la bibliothèque n’a pas assez d’assets dans une catégorie, compléter via Pexels.

Résultat attendu : même quand les sujets varient fortement, le système réutilise une base visuelle cohérente (evergreen) sans que ça se voie, et évite de recycler trop vite les assets spécifiques.
*/

import { mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { promisify } from 'util';
import { exec } from 'child_process';
import { AssetLibrary } from '../services/asset-library.js';
import { Asset } from '../types/index.js';

const execAsync = promisify(exec);

async function ensureTestImages() {
  await mkdir('./assets/test', { recursive: true });

  const imgA = './assets/test/lib-a.jpg';
  const imgB = './assets/test/lib-b.jpg';
  const imgC = './assets/test/lib-c.jpg';

  if (!existsSync(imgA)) {
    await execAsync(`ffmpeg -y -f lavfi -i color=c=0x001a33:s=1920x1080:d=1 -frames:v 1 "${imgA}"`);
  }

  if (!existsSync(imgB)) {
    await execAsync(`ffmpeg -y -f lavfi -i color=c=0x2a1a00:s=1920x1080:d=1 -frames:v 1 "${imgB}"`);
  }

  if (!existsSync(imgC)) {
    await execAsync(`ffmpeg -y -f lavfi -i color=c=0x1a2a00:s=1920x1080:d=1 -frames:v 1 "${imgC}"`);
  }

  return { imgA, imgB, imgC };
}

async function main() {
  console.log('🧪 Testing AssetLibrary (local index + matching)\n');

  const { imgA, imgB, imgC } = await ensureTestImages();

  const indexPath = './assets/test/library-test.json';
  if (existsSync(indexPath)) {
    await rm(indexPath, { force: true });
  }

  const lib = new AssetLibrary({
    preferLocalAssets: true,
    reuseWindowDays: 7,
    episodeSpecificReuseWindowDays: 30,
    indexPath,
    // For this test we want to validate matching + category/keywords even right after indexing.
    // Strict mode is tested separately below.
    allowRecentWhenInsufficient: true
  });
  await lib.ensureLoaded();

  const a: Asset = {
    type: 'image',
    url: 'https://example.com/a.jpg',
    localPath: imgA,
    source: 'pexels',
    channelId: 'human-odyssey',
    searchQuery: 'ancient map parchment artifact archaeology',
    tags: ['ancient', 'map', 'artifact', 'archaeology']
  };

  const b: Asset = {
    type: 'image',
    url: 'https://example.com/b.jpg',
    localPath: imgB,
    source: 'pexels',
    channelId: 'what-if',
    searchQuery: 'futuristic interface hologram technology',
    tags: ['futuristic', 'interface', 'hologram', 'technology']
  };

  const c: Asset = {
    type: 'image',
    url: 'https://example.com/c.jpg',
    localPath: imgC,
    source: 'pexels',
    channelId: 'human-odyssey',
    searchQuery: 'Battle of Hastings 1066 medieval England',
    tags: ['battle', 'hastings', '1066', 'medieval', 'england']
  };

  await lib.upsertFromDownload(a, imgA);
  await lib.upsertFromDownload(b, imgB);
  await lib.upsertFromDownload(c, imgC);

  const stats = lib.getStats();
  console.log(`📚 Library stats: total=${stats.total}, images=${stats.images}, videos=${stats.videos}`);

  const found = await lib.findBestLocalAssets({
    query: 'ancient archaeology map',
    preferredType: 'image',
    count: 1,
    channelId: 'human-odyssey',
    excludeIds: new Set(),
    excludeLocalPaths: new Set()
  });

  if (!found[0]?.localPath) {
    throw new Error('Expected to find a matching local asset');
  }

  if (found[0].category !== 'evergreen') {
    throw new Error(`Expected evergreen category, got: ${found[0].category}`);
  }

  if (!found[0].keywords?.includes('ancient')) {
    throw new Error('Expected keywords to include "ancient"');
  }

  const specific = await lib.findBestLocalAssets({
    query: 'hastings 1066 battle',
    preferredType: 'image',
    count: 1,
    channelId: 'human-odyssey',
    category: 'episode_specific',
    excludeIds: new Set(),
    excludeLocalPaths: new Set()
  });

  if (!specific[0]?.localPath) {
    throw new Error('Expected to find an episode_specific local asset');
  }

  if (specific[0].category !== 'episode_specific') {
    throw new Error(`Expected episode_specific category, got: ${specific[0].category}`);
  }

  console.log('✅ Found local asset:', found[0].localPath);
  console.log('✅ Found episode-specific asset:', specific[0].localPath);

  // Strict anti-repetition: immediately after indexing/using, assets should be considered “recent”
  // and therefore NOT eligible for local reuse (caller should fill via Pexels instead).
  const strictLib = new AssetLibrary({
    preferLocalAssets: true,
    reuseWindowDays: 7,
    episodeSpecificReuseWindowDays: 30,
    indexPath,
    allowRecentWhenInsufficient: false
  });
  await strictLib.ensureLoaded();
  const strictFound = await strictLib.findBestLocalAssets({
    query: 'ancient archaeology map',
    preferredType: 'image',
    count: 1,
    channelId: 'human-odyssey',
    excludeIds: new Set(),
    excludeLocalPaths: new Set()
  });
  if (strictFound.length !== 0) {
    throw new Error('Expected strict mode to return no assets within reuse window');
  }

  console.log('✅ AssetLibrary test passed!');
}

main().catch((err) => {
  console.error('❌ AssetLibrary test failed:', err);
  process.exit(1);
});
