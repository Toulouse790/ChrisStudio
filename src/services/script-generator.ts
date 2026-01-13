import OpenAI from 'openai';
import { Channel, VideoScript } from '../types/index.js';

export type ScriptDurationMode = 'normal' | 'expand' | 'compress';

export interface ScriptGenerationOptions {
  mode?: ScriptDurationMode;
  /** Inclusive range; used as instruction to the model. */
  targetWordCount?: { min: number; max: number };
  /** Override model if needed. */
  model?: string;
}

export class ScriptGenerator {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async generateScript(channel: Channel, topic: string, options: ScriptGenerationOptions = {}): Promise<VideoScript> {
    const prompt = this.buildPrompt(channel, topic, options);
    
    const model = options.model || 'gpt-4o';
    console.log(`🤖 Calling OpenAI ${model} for: ${topic} (${options.mode || 'normal'})`);
    
    const message = await this.client.chat.completions.create({
      model,
      max_tokens: 4000,
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [
        {
          role: 'system',
          content: 'You are a creative video script writer. Always respond with valid JSON only, no markdown formatting.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const content = message.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    console.log(`✅ Received response (${content.length} chars)`);
    return this.parseScript(content);
  }

  private buildPrompt(channel: Channel, topic: string, options: ScriptGenerationOptions): string {
    const mode = options.mode || 'normal';
    const targetWords = options.targetWordCount || { min: 1500, max: 1800 };

    const durationGuidance =
      mode === 'expand'
        ? `The previous audio was too short. EXPAND the script with richer detail, examples, and vivid pacing while staying coherent.`
        : mode === 'compress'
          ? `The previous audio was too long. COMPRESS the script by removing redundancy while keeping the strongest beats.`
          : `Keep the script naturally paced.`;

    const common = `
Hard constraints:
- Output MUST be valid JSON only.
- Total length: ${targetWords.min}-${targetWords.max} words (aim for 9-12 minutes of narration).
- Hook must be punchy and about ~7 seconds.
- Provide 6-8 sections (not 3-4), each with a distinct visual search query.
- Each section narration must be written in 2-4 short paragraphs (dynamic beats), not a single block.
- Prefer concrete nouns for visuals (locations, artifacts, devices, documents, landscapes, maps, diagrams).
- Avoid on-screen intro fluff; jump straight into content.

Duration calibration instruction:
${durationGuidance}
`;

    const prompts = {
      'what-if': `You are a creative scriptwriter for the YouTube channel "What If...".

Topic: "${topic}"

Tone: high-energy speculative Netflix. Pace: fast, curiosity-driven.
Visual intent: futuristic, science, concepts, simulations. Prefer 80% images / 20% short video beats.
${common}

Format your response as JSON:
{
  "title": "Clickable title",
  "hook": "~7 seconds narration",
  "sections": [
    {
      "narration": "Section narration (2-4 short paragraphs)",
      "visualType": "image or video",
      "searchQuery": "Concrete keywords for visuals",
      "duration": 80,
      "transition": "fade"
    }
  ],
  "conclusion": "Final thoughts",
  "duration": 600
}`,
      
      'human-odyssey': `You are a historian and cinematic documentarian for "The Human Odyssey".

Topic: "${topic}"

Tone: cinematic documentary (NatGeo + Netflix soft). Pace: steady, immersive.
Visual intent: archaeology, maps, artifacts, landscapes. Prefer 90% images / 10% short video beats.
${common}

Format your response as JSON:
{
  "title": "Compelling title",
  "hook": "~7 seconds narration",
  "sections": [
    {
      "narration": "Section narration (2-4 short paragraphs)",
      "visualType": "image or video",
      "searchQuery": "Concrete keywords for historical visuals",
      "duration": 90,
      "transition": "fade"
    }
  ],
  "conclusion": "Final thoughts",
  "duration": 600
}`,
      
      'classified-files': `You are an investigative journalist for "Classified Files".

Topic: "${topic}"

Tone: investigative thriller, objective but tense. Pace: controlled tension.
Visual intent: archives, dossiers, surveillance, evidence, CRT. Prefer 85% images / 15% short video beats.
${common}

Format your response as JSON:
{
  "title": "Mysterious title",
  "hook": "~7 seconds narration",
  "sections": [
    {
      "narration": "Section narration (2-4 short paragraphs)",
      "visualType": "image or video",
      "searchQuery": "Concrete keywords for investigation visuals",
      "duration": 90,
      "transition": "fade"
    }
  ],
  "conclusion": "Final thoughts",
  "duration": 600
}`
    };

    return prompts[channel.id as keyof typeof prompts] || prompts['what-if'];
  }

  private parseScript(response: string): VideoScript {
    if (!response || response.trim().length === 0) {
      throw new Error('Empty response from OpenAI');
    }

    // Extract JSON from markdown code blocks if present
    const jsonMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    let jsonStr = jsonMatch ? jsonMatch[1] : response;
    
    // Clean up the JSON string
    jsonStr = jsonStr.trim();
    
    // Remove any trailing commas before closing braces/brackets
    jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
    
    try {
      const parsed = JSON.parse(jsonStr);
      
      // Validate required fields
      if (!parsed.title || !parsed.sections || !Array.isArray(parsed.sections)) {
        throw new Error('Missing required fields: title or sections');
      }
      
      return parsed;
    } catch (error: any) {
      console.error('Failed to parse script:', error.message);
      console.error('Raw response (first 500 chars):', response.substring(0, 500));
      console.error('Cleaned JSON (first 500 chars):', jsonStr.substring(0, 500));
      throw new Error(`Invalid script format from OpenAI: ${error.message}`);
    }
  }
}
