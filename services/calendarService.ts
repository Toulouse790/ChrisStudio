/**
 * ChrisStudio - Service de Calendrier Éditorial
 * Génère automatiquement des idées de vidéos pour chaque chaîne
 * © 2025 Toulouse790. Tous droits réservés.
 */

import { GoogleGenAI } from '@google/genai';
import { 
  CalendarItem, 
  CalendarGenerationRequest, 
  ContentCalendar,
  ContentStatus 
} from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Génère des idées de vidéos pour une chaîne donnée
 */
export async function generateCalendarItems(
  request: CalendarGenerationRequest
): Promise<CalendarItem[]> {
  const { channelId, channelName, channelTheme, month, year, count, existingTitles } = request;
  
  const monthNames = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
  ];
  
  const existingList = existingTitles?.length 
    ? `\n\nÉVITE ces sujets déjà traités :\n${existingTitles.map(t => `- ${t}`).join('\n')}`
    : '';

  const prompt = `Tu es un expert en création de contenu YouTube. Génère ${count} idées de vidéos uniques et captivantes pour la chaîne "${channelName}".

THÉMATIQUE DE LA CHAÎNE :
${channelTheme}

MOIS CIBLE : ${monthNames[month - 1]} ${year}

INSTRUCTIONS :
- Chaque idée doit être originale et engageante
- Les titres doivent être accrocheurs et optimisés pour le CTR
- Pense aux tendances saisonnières si pertinent
- Varie les angles d'approche
- Les descriptions doivent résumer le contenu en 2-3 phrases
${existingList}

RÉPONDS EN JSON STRICTEMENT DANS CE FORMAT :
{
  "ideas": [
    {
      "title": "Titre accrocheur de la vidéo",
      "description": "Résumé captivant du contenu en 2-3 phrases."
    }
  ]
}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    const text = response.text || '';
    
    // Extraire le JSON de la réponse
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Réponse IA invalide - pas de JSON trouvé');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    if (!parsed.ideas || !Array.isArray(parsed.ideas)) {
      throw new Error('Format de réponse invalide');
    }

    const now = new Date();
    
    return parsed.ideas.map((idea: { title: string; description: string }, index: number) => ({
      id: `cal_${channelId}_${year}${month.toString().padStart(2, '0')}_${index + 1}`,
      channelId,
      title: idea.title,
      description: idea.description,
      status: ContentStatus.PROPOSED,
      createdAt: now,
      updatedAt: now,
    }));

  } catch (error) {
    console.error('Erreur génération calendrier:', error);
    throw error;
  }
}

/**
 * Génère un calendrier optimisé pour la monétisation YouTube
 * 2 vidéos/semaine/chaîne (Mardi + Samedi) = 6 vidéos/semaine = 24/mois
 * Meilleur engagement et qualité pour atteindre les 4000h watch time
 */
export function createCalendarWithSchedule(
  items: CalendarItem[],
  month: number,
  year: number,
  startDay: number = 1
): ContentCalendar {
  // Grouper les items par chaîne
  const itemsByChannel: Record<string, CalendarItem[]> = {};
  items.forEach(item => {
    if (!itemsByChannel[item.channelId]) {
      itemsByChannel[item.channelId] = [];
    }
    itemsByChannel[item.channelId].push(item);
  });

  const channelIds = Object.keys(itemsByChannel);
  
  // Jours de publication optimaux : Mardi (2) et Samedi (6)
  // Mardi = bon engagement en semaine
  // Samedi = pic de visionnage weekend
  const publishDaysOfWeek = [2, 6]; // Mardi, Samedi
  
  const scheduledItems: CalendarItem[] = [];
  
  // Trouver le premier mardi du mois
  const baseDate = new Date(year, month - 1, startDay);
  const dayOfWeek = baseDate.getDay();
  const daysUntilTuesday = dayOfWeek <= 2 ? (2 - dayOfWeek) : (9 - dayOfWeek);
  const firstTuesday = new Date(year, month - 1, startDay + daysUntilTuesday);
  
  // Pour chaque chaîne
  channelIds.forEach((channelId) => {
    const channelItems = itemsByChannel[channelId];
    let itemIndex = 0;
    
    // 4 semaines, 2 vidéos par semaine = 8 vidéos par chaîne max
    // On prend les 8 premières (ou moins si moins générées)
    const maxVideos = Math.min(channelItems.length, 8);
    
    for (let week = 0; week < 4 && itemIndex < maxVideos; week++) {
      for (let dayIdx = 0; dayIdx < publishDaysOfWeek.length && itemIndex < maxVideos; dayIdx++) {
        const item = channelItems[itemIndex];
        const targetDay = publishDaysOfWeek[dayIdx];
        
        // Calculer le décalage depuis le premier mardi
        // Mardi = 0 jours, Samedi = 4 jours
        const dayOffset = targetDay === 2 ? 0 : 4;
        
        const scheduledDate = new Date(firstTuesday);
        scheduledDate.setDate(firstTuesday.getDate() + (week * 7) + dayOffset);
        
        scheduledItems.push({
          ...item,
          scheduledDate,
          updatedAt: new Date(),
        });
        
        itemIndex++;
      }
    }
  });

  // Trier par date puis par chaîne
  scheduledItems.sort((a, b) => {
    const dateDiff = (a.scheduledDate?.getTime() || 0) - (b.scheduledDate?.getTime() || 0);
    if (dateDiff !== 0) return dateDiff;
    return a.channelId.localeCompare(b.channelId);
  });

  return {
    id: `calendar_${year}${month.toString().padStart(2, '0')}`,
    month,
    year,
    items: scheduledItems,
    generatedAt: new Date(),
  };
}

/**
 * Génère le calendrier pour toutes les chaînes
 * 8 vidéos/chaîne = 2 vidéos/semaine x 4 semaines
 */
export async function generateFullCalendar(
  channels: { id: string; name: string; theme: string }[],
  month: number,
  year: number,
  videosPerChannel: number = 8
): Promise<ContentCalendar> {
  const allItems: CalendarItem[] = [];

  for (const channel of channels) {
    const items = await generateCalendarItems({
      channelId: channel.id,
      channelName: channel.name,
      channelTheme: channel.theme,
      month,
      year,
      count: videosPerChannel,
    });
    allItems.push(...items);
  }

  // Trier par chaîne puis créer le calendrier
  return createCalendarWithSchedule(allItems, month, year);
}

/**
 * Met à jour le statut d'un item du calendrier
 */
export function updateCalendarItemStatus(
  calendar: ContentCalendar,
  itemId: string,
  newStatus: ContentStatus,
  newTitle?: string
): ContentCalendar {
  return {
    ...calendar,
    items: calendar.items.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          status: newStatus,
          title: newTitle ?? item.title,
          originalTitle: newTitle && item.originalTitle === undefined ? item.title : item.originalTitle,
          updatedAt: new Date(),
        };
      }
      return item;
    }),
  };
}

/**
 * Valide tous les items proposés
 */
export function approveAllProposed(calendar: ContentCalendar): ContentCalendar {
  return {
    ...calendar,
    items: calendar.items.map(item => ({
      ...item,
      status: item.status === ContentStatus.PROPOSED ? ContentStatus.APPROVED : item.status,
      updatedAt: new Date(),
    })),
    validatedAt: new Date(),
  };
}

/**
 * Récupère les items par statut
 */
export function getItemsByStatus(
  calendar: ContentCalendar,
  status: ContentStatus
): CalendarItem[] {
  return calendar.items.filter(item => item.status === status);
}

/**
 * Récupère les items pour une chaîne spécifique
 */
export function getItemsByChannel(
  calendar: ContentCalendar,
  channelId: string
): CalendarItem[] {
  return calendar.items.filter(item => item.channelId === channelId);
}

/**
 * Compte les statistiques du calendrier
 */
export function getCalendarStats(calendar: ContentCalendar): {
  total: number;
  proposed: number;
  approved: number;
  rejected: number;
  ready: number;
  published: number;
} {
  const items = calendar.items;
  return {
    total: items.length,
    proposed: items.filter(i => i.status === ContentStatus.PROPOSED).length,
    approved: items.filter(i => i.status === ContentStatus.APPROVED || i.status === ContentStatus.MODIFIED).length,
    rejected: items.filter(i => i.status === ContentStatus.REJECTED).length,
    ready: items.filter(i => i.status === ContentStatus.READY).length,
    published: items.filter(i => i.status === ContentStatus.PUBLISHED).length,
  };
}
