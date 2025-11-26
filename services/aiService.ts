
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {
  GoogleGenAI,
  Type,
  Video,
  VideoGenerationReferenceImage,
  VideoGenerationReferenceType,
  Modality
} from '@google/genai';
import {GenerateVideoParams, GenerationMode, YouTubeMetadata} from '../types';

const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

// --- Helper: Convert Base64 PCM to WAV Blob ---

function base64ToUint8Array(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function createWavHeader(dataLength: number, sampleRate: number, numChannels: number, bitsPerSample: number) {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // RIFF chunk length
  view.setUint32(4, 36 + dataLength, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, numChannels, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, numChannels * (bitsPerSample / 8), true);
  // bits per sample
  view.setUint16(34, bitsPerSample, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, dataLength, true);

  return header;
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// --- New: Magic Prompt Enhancement ---

export const enhancePrompt = async (input: string, channelContext?: string): Promise<string> => {
    const prompt = `
      You are a professional YouTube Producer. 
      The user provided a basic idea: "${input}".
      ${channelContext ? `Context for Channel: ${channelContext}` : ''}

      Rewrite this into a compelling, specific, and intriguing video topic that would get high views.
      Keep it under 15 words. 
      Example Input: "Fire"
      Example Output: "The accidental discovery of fire that changed human evolution forever"
      
      Return ONLY the enhanced text.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });

    return response.text?.trim() || input;
};

// --- New: Metadata Generation Service ---

export const generateVideoPlan = async (
  niche: string,
  format: 'shorts' | 'long-form',
  language: 'en' | 'fr',
  channelName?: string,
  channelTheme?: string,
  episodeNumber?: number,
  visualStyle?: string
): Promise<YouTubeMetadata> => {
  const langName = language === 'fr' ? 'French' : 'English';
  const formatName = format === 'shorts' ? 'YouTube Shorts (Vertical 9:16)' : 'YouTube Long Form (Horizontal 16:9)';
  
  // Context construction based on channel
  let contextInstruction = "";
  if (channelName && channelTheme) {
      contextInstruction += `
      CRITICAL CONTEXT:
      This content is for the YouTube Channel "${channelName}".
      Channel Theme/Identity: "${channelTheme}".
      
      Adapt the tone, style, and vocabulary to match this specific channel identity perfectly.
      - If the channel is mysterious, use enigmatic and suspenseful language.
      - If the channel is scientific, use precise, curious, and engaging scientific language.
      - If the channel is historical/prehistoric, use immersive and descriptive language suited for storytelling.
      `;
  }

  if (visualStyle) {
      contextInstruction += `
      VISUAL STYLE REQUIREMENT:
      The user has requested the following visual style: "${visualStyle}".
      Ensure the 'visualPrompt' field explicitly describes this style (lighting, texture, camera work).
      `;
  }

  // Series/Chronology Logic
  if (episodeNumber) {
    contextInstruction += `
      SERIES MODE ENABLED:
      This is EPISODE #${episodeNumber} of a series on the topic: "${niche}".
      
      CHRONOLOGY LOGIC:
      - If Episode 1: Introduce the foundations, the beginning, or the first major event.
      - If Episode 2+: Assume the viewer knows the basics. Advance the timeline or complexity. Do not repeat introductions. Dive into the "next step" of the evolution or mystery.
      - Structure the title like "Part ${episodeNumber}" or use a sequential title strategy.
    `;
  }

  const prompt = `
    You are an expert YouTube Strategist and SEO Specialist.
    ${contextInstruction}

    Create a high-performing video plan for a "${formatName}" video on the topic: "${niche}".
    Target Language: ${langName}.

    Your goal is to maximize Click-Through Rate (CTR) and Viewer Retention for this specific channel audience.

    Provide:
    1. title: A catchy, viral-style, clickbait-compatible title (under 70 chars) in ${langName}.
    2. description: An SEO-optimized description including keywords (max 3 sentences) in ${langName}.
    3. tags: 10-15 high-traffic comma-separated tags relevant to the niche.
    4. thumbnailIdea: A detailed visual description for a thumbnail that would stand out.
    5. script: A structured script (Intro, Hook, Body, CTA) suitable for a ${format === 'shorts' ? '30-60 second' : '5-10 minute'} video in ${langName}. Keep it concise for Short form.
    6. subtitles: Generate valid SRT (SubRip) formatted subtitles content for the script in ${langName}. Ensure correct numbering and timestamps (starting 00:00:00,000).
    7. visualPrompt: A detailed, cinematic prompt to generate the video using an AI video model. MUST BE IN ENGLISH regardless of target language. Focus on visual style, lighting, and camera movement suitable for the niche.
    8. communityPost: A short, engaging text for a YouTube Community Post to tease this specific video. It could be a question, a poll idea, or a "behind the scenes" fact. In ${langName}.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: {type: Type.STRING},
          description: {type: Type.STRING},
          tags: {type: Type.ARRAY, items: {type: Type.STRING}},
          thumbnailIdea: {type: Type.STRING},
          script: {type: Type.STRING},
          subtitles: {type: Type.STRING, description: "SRT formatted string"},
          visualPrompt: {type: Type.STRING, description: "English prompt for video generation model"},
          communityPost: {type: Type.STRING, description: "Text for YouTube Community tab"},
        },
      },
    },
  });

  if (response.text) {
    const result = JSON.parse(response.text) as YouTubeMetadata;
    if (episodeNumber) {
        result.episodeNumber = episodeNumber;
    }
    return result;
  }
  throw new Error('Failed to generate video plan');
};

export const generateThumbnailImage = async (prompt: string): Promise<string> => {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { text: `Create a high quality YouTube thumbnail: ${prompt}. Vibrant colors, high contrast, 4k, hyperrealistic. No text on image.` }
      ]
    },
    config: {
        imageConfig: {
            aspectRatio: "16:9", 
        }
    }
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      const base64EncodeString = part.inlineData.data;
      return `data:image/png;base64,${base64EncodeString}`;
    }
  }
  throw new Error('No image generated');
};

// --- New: TTS Generation Service ---

export const generateSpeech = async (text: string, voiceName: string = 'Kore'): Promise<{blob: Blob, url: string}> => {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voiceName },
              },
          },
        },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (base64Audio) {
        // Decode Base64 to PCM
        const pcmData = base64ToUint8Array(base64Audio);
        
        // Gemini TTS Output is usually 24kHz 16-bit PCM
        const sampleRate = 24000;
        const numChannels = 1;
        const bitsPerSample = 16;

        // Create WAV Header
        const header = createWavHeader(pcmData.length, sampleRate, numChannels, bitsPerSample);
        
        // Combine Header + PCM Data
        const wavBlob = new Blob([header, pcmData], { type: 'audio/wav' });
        const wavUrl = URL.createObjectURL(wavBlob);
        
        return { blob: wavBlob, url: wavUrl };
    }

    throw new Error("Failed to generate speech audio");
}

// --- Existing: Video Generation Service ---

export const generateVideo = async (
  params: GenerateVideoParams,
): Promise<{objectUrl: string; blob: Blob; uri: string; video: Video}> => {
  console.log('Starting video generation with params:', params);

  const config: any = {
    numberOfVideos: 1,
    resolution: params.resolution,
  };

  // Conditionally add aspect ratio. It's not used for extending videos.
  if (params.mode !== GenerationMode.EXTEND_VIDEO) {
    config.aspectRatio = params.aspectRatio;
  }

  const generateVideoPayload: any = {
    model: params.model,
    config: config,
  };

  if (params.prompt) {
    generateVideoPayload.prompt = params.prompt;
  }

  if (params.mode === GenerationMode.FRAMES_TO_VIDEO) {
    if (params.startFrame) {
      generateVideoPayload.image = {
        imageBytes: params.startFrame.base64,
        mimeType: params.startFrame.file.type,
      };
    }

    const finalEndFrame = params.isLooping
      ? params.startFrame
      : params.endFrame;
    if (finalEndFrame) {
      generateVideoPayload.config.lastFrame = {
        imageBytes: finalEndFrame.base64,
        mimeType: finalEndFrame.file.type,
      };
    }
  } else if (params.mode === GenerationMode.REFERENCES_TO_VIDEO) {
    const referenceImagesPayload: VideoGenerationReferenceImage[] = [];

    if (params.referenceImages) {
      for (const img of params.referenceImages) {
        referenceImagesPayload.push({
          image: {
            imageBytes: img.base64,
            mimeType: img.file.type,
          },
          referenceType: VideoGenerationReferenceType.ASSET,
        });
      }
    }

    if (params.styleImage) {
      referenceImagesPayload.push({
        image: {
          imageBytes: params.styleImage.base64,
          mimeType: params.styleImage.file.type,
        },
        referenceType: VideoGenerationReferenceType.STYLE,
      });
    }

    if (referenceImagesPayload.length > 0) {
      generateVideoPayload.config.referenceImages = referenceImagesPayload;
    }
  } else if (params.mode === GenerationMode.EXTEND_VIDEO) {
    if (params.inputVideoObject) {
      generateVideoPayload.video = params.inputVideoObject;
    } else {
      throw new Error('An input video object is required to extend a video.');
    }
  }

  console.log('Submitting video generation request...', generateVideoPayload);
  let operation = await ai.models.generateVideos(generateVideoPayload);

  while (!operation.done) {
    await new Promise((resolve) => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({operation: operation});
  }

  if (operation?.response) {
    const videos = operation.response.generatedVideos;

    if (!videos || videos.length === 0) {
      throw new Error('No videos were generated.');
    }

    const firstVideo = videos[0];
    if (!firstVideo?.video?.uri) {
      throw new Error('Generated video is missing a URI.');
    }
    const videoObject = firstVideo.video;

    const url = decodeURIComponent(videoObject.uri);
    // Fix: The API key for fetching the video must also come from process.env.API_KEY.
    const res = await fetch(`${url}&key=${process.env.API_KEY}`);

    if (!res.ok) {
      throw new Error(`Failed to fetch video: ${res.status} ${res.statusText}`);
    }

    const videoBlob = await res.blob();
    const objectUrl = URL.createObjectURL(videoBlob);

    return {objectUrl, blob: videoBlob, uri: url, video: videoObject};
  } else {
    console.error('Operation failed:', operation);
    throw new Error('No videos generated.');
  }
};
