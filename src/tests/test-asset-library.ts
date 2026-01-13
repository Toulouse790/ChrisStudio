import { mkdir } from 'fs/promises';
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

  if (!existsSync(imgA)) {
    await execAsync(`ffmpeg -y -f lavfi -i color=c=0x001a33:s=1920x1080:d=1 -frames:v 1 "${imgA}"`);
  }

  if (!existsSync(imgB)) {
    await execAsync(`ffmpeg -y -f lavfi -i color=c=0x2a1a00:s=1920x1080:d=1 -frames:v 1 "${imgB}"`);
  }

  return { imgA, imgB };
}

async function main() {
  console.log('🧪 Testing AssetLibrary (local index + matching)\n');

  const { imgA, imgB } = await ensureTestImages();

  const lib = new AssetLibrary({ preferLocalAssets: true, reuseWindowDays: 7 });
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

  await lib.upsertFromDownload(a, imgA);
  await lib.upsertFromDownload(b, imgB);

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

  console.log('✅ Found local asset:', found[0].localPath);
  console.log('✅ AssetLibrary test passed!');
}

main().catch((err) => {
  console.error('❌ AssetLibrary test failed:', err);
  process.exit(1);
});
