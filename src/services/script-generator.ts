import OpenAI from 'openai';
import { Channel, VideoScript, ScriptSection } from '../types/index.js';
import logger from '../utils/logger.js';

export type ScriptDurationMode = 'normal' | 'expand' | 'compress';

export type ContentType = 'hook' | 'reveal' | 'exposition' | 'action' | 'conclusion' | 'transition_moment';

export type EmotionalTone = 'curiosity' | 'tension' | 'wonder' | 'mystery' | 'excitement' | 'resolution' | 'intrigue';

export interface EnhancedSection extends ScriptSection {
  contentType: ContentType;
  emotionalTone: EmotionalTone;
  act: 1 | 2 | 3;
  isMicroHook?: boolean;
  cliffhanger?: string;
}

export interface EnhancedVideoScript extends VideoScript {
  sections: EnhancedSection[];
  microHooks: Array<{
    timestamp: number;
    text: string;
    type: 'question' | 'teaser' | 'callback' | 'stakes';
  }>;
  emotionalArc: Array<{
    timestamp: number;
    intensity: number; // 0-10
    tone: EmotionalTone;
  }>;
  threeActStructure: {
    act1End: number; // Section index
    act2End: number; // Section index
    climaxSection: number; // Section index
  };
}

export interface ScriptGenerationOptions {
  mode?: ScriptDurationMode;
  targetWordCount?: { min: number; max: number };
  model?: string;
  targetDurationMinutes?: number;
}

// Storytelling patterns for YouTube retention
const MICRO_HOOK_PATTERNS = {
  question: [
    "But here's where things get strange...",
    "What happened next changed everything.",
    "But wait... there's more to this story.",
    "And that's when they discovered something unexpected.",
    "But this was just the beginning.",
    "What if I told you it gets even more bizarre?"
  ],
  teaser: [
    "In just a moment, you'll see why this matters.",
    "Stay with me, because what comes next is mind-blowing.",
    "The answer might surprise you.",
    "But the real revelation is still to come.",
    "Keep watching, because this changes everything we know."
  ],
  callback: [
    "Remember what we said earlier? This proves it.",
    "Now you understand why that detail was so important.",
    "This connects directly to what we discovered before.",
    "And suddenly, everything starts to make sense."
  ],
  stakes: [
    "The consequences were enormous.",
    "Everything hung in the balance.",
    "The stakes couldn't have been higher.",
    "Failure was not an option.",
    "The world was watching."
  ]
};

// 3-Act structure guidance per channel
const THREE_ACT_GUIDANCE = {
  'what-if': {
    act1: 'SETUP (25%): Establish the scenario, introduce the "what if" premise, hook with an impossible question. Build the world rules.',
    act2: 'CONFRONTATION (50%): Explore consequences, escalate the scenario, introduce complications and paradoxes. This is where the "what if" gets wild.',
    act3: 'RESOLUTION (25%): Reveal the ultimate consequences, connect to reality, deliver the mind-blowing conclusion and implications for our world.'
  },
  'human-odyssey': {
    act1: 'SETUP (25%): Set the historical stage, introduce key figures, establish the time period and stakes. Make history feel alive.',
    act2: 'CONFRONTATION (50%): The main historical journey, conflicts, discoveries, struggles. Build emotional connection to the past.',
    act3: 'RESOLUTION (25%): The legacy, what we learned, how it changed history. Connect past to present.'
  },
  'classified-files': {
    act1: 'SETUP (25%): Present the mystery, introduce the case, establish what we know vs what\'s hidden. Create suspense.',
    act2: 'INVESTIGATION (50%): Dig into evidence, reveal contradictions, explore theories. Build tension with each revelation.',
    act3: 'RESOLUTION (25%): Present conclusions, acknowledge mysteries that remain, leave viewers thinking. Never fully close the case.'
  }
};

export class ScriptGenerator {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async generateScript(channel: Channel, topic: string, options: ScriptGenerationOptions = {}): Promise<EnhancedVideoScript> {
    const prompt = this.buildEnhancedPrompt(channel, topic, options);

    const model = options.model || 'gpt-4o';
    logger.info({ model, topic, mode: options.mode || 'normal' }, 'Generating enhanced script');

    const message = await this.client.chat.completions.create({
      model,
      max_tokens: 6000,
      temperature: 0.85,
      response_format: { type: "json_object" },
      messages: [
        {
          role: 'system',
          content: `You are an expert YouTube scriptwriter specializing in engaging documentary content.
You understand retention psychology, storytelling structure, and how to keep viewers watching.
You write scripts that feel like Netflix documentaries - compelling, well-paced, and emotionally resonant.
Always respond with valid JSON only, no markdown formatting.`
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

    logger.info({ responseLength: content.length }, 'Received script response');
    return this.parseEnhancedScript(content);
  }

  private buildEnhancedPrompt(channel: Channel, topic: string, options: ScriptGenerationOptions): string {
    const mode = options.mode || 'normal';
    const targetMinutes = options.targetDurationMinutes || 11;
    const targetWords = options.targetWordCount || {
      min: Math.round(targetMinutes * 140), // ~140 words per minute
      max: Math.round(targetMinutes * 160)
    };

    const durationGuidance =
      mode === 'expand'
        ? `The previous version was too short. EXPAND with richer detail, more examples, deeper exploration while maintaining engagement.`
        : mode === 'compress'
          ? `The previous version was too long. COMPRESS by removing redundancy while keeping the strongest emotional beats.`
          : `Keep the script naturally paced with dynamic energy.`;

    const actGuidance = THREE_ACT_GUIDANCE[channel.id as keyof typeof THREE_ACT_GUIDANCE] || THREE_ACT_GUIDANCE['what-if'];

    const promptBase = {
      'what-if': `You are creating a script for "What If..." - a speculative science channel.
Topic: "${topic}"
Tone: High-energy speculative science, like a Netflix documentary meets curiosity-driven exploration.
Visual Style: Futuristic concepts, simulations, scientific visualizations, space, technology.`,

      'human-odyssey': `You are creating a script for "The Human Odyssey" - a cinematic history channel.
Topic: "${topic}"
Tone: Cinematic documentary narration, emotionally resonant, like National Geographic meets Ken Burns.
Visual Style: Historical artifacts, ancient sites, maps, archaeological discoveries, period imagery.`,

      'classified-files': `You are creating a script for "Classified Files" - an investigative mystery channel.
Topic: "${topic}"
Tone: Investigative thriller, building tension, revelatory, like true crime meets X-Files.
Visual Style: Declassified documents, surveillance footage, evidence photos, mysterious locations.`
    };

    return `${promptBase[channel.id as keyof typeof promptBase] || promptBase['what-if']}

=== 3-ACT STRUCTURE (CRITICAL) ===
${actGuidance.act1}
${actGuidance.act2}
${actGuidance.act3}

=== RETENTION PSYCHOLOGY ===
1. MICRO-HOOKS: Add a retention hook every 2-3 minutes (timestamps in script). These are brief sentences that:
   - Ask an intriguing question
   - Tease upcoming content
   - Raise the stakes
   - Create a callback to earlier content

2. EMOTIONAL ARC: The script should have emotional peaks and valleys:
   - Start strong (8/10 intensity)
   - Build through Act 1 (6-7/10)
   - Major peak at Act 2 climax (9-10/10)
   - Brief valley for reflection (5/10)
   - Build to final peak (9/10)
   - Satisfying resolution (7/10)

3. CLIFFHANGERS: End some sections with mini-cliffhangers that make viewers want to keep watching.

=== CONSTRAINTS ===
- Total length: ${targetWords.min}-${targetWords.max} words (target: ${targetMinutes} minutes narration)
- Hook: Punchy, ~7-10 seconds, immediately grabs attention
- Sections: 8-12 sections, each with:
  - Clear content type (hook/reveal/exposition/action/conclusion/transition_moment)
  - Emotional tone (curiosity/tension/wonder/mystery/excitement/resolution/intrigue)
  - Act assignment (1, 2, or 3)
  - Specific visual search query (concrete nouns: locations, objects, artifacts)
  - Duration suggestion based on pacing (shorter for action: 30-60s, longer for exposition: 60-90s)
- Each section narration: 2-4 dynamic paragraphs, not monolithic blocks
- Conclusion: Memorable, thought-provoking, invites reflection

Duration calibration: ${durationGuidance}

=== OUTPUT FORMAT ===
Respond with this exact JSON structure:
{
  "title": "Clickable, curiosity-inducing title (60 chars max)",
  "hook": "7-10 second attention grabber that poses a compelling question or scenario",
  "sections": [
    {
      "narration": "Section narration with 2-4 dynamic paragraphs. Use line breaks between paragraphs.",
      "visualType": "image or video",
      "searchQuery": "Specific, concrete visual keywords (e.g., 'ancient Roman aqueduct ruins aerial view')",
      "duration": 60,
      "transition": "fade|dissolve|dip_to_black|wipe_left|zoom_in",
      "contentType": "hook|reveal|exposition|action|conclusion|transition_moment",
      "emotionalTone": "curiosity|tension|wonder|mystery|excitement|resolution|intrigue",
      "act": 1,
      "isMicroHook": false,
      "cliffhanger": "Optional: mini-cliffhanger sentence to end this section"
    }
  ],
  "conclusion": "Final powerful statement that resonates and invites reflection",
  "duration": ${targetMinutes * 60},
  "microHooks": [
    {
      "timestamp": 120,
      "text": "But here's where things get strange...",
      "type": "question|teaser|callback|stakes"
    }
  ],
  "emotionalArc": [
    {"timestamp": 0, "intensity": 8, "tone": "curiosity"},
    {"timestamp": 120, "intensity": 7, "tone": "wonder"},
    {"timestamp": 300, "intensity": 9, "tone": "tension"},
    {"timestamp": 450, "intensity": 5, "tone": "mystery"},
    {"timestamp": 550, "intensity": 9, "tone": "excitement"},
    {"timestamp": 660, "intensity": 7, "tone": "resolution"}
  ],
  "threeActStructure": {
    "act1End": 2,
    "act2End": 7,
    "climaxSection": 6
  }
}`;
  }

  private parseEnhancedScript(response: string): EnhancedVideoScript {
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

      // Ensure all enhanced fields exist with defaults
      const enhanced: EnhancedVideoScript = {
        ...parsed,
        microHooks: parsed.microHooks || this.generateDefaultMicroHooks(parsed.sections),
        emotionalArc: parsed.emotionalArc || this.generateDefaultEmotionalArc(parsed.duration || 660),
        threeActStructure: parsed.threeActStructure || this.calculateActStructure(parsed.sections)
      };

      // Ensure all sections have enhanced fields
      enhanced.sections = enhanced.sections.map((section: any, index: number) => ({
        ...section,
        contentType: section.contentType || this.inferContentType(index, enhanced.sections.length),
        emotionalTone: section.emotionalTone || 'curiosity',
        act: section.act || this.inferAct(index, enhanced.sections.length),
        isMicroHook: section.isMicroHook || false
      }));

      return enhanced;
    } catch (error: any) {
      logger.error({
        error: error.message,
        responsePreview: response.substring(0, 500)
      }, 'Failed to parse enhanced script');
      throw new Error(`Invalid script format from OpenAI: ${error.message}`);
    }
  }

  private generateDefaultMicroHooks(sections: any[]): EnhancedVideoScript['microHooks'] {
    const hooks: EnhancedVideoScript['microHooks'] = [];
    let cumulativeTime = 0;

    sections.forEach((section, index) => {
      cumulativeTime += section.duration || 60;

      // Add micro-hook every ~150 seconds (2.5 minutes)
      if (cumulativeTime >= 150 && hooks.length < Math.floor(cumulativeTime / 150)) {
        const hookTypes = ['question', 'teaser', 'callback', 'stakes'] as const;
        const type = hookTypes[index % hookTypes.length];
        const patterns = MICRO_HOOK_PATTERNS[type];

        hooks.push({
          timestamp: cumulativeTime,
          text: patterns[Math.floor(Math.random() * patterns.length)],
          type
        });
      }
    });

    return hooks;
  }

  private generateDefaultEmotionalArc(duration: number): EnhancedVideoScript['emotionalArc'] {
    const tones: EmotionalTone[] = ['curiosity', 'wonder', 'tension', 'mystery', 'excitement', 'resolution'];

    return [
      { timestamp: 0, intensity: 8, tone: 'curiosity' },
      { timestamp: Math.round(duration * 0.15), intensity: 7, tone: 'wonder' },
      { timestamp: Math.round(duration * 0.4), intensity: 9, tone: 'tension' },
      { timestamp: Math.round(duration * 0.55), intensity: 5, tone: 'mystery' },
      { timestamp: Math.round(duration * 0.75), intensity: 9, tone: 'excitement' },
      { timestamp: duration, intensity: 7, tone: 'resolution' }
    ];
  }

  private calculateActStructure(sections: any[]): EnhancedVideoScript['threeActStructure'] {
    const total = sections.length;
    return {
      act1End: Math.max(1, Math.floor(total * 0.25)),
      act2End: Math.max(2, Math.floor(total * 0.75)),
      climaxSection: Math.max(1, Math.floor(total * 0.7))
    };
  }

  private inferContentType(index: number, total: number): ContentType {
    const position = index / total;

    if (index === 0) return 'hook';
    if (index === total - 1) return 'conclusion';
    if (position < 0.25) return 'exposition';
    if (position < 0.5) return 'action';
    if (position < 0.75) return Math.random() > 0.5 ? 'reveal' : 'action';
    return 'exposition';
  }

  private inferAct(index: number, total: number): 1 | 2 | 3 {
    const position = index / total;
    if (position < 0.25) return 1;
    if (position < 0.75) return 2;
    return 3;
  }

  /**
   * Get suggested pacing based on content type
   */
  static getSuggestedDuration(contentType: ContentType): { min: number; max: number } {
    const pacingMap: Record<ContentType, { min: number; max: number }> = {
      hook: { min: 5, max: 10 },
      reveal: { min: 30, max: 60 },
      exposition: { min: 45, max: 90 },
      action: { min: 20, max: 45 },
      conclusion: { min: 30, max: 60 },
      transition_moment: { min: 5, max: 15 }
    };
    return pacingMap[contentType];
  }

  /**
   * Get micro-hook patterns for manual insertion
   */
  static getMicroHookPatterns(): typeof MICRO_HOOK_PATTERNS {
    return MICRO_HOOK_PATTERNS;
  }
}
