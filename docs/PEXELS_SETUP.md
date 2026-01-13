# 🎨 Pexels API Setup Guide

## Get Your Free API Key

### Step 1: Create Account
1. Go to [https://www.pexels.com/api/](https://www.pexels.com/api/)
2. Click "Get Started" or "Sign Up"
3. Create a free account

### Step 2: Get API Key
1. Once logged in, go to your dashboard
2. Click "Your API Key" in the navigation
3. Copy your API key (starts with something like `563492ad6f917000...`)

### Step 3: Add to Project
1. Open `.env` file in your project root
2. Add your key:
   ```bash
   PEXELS_API_KEY=your_api_key_here
   ```
3. Save the file

## API Limits (Free Plan)

- **200 requests per hour**
- **20,000 requests per month**
- Perfect for generating several videos per day!

## What You Get

- ✅ Free high-resolution photos (1920x1080+)
- ✅ Free HD videos
- ✅ No attribution required (but appreciated)
- ✅ Commercial use allowed

## Test Your Setup

```bash
npm run test:assets
```

This will:
1. Search for 3 test assets on Pexels
2. Download them to `./output/tests/assets/`
3. Verify everything works

## Troubleshooting

### Error: "PEXELS_API_KEY not found"
- Make sure you have a `.env` file in the project root
- Check that the key name is exactly `PEXELS_API_KEY`
- No quotes needed around the key value

### Error: "401 Unauthorized"
- Your API key might be invalid
- Re-check you copied the full key
- Try generating a new key on Pexels

### Error: "No assets found"
- Try more generic search terms
- Avoid very specific or uncommon phrases
- The script generator will provide good search terms

## Alternative: Unsplash (Backup)

If you want a backup image source:

1. Go to [https://unsplash.com/developers](https://unsplash.com/developers)
2. Create an app
3. Copy your Access Key
4. Add to `.env`:
   ```bash
   UNSPLASH_ACCESS_KEY=your_access_key_here
   ```

Unsplash limit: 50 requests/hour (free)
