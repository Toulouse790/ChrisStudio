import OpenAI from 'openai';
import { Channel } from '../types/index.js';
import logger from '../utils/logger.js';

export interface TopicSuggestion {
  topic: string;
  angle: string;
  hooks: string[];
  searchPotential: number;
  viralScore: number;
}

export class TopicGenerator {
  private client: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    this.client = new OpenAI({ apiKey });
  }

  /**
   * Génère automatiquement un sujet pertinent pour une chaîne
   */
  async generateTopic(channel: Channel, previousTopics: string[] = []): Promise<string> {
    logger.info({ channelId: channel.id }, 'Génération automatique d\'un sujet');

    const prompt = this.buildTopicPrompt(channel, previousTopics);

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Tu es un expert en création de contenu YouTube. 
Tu génères des sujets captivants, optimisés pour le référencement et l'engagement.
Réponds UNIQUEMENT avec le sujet, sans explication supplémentaire.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.9,
        max_tokens: 100
      });

      const topic = response.choices[0]?.message?.content?.trim() || '';
      
      if (!topic) {
        throw new Error('Aucun sujet généré');
      }

      logger.info({ channelId: channel.id, topic }, 'Sujet généré avec succès');
      return topic;
    } catch (error) {
      logger.error({ error, channelId: channel.id }, 'Erreur lors de la génération du sujet');
      // Fallback sur un sujet par défaut basé sur le thème de la chaîne
      return this.getFallbackTopic(channel);
    }
  }

  /**
   * Génère plusieurs suggestions de sujets
   */
  async generateTopicSuggestions(
    channel: Channel,
    count: number = 5,
    previousTopics: string[] = []
  ): Promise<TopicSuggestion[]> {
    logger.info({ channelId: channel.id, count }, 'Génération de suggestions de sujets');

    const prompt = this.buildSuggestionsPrompt(channel, count, previousTopics);

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Tu es un expert en stratégie de contenu YouTube.
Tu génères des suggestions de sujets avec analyse de potentiel viral et SEO.
Réponds UNIQUEMENT en JSON valide.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.8,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content || '{}';
      const suggestions = JSON.parse(content);
      
      return suggestions.topics || [];
    } catch (error) {
      logger.error({ error, channelId: channel.id }, 'Erreur lors de la génération des suggestions');
      return [];
    }
  }

  private buildTopicPrompt(channel: Channel, previousTopics: string[]): string {
    const avoid = previousTopics.length > 0 
      ? `\n\nSUJETS DÉJÀ TRAITÉS (à éviter) :\n${previousTopics.slice(-10).map(t => `- ${t}`).join('\n')}`
      : '';

    return `Génère UN sujet captivant pour une vidéo YouTube.

CHAÎNE : "${channel.name}"
THÈME : ${channel.style.theme}
DESCRIPTION : ${channel.description}
${avoid}

CRITÈRES :
1. Intrigant et accrocheur ("What if...", "Et si...", "The Mystery of...")
2. Optimisé SEO (mots-clés tendances)
3. Potentiel viral élevé
4. Aligné avec le thème de la chaîne
5. Unique et original
6. En ANGLAIS (pour audience internationale)

Réponds UNIQUEMENT avec le sujet, sans guillemets ni explications.`;
  }

  private buildSuggestionsPrompt(
    channel: Channel,
    count: number,
    previousTopics: string[]
  ): string {
    const avoid = previousTopics.length > 0
      ? `\n\nSUJETS DÉJÀ TRAITÉS (à éviter) :\n${previousTopics.slice(-20).map(t => `- ${t}`).join('\n')}`
      : '';

    return `Génère ${count} suggestions de sujets pour une vidéo YouTube.

CHAÎNE : "${channel.name}"
THÈME : ${channel.style.theme}
DESCRIPTION : ${channel.description}
${avoid}

Pour chaque sujet, fournis :
- topic : Le titre de la vidéo (en ANGLAIS)
- angle : L'angle unique de traitement
- hooks : 3 accroches possibles pour la vidéo
- searchPotential : Score de 1-10 pour le potentiel de recherche Google
- viralScore : Score de 1-10 pour le potentiel viral

Réponds en JSON avec ce format :
{
  "topics": [
    {
      "topic": "What if the Library of Alexandria Never Burned?",
      "angle": "Alternative history with scientific speculation",
      "hooks": ["Hook 1", "Hook 2", "Hook 3"],
      "searchPotential": 8,
      "viralScore": 7
    }
  ]
}`;
  }

  private getFallbackTopic(channel: Channel): string {
    const fallbacks: Record<string, string[]> = {
      'what-if': [
        'What if humans could photosynthesize like plants?',
        'What if Earth had two moons?',
        'What if the internet suddenly disappeared?',
        'What if time travel was possible?',
        'What if humans could breathe underwater?'
      ],
      'human-odyssey': [
        'The Lost City That Changed History Forever',
        'Ancient Technology That Still Baffles Scientists',
        'The Mysterious Civilization That Vanished Overnight',
        'How Ancient Humans Survived the Ice Age',
        'The Discovery That Rewrote Human History'
      ],
      'classified-files': [
        'The Conspiracy Theory That Turned Out To Be True',
        'Declassified Documents Reveal Shocking Truth',
        'The Mystery Behind the Missing Flight',
        'Government Secrets Finally Exposed',
        'The Cover-Up That Lasted Decades'
      ]
    };

    const channelFallbacks = fallbacks[channel.id] || fallbacks['what-if'];
    const randomIndex = Math.floor(Math.random() * channelFallbacks.length);
    
    return channelFallbacks[randomIndex];
  }
}
