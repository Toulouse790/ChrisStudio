
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { GeneratedAsset, IntroOutroSettings, MusicTrack, WatermarkSettings } from '../types';

const FFMPEG_CORE_URL = '/ffmpeg/ffmpeg-core.js';
const FFMPEG_WASM_URL = '/ffmpeg/ffmpeg-core.wasm';
const FONT_URL = '/Roboto-Regular.ttf';
const FONT_NAME = 'Roboto-Regular.ttf';

let ffmpeg: FFmpeg | null = null;

// Debounce to prevent multiple loads
let isLoading = false;
let loadPromise: Promise<FFmpeg> | null = null;

export const loadFFmpeg = async (progressCallback?: (message: string) => void): Promise<FFmpeg> => {
    if (ffmpeg) {
        return ffmpeg;
    }
    if (isLoading && loadPromise) {
        return loadPromise;
    }

    isLoading = true;
    loadPromise = new Promise(async (resolve, reject) => {
        try {
            ffmpeg = new FFmpeg();

            ffmpeg.on('log', ({ message }) => {
                console.log(message);
            });
            ffmpeg.on('progress', ({ progress, time }) => {
                if (progressCallback) {
                     progressCallback(`Processing... ${Math.round(progress * 100)}% (time: ${time / 1000000}s)`);
                }
            });

            if (progressCallback) progressCallback('Loading FFmpeg core...');
            await ffmpeg.load({
                coreURL: FFMPEG_CORE_URL,
                wasmURL: FFMPEG_WASM_URL,
            });

            if (progressCallback) progressCallback('FFmpeg loaded.');

            // Preload a font for subtitles
             if (progressCallback) progressCallback('Loading font...');
             const fontData = await fetch(FONT_URL);
             await ffmpeg.writeFile(FONT_NAME, await fetchFile(fontData));
             if (progressCallback) progressCallback('Font loaded.');

             isLoading = false;
             resolve(ffmpeg);

        } catch (error) {
            console.error('Error loading FFmpeg', error);
            ffmpeg = null; // Reset on error
            isLoading = false;
            loadPromise = null;
            reject(error);
        }
    });

    return loadPromise;
};

interface VideoCompositionParams {
    asset: GeneratedAsset;
    introOutro?: IntroOutroSettings;
    watermark?: WatermarkSettings;
    music?: MusicTrack;
    progressCallback: (message: string) => void;
}

export const processVideoComposition = async ({
    asset,
    introOutro,
    watermark,
    music,
    progressCallback
}: VideoCompositionParams): Promise<{url: string, blob: Blob}> => {

    const ffmpegInstance = await loadFFmpeg(progressCallback);

    progressCallback("Starting video composition...");

    // 1. Write all files to FFmpeg's virtual file system
    progressCallback("Fetching and writing assets...");

    // Main Video
    const mainVideoBlob = await fetch(asset.videoUrl).then(r => r.blob());
    await ffmpegInstance.writeFile('main.mp4', await fetchFile(mainVideoBlob));

    // Voiceover (if exists)
    if (asset.voiceoverBlob) {
        await ffmpegInstance.writeFile('voiceover.wav', await fetchFile(asset.voiceoverBlob));
    }

    // Music (if selected)
    if (music) {
        await ffmpegInstance.writeFile('music.mp3', await fetchFile(music.file));
    }

    // Intro/Outro (if enabled)
    const hasIntro = introOutro?.intro.enabled && introOutro.intro.file;
    const hasOutro = introOutro?.outro.enabled && introOutro.outro.file;
    if (hasIntro) await ffmpegInstance.writeFile('intro.mp4', await fetchFile(introOutro.intro.file!));
    if (hasOutro) await ffmpegInstance.writeFile('outro.mp4', await fetchFile(introOutro.outro.file!));

    // Watermark (if enabled)
    const hasWatermark = watermark?.enabled && watermark.dataUrl;
    if (hasWatermark) {
        const watermarkBlob = await fetch(watermark.dataUrl!).then(r => r.blob());
        await ffmpegInstance.writeFile('watermark.png', await fetchFile(watermarkBlob));
    }

    // Subtitles (if exist)
    const hasSubtitles = !!asset.metadata.subtitles;
    if (hasSubtitles) {
        await ffmpegInstance.writeFile('subtitles.srt', new TextEncoder().encode(asset.metadata.subtitles));
    }

    progressCallback("All assets loaded in memory.");

    // 2. Build the FFmpeg command

    const videoInputs: string[] = [];
    const audioInputs: string[] = [];
    const filterComplexParts: string[] = [];

    let currentVideoIndex = 0;
    let currentAudioIndex = 0;

    // Video Streams
    if (hasIntro) videoInputs.push('-i intro.mp4');
    videoInputs.push('-i main.mp4');
    if (hasOutro) videoInputs.push('-i outro.mp4');

    // Audio Streams (Voiceover and Music)
    if (asset.voiceoverBlob) {
        audioInputs.push('-i voiceover.wav');
        currentAudioIndex++;
    }
    if (music) {
        audioInputs.push('-i music.mp3');
    }

    // Build filter_complex string for video concatenation
    const concatVideoStreams = [];
    if (hasIntro) concatVideoStreams.push('[0:v]');
    concatVideoStreams.push(`[${hasIntro ? 1 : 0}:v]`);
    if (hasOutro) concatVideoStreams.push(`[${hasIntro ? 2 : 1}:v]`);

    filterComplexParts.push(`${concatVideoStreams.join('')}concat=n=${concatVideoStreams.length}:v=1:a=0[concatv]`);

    let lastVideoFilter = '[concatv]';

    // Subtitle filter
    if (hasSubtitles) {
        filterComplexParts.push(`${lastVideoFilter}subtitles=subtitles.srt:force_style='FontName=Roboto-Regular,FontSize=16,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=1,Shadow=0.5,MarginV=25'[subsv]`);
        lastVideoFilter = '[subsv]';
    }

    // Watermark filter
    if (hasWatermark) {
        const overlayPositions: { [key: string]: string } = {
            'top-left': '10:10',
            'top-right': 'W-w-10:10',
            'bottom-left': '10:H-h-10',
            'bottom-right': 'W-w-10:H-h-10',
        };
        const pos = overlayPositions[watermark!.position] || 'W-w-10:H-h-10';
        // Watermark input stream will be the next video index after concat sources
        const watermarkInputIndex = videoInputs.length;
        videoInputs.push('-i watermark.png'); // Add watermark as an input

        // Scale the watermark relative to the main video's height (e.g., 15%)
        filterComplexParts.push(`[${watermarkInputIndex}:v]scale=-1:0.15*main_h[wmscaled]`);
        filterComplexParts.push(`${lastVideoFilter}[wmscaled]overlay=${pos}[finalv]`);
    } else {
        filterComplexParts.push(`${lastVideoFilter}copy[finalv]`);
    }

    // Build filter_complex for audio mixing
    const audioMixingStreams = [];
    if (asset.voiceoverBlob) {
        audioMixingStreams.push(`[${videoInputs.length}:a]`); // First audio input
    }
    if (music) {
        // Adjust music volume to 30% and mix with voiceover
        const musicInputIndex = videoInputs.length + (asset.voiceoverBlob ? 1 : 0);
        filterComplexParts.push(`[${musicInputIndex}:a]volume=0.3[bgmusic]`);
        audioMixingStreams.push('[bgmusic]');
    }

    if (audioMixingStreams.length > 1) {
        filterComplexParts.push(`${audioMixingStreams.join('')}amix=inputs=${audioMixingStreams.length}:duration=longest[finala]`);
    } else if (audioMixingStreams.length === 1) {
        filterComplexParts.push(`${audioMixingStreams[0]}aformat=sample_fmts=s16:sample_rates=48000:channel_layouts=stereo[finala]`);
    } else {
        // If there's no audio at all, we might need a silent track depending on video container requirements.
        // For simplicity, we'll assume most videos will have at least voice or music.
    }

    const finalFilterComplex = filterComplexParts.join(';');

    // Command Array
    const command = [
        ...videoInputs.flatMap(v => v.split(' ')),
        ...audioInputs.flatMap(a => a.split(' ')),
        '-filter_complex', finalFilterComplex,
        '-map', '[finalv]',
        ...(audioMixingStreams.length > 0 ? ['-map', '[finala]'] : []),
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-shortest',
        'output.mp4'
    ];

    console.log("FFmpeg Command:", command.join(' '));
    progressCallback("Executing FFmpeg command...");

    // 3. Run FFmpeg
    await ffmpegInstance.exec(command);

    progressCallback("Composition complete. Reading output...");

    // 4. Read the output file
    const data = await ffmpegInstance.readFile('output.mp4');

    // 5. Clean up virtual file system
    progressCallback("Cleaning up memory...");
    try {
        if(hasIntro) await ffmpegInstance.deleteFile('intro.mp4');
        await ffmpegInstance.deleteFile('main.mp4');
        if(hasOutro) await ffmpegInstance.deleteFile('outro.mp4');
        if(asset.voiceoverBlob) await ffmpegInstance.deleteFile('voiceover.wav');
        if(music) await ffmpegInstance.deleteFile('music.mp3');
        if(hasWatermark) await ffmpegInstance.deleteFile('watermark.png');
        if(hasSubtitles) await ffmpegInstance.deleteFile('subtitles.srt');
        await ffmpegInstance.deleteFile('output.mp4');
    } catch(e) {
        console.warn("Cleanup failed for some files, this is not critical.", e);
    }

    progressCallback("Done.");

    const blob = new Blob([data], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);

    return { url, blob };
};
