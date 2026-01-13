import OpenAI from 'openai';
import { VideoScript } from '../types/index.js';
import axios from 'axios';

export interface YouTubeMetadata {
  title: string;
  description: string;
  tags: string[];
  thumbnail: {
    title: string;
    subtitle?: string;
  };
  seoScore: number;
  searchVolume?: string;
  competitionLevel?: string;
  trendingKeywords: string[];
}

export class YouTubeMetadataGenerator {
  private client: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not found in environment');
    }
    this.client = new OpenAI({ apiKey });
  }

  async generateMetadata(
    script: VideoScript,
    channelName: string,
    channelTheme: string
  ): Promise<YouTubeMetadata> {
    console.log('📊 Generating YouTube metadata...');

    // Step 1: Generate optimized metadata with AI
    const metadata = await this.generateWithAI(script, channelName, channelTheme);

    // Step 2: Analyze keyword trends
    const trends = await this.analyzeKeywordTrends(metadata.tags);
    metadata.trendingKeywords = trends;

    // Step 3: Calculate SEO score
    metadata.seoScore = this.calculateSEOScore(metadata);

    console.log(`✅ Metadata generated with SEO score: ${metadata.seoScore}/100`);
    return metadata;
  }

  private async generateWithAI(
    script: VideoScript,
    channelName: string,
    channelTheme: string
  ): Promise<YouTubeMetadata> {
    const prompt = `You are a YouTube SEO expert. Generate optimized metadata for this video.

CHANNEL: ${channelName}
THEME: ${channelTheme}

VIDEO SCRIPT:
Title: ${script.title}
Hook: ${script.hook}
Sections: ${script.sections.map(s => s.title).join(', ')}
Conclusion: ${script.conclusion}

Generate optimized YouTube metadata following these rules:

1. TITLE (50-60 characters):
   - Must be clickbait but honest
   - Include main keyword at the beginning
   - Use emotional triggers (curiosity, fear, excitement)
   - Use numbers, questions, or power words
   - Examples: "What If...", "The Truth About...", "X Things You Didn't Know..."

2. DESCRIPTION (200-300 words):
   - First 2 lines are CRITICAL (appear in search)
   - Include main keywords in first sentence
   - Provide clear value proposition
   - Include timestamps for sections
   - End with call-to-action
   - Add relevant hashtags

3. TAGS (15-20 tags):
   - Mix of broad and specific keywords
   - Include misspellings of main keywords
   - Related search terms
   - Competitor keywords
   - Long-tail keywords (3-4 words)

4. THUMBNAIL TEXT:
   - 3-6 words maximum
   - Large readable text
   - Emotional trigger

Return as JSON:
{
  "title": "...",
  "description": "...",
  "tags": ["tag1", "tag2", ...],
  "thumbnail": {
    "title": "...",
    "subtitle": "..."
  }
}`;

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 2000,
      temperature: 0.7,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Extract JSON from markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
    const jsonText = jsonMatch ? jsonMatch[1] : content;

    const metadata = JSON.parse(jsonText);

    return {
      ...metadata,
      seoScore: 0,
      trendingKeywords: []
    };
  }

  private async analyzeKeywordTrends(tags: string[]): Promise<string[]> {
    // Use Google Trends-like analysis
    // For now, we'll use a simple keyword scoring system
    // In production, integrate with Google Trends API or YouTube Data API

    const trendingKeywords: string[] = [];

    // Simulate trend analysis based on keyword patterns
    const trendPatterns = {
      high: ['ai', 'future', 'mystery', 'secret', 'truth', 'shocking', 'revealed'],
      medium: ['history', 'science', 'technology', 'explained', 'documentary'],
      low: ['general', 'basic', 'simple', 'normal']
    };

    for (const tag of tags) {
      const lowerTag = tag.toLowerCase();
      
      // Check if tag contains high-trend words
      for (const pattern of trendPatterns.high) {
        if (lowerTag.includes(pattern)) {
          trendingKeywords.push(tag);
          break;
        }
      }
    }

    return trendingKeywords.slice(0, 5);
  }

  private calculateSEOScore(metadata: YouTubeMetadata): number {
    let score = 0;

    // Title optimization (30 points)
    const titleLength = metadata.title.length;
    if (titleLength >= 50 && titleLength <= 70) score += 15;
    else if (titleLength >= 40 && titleLength < 90) score += 10;
    else score += 5;

    if (/[?!]/.test(metadata.title)) score += 5; // Punctuation
    if (/\d/.test(metadata.title)) score += 5; // Contains numbers
    if (/what|how|why|when|where/i.test(metadata.title)) score += 5; // Question words

    // Description optimization (30 points)
    const descLength = metadata.description.length;
    if (descLength >= 200 && descLength <= 500) score += 15;
    else if (descLength >= 100 && descLength < 800) score += 10;
    else score += 5;

    if (metadata.description.includes('00:00')) score += 10; // Timestamps
    if (/#\w+/.test(metadata.description)) score += 5; // Hashtags

    // Tags optimization (25 points)
    const tagCount = metadata.tags.length;
    if (tagCount >= 15 && tagCount <= 25) score += 15;
    else if (tagCount >= 10 && tagCount < 30) score += 10;
    else score += 5;

    const longTailTags = metadata.tags.filter(tag => tag.split(' ').length >= 3).length;
    if (longTailTags >= 5) score += 10;
    else if (longTailTags >= 3) score += 5;

    // Thumbnail text (15 points)
    if (metadata.thumbnail.title) {
      const thumbWords = metadata.thumbnail.title.split(' ').length;
      if (thumbWords >= 2 && thumbWords <= 6) score += 10;
      else score += 5;

      if (metadata.thumbnail.subtitle) score += 5;
    }

    return Math.min(score, 100);
  }

  async suggestImprovements(metadata: YouTubeMetadata): Promise<string[]> {
    const suggestions: string[] = [];

    // Title suggestions
    if (metadata.title.length < 50) {
      suggestions.push('⚠️ Title is too short. Aim for 50-70 characters for better CTR.');
    }
    if (metadata.title.length > 70) {
      suggestions.push('⚠️ Title is too long. It will be truncated in search results.');
    }
    if (!/[?!]/.test(metadata.title)) {
      suggestions.push('💡 Add a question mark or exclamation to make title more engaging.');
    }

    // Description suggestions
    if (metadata.description.length < 200) {
      suggestions.push('⚠️ Description is too short. Add more context and keywords.');
    }
    if (!metadata.description.includes('00:00')) {
      suggestions.push('💡 Add timestamps to improve user experience and SEO.');
    }
    if (!/#\w+/.test(metadata.description)) {
      suggestions.push('💡 Add 3-5 hashtags to increase discoverability.');
    }

    // Tags suggestions
    if (metadata.tags.length < 15) {
      suggestions.push('⚠️ Add more tags (target 15-20 for optimal SEO).');
    }

    const longTailTags = metadata.tags.filter(tag => tag.split(' ').length >= 3).length;
    if (longTailTags < 5) {
      suggestions.push('💡 Add more long-tail keywords (3-4 words) for niche traffic.');
    }

    // SEO Score
    if (metadata.seoScore < 70) {
      suggestions.push('🎯 SEO score is below 70. Follow the suggestions above to improve.');
    }

    if (suggestions.length === 0) {
      suggestions.push('✅ Excellent! Your metadata is well-optimized.');
    }

    return suggestions;
  }

  // Get related search queries (simulate YouTube autocomplete)
  async getRelatedSearches(topic: string): Promise<string[]> {
    // In production, use YouTube Data API or Google Autocomplete API
    // For now, generate common search patterns

    const patterns = [
      `${topic} explained`,
      `${topic} documentary`,
      `what is ${topic}`,
      `${topic} facts`,
      `${topic} 2026`,
      `${topic} truth`,
      `${topic} mystery`,
      `${topic} secrets`,
      `everything about ${topic}`,
      `${topic} you didn't know`
    ];

    return patterns;
  }

  // Analyze competitor videos
  async analyzeCompetitors(keyword: string): Promise<{
    averageViews: number;
    commonTags: string[];
    successfulTitles: string[];
  }> {
    // In production, use YouTube Data API to analyze top videos
    // For now, return mock data

    return {
      averageViews: 150000,
      commonTags: [
        keyword,
        `${keyword} explained`,
        'documentary',
        'educational',
        'science',
        'interesting facts'
      ],
      successfulTitles: [
        `What You Need to Know About ${keyword}`,
        `The Truth About ${keyword}`,
        `${keyword}: Everything Explained`,
        `10 Facts About ${keyword}`,
        `${keyword} - Full Documentary`
      ]
    };
  }
}
