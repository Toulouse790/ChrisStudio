import { AssetCollector } from '../services/asset-collector.js';
import { AssetDownloader } from '../services/asset-downloader.js';
import { ScriptSection } from '../types/index.js';

async function testAssetCollection() {
  console.log('🧪 Testing Asset Collection from Pexels\n');
  
  // Check for API key
  if (!process.env.PEXELS_API_KEY) {
    console.error('❌ PEXELS_API_KEY not found in .env');
    console.log('\n📝 To get a free Pexels API key:');
    console.log('1. Go to https://www.pexels.com/api/');
    console.log('2. Sign up for a free account');
    console.log('3. Copy your API key');
    console.log('4. Add to .env: PEXELS_API_KEY=your_key_here\n');
    process.exit(1);
  }

  const collector = new AssetCollector();
  const downloader = new AssetDownloader('./output/tests/assets');

  // Test sections
  const testSections: ScriptSection[] = [
    {
      narration: 'Space exploration has always captured human imagination.',
      visualType: 'image',
      searchQuery: 'astronaut space exploration',
      duration: 5,
      transition: 'fade'
    },
    {
      narration: 'The future of technology is evolving rapidly.',
      visualType: 'video',
      searchQuery: 'futuristic technology city',
      duration: 5,
      transition: 'fade'
    },
    {
      narration: 'Nature continues to amaze us with its beauty.',
      visualType: 'image',
      searchQuery: 'beautiful nature landscape mountains',
      duration: 5,
      transition: 'fade'
    }
  ];

  try {
    // Step 1: Collect assets
    console.log('Step 1: Searching for assets on Pexels...\n');
    const assets = await collector.collectAssets(testSections);
    
    console.log('\n📊 Asset Summary:');
    assets.forEach((asset, i) => {
      console.log(`  ${i + 1}. ${asset.type.toUpperCase()} - ${asset.url.substring(0, 50)}...`);
      if (asset.attribution) {
        console.log(`     ${asset.attribution}`);
      }
    });

    // Step 2: Download assets
    console.log('\n\nStep 2: Downloading assets...\n');
    const downloadedAssets = await downloader.downloadAssets(assets);
    
    console.log('\n📁 Downloaded Files:');
    downloadedAssets.forEach((asset, i) => {
      if (asset.localPath) {
        console.log(`  ${i + 1}. ${asset.localPath}`);
      }
    });

    console.log('\n✅ Asset collection test completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Check downloaded files in ./output/tests/assets/');
    console.log('2. These assets can now be used with FFmpeg for video composition');
    console.log('3. Run: npm run test:video (once you have audio files)\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

testAssetCollection();
