import Anthropic from '@anthropic-ai/sdk';
import { Channel, VideoScript } from '../types/index.js';

export class ScriptGenerator {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }

  async generateScript(channel: Channel, topic: string): Promise<VideoScript> {
    const prompt = this.buildPrompt(channel, topic);
    
    const message = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    return this.parseScript(content.text);
  }

  private buildPrompt(channel: Channel, topic: string): string {
    const prompts = {
      'what-if': `You are a creative scriptwriter for the YouTube channel "What If...".

Create a 9-minute video script (approximately 1350 words) about: "${topic}"

Requirements:
- Start with a STRONG HOOK (first 10 seconds to grab attention)
- Use engaging storytelling with hypothetical scenarios
- Include 5-6 main sections, each 90-120 seconds
- Each section should have a clear visual description for image/video search
- End with a mind-blowing conclusion
- Write in an engaging, conversational tone
- Use rhetorical questions to keep viewers engaged

Format your response as JSON:
{
  "title": "Video title (must be clickable!)",
  "hook": "First 10 seconds narration",
  "sections": [
    {
      "narration": "Section narration text",
      "visualType": "image or video",
      "searchQuery": "Keywords for finding visuals",
      "duration": 90,
      "transition": "fade"
    }
  ],
  "conclusion": "Final thoughts",
  "duration": 540
}`,
      
      'human-odyssey': `You are a historian and documentarian for "The Human Odyssey".

Create a 9-minute documentary script about: "${topic}"

Requirements:
- Start with an intriguing historical hook
- Focus on historical accuracy and fascinating details
- Include 5-6 main sections covering different aspects
- Weave in human stories and emotions
- Use dramatic narrative techniques
- End with lessons for today

Format your response as JSON:
{
  "title": "Video title (must be compelling!)",
  "hook": "First 10 seconds narration",
  "sections": [
    {
      "narration": "Section narration text",
      "visualType": "image or video",
      "searchQuery": "Keywords for finding historical visuals",
      "duration": 90,
      "transition": "fade"
    }
  ],
  "conclusion": "Final thoughts",
  "duration": 540
}`,
      
      'classified-files': `You are an investigative journalist for "Classified Files".

Create a 9-minute mystery/investigation script about: "${topic}"

Requirements:
- Start with a chilling or mysterious hook
- Present facts and evidence systematically
- Build suspense throughout
- Include different theories or perspectives
- Maintain objectivity while being intriguing
- End with thought-provoking questions

Format your response as JSON:
{
  "title": "Video title (must be mysterious!)",
  "hook": "First 10 seconds narration",
  "sections": [
    {
      "narration": "Section narration text",
      "visualType": "image or video",
      "searchQuery": "Keywords for finding mysterious visuals",
      "duration": 90,
      "transition": "fade"
    }
  ],
  "conclusion": "Final thoughts",
  "duration": 540
}`
    };

    return prompts[channel.id as keyof typeof prompts] || prompts['what-if'];
  }

  private parseScript(response: string): VideoScript {
    // Extract JSON from markdown code blocks if present
    const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || 
                      response.match(/```\n([\s\S]*?)\n```/);
    
    const jsonStr = jsonMatch ? jsonMatch[1] : response;
    
    try {
      return JSON.parse(jsonStr);
    } catch (error) {
      console.error('Failed to parse script:', error);
      console.error('Raw response:', response);
      throw new Error('Invalid script format from Claude');
    }
  }
}
