import React from 'react';
import type { GeneratedSpeech } from './geminiService';

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodePcmAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const parseRateFromMimeType = (mimeType: string) => {
  const match = mimeType.match(/rate=(\d+)/i);
  return match ? Number(match[1]) : 24000;
};

export const playSpeech = async (audio: GeneratedSpeech) => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  const bytes = decode(audio.data);

  if (audio.mimeType.includes('audio/pcm')) {
    const rate = parseRateFromMimeType(audio.mimeType);
    const audioBuffer = await decodePcmAudioData(bytes, audioContext, rate, 1);
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start();
    return;
  }

  const blob = new Blob([bytes], { type: audio.mimeType || 'audio/wav' });
  const url = URL.createObjectURL(blob);
  const element = new Audio(url);
  element.onended = () => URL.revokeObjectURL(url);
  await element.play();
};
