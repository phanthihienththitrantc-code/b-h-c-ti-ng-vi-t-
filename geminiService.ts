
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ExerciseItem, StoryResponse } from "../types";

const getAI = () => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const generateSpeech = async (text: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Hãy đóng vai một cô giáo tiểu học có giọng nói ấm áp, nhẹ nhàng và truyền cảm. Hãy đọc nội dung sau cho học sinh lớp 1 nghe một cách chậm rãi và rõ ràng: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Puck' },
        },
      },
    },
  });
  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
};

export const generateExercises = async (category: string): Promise<ExerciseItem[]> => {
  const ai = getAI();
  const prompt = `Tạo 5 bài tập tiếng Việt lớp 1 (bộ sách Kết nối tri thức) chủ đề ${category}. 
  Các loại: matching (nối từ-hình), fill_in (điền chữ cái), quiz (chọn đáp án). 
  Trả về JSON array. promptForImage là mô tả hình ảnh đơn giản cho bé.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            type: { type: Type.STRING, enum: ['matching', 'fill_in', 'quiz'] },
            question: { type: Type.STRING },
            correctAnswer: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            promptForImage: { type: Type.STRING }
          },
          required: ['id', 'type', 'question', 'correctAnswer', 'options', 'promptForImage']
        }
      }
    }
  });

  return JSON.parse(response.text || '[]');
};

export const generateStory = async (topic: string): Promise<StoryResponse> => {
  const ai = getAI();
  const prompt = `Viết một câu chuyện ngắn 3 phần cho bé lớp 1 về chủ đề ${topic}. 
  Sử dụng câu ngắn, đơn giản. Trả về JSON gồm title và mảng parts (text, imagePrompt). 
  imagePrompt nên tả chi tiết phong cách hoạt hình dễ thương.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          parts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                imagePrompt: { type: Type.STRING }
              },
              required: ['text', 'imagePrompt']
            }
          }
        },
        required: ['title', 'parts']
      }
    }
  });

  return JSON.parse(response.text || '{}');
};

export const chatWithGemini = async (message: string, history: any[] = []) => {
  const ai = getAI();
  const chat = ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: 'Bạn là một giáo viên tiểu học thân thiện cho học sinh lớp 1 tại Việt Nam. Sử dụng ngôn ngữ đơn giản, dễ hiểu, khích lệ bé.',
    },
  });
  const response = await chat.sendMessage({ message });
  return response.text;
};

export const analyzeMathImage = async (base64Image: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/png', data: base64Image } },
        { text: 'Hãy giải bài toán toán lớp 1 trong ảnh này. Giải thích từng bước thật đơn giản cho bé 6 tuổi hiểu.' }
      ]
    },
  });
  return response.text;
};

export const generateLearningImage = async (prompt: string, aspectRatio: string = "1:1", imageSize: string = "1K") => {
  const ai = getAI();
  // Chuyển sang gemini-2.5-flash-image để ổn định và ít bị 403 hơn
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: prompt }] },
    config: {
      imageConfig: {
        aspectRatio
      }
    }
  });
  
  for (const part of response.candidates?.[0].content.parts || []) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  return null;
};

export const editImage = async (base64Image: string, prompt: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { data: base64Image, mimeType: 'image/png' } },
        { text: prompt }
      ]
    }
  });
  for (const part of response.candidates?.[0].content.parts || []) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  return null;
};

export const searchGrounding = async (query: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: query,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });
  return {
    text: response.text,
    sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
  };
};

export const generateLearningVideo = async (prompt: string, aspectRatio: '16:9' | '9:16') => {
  const ai = getAI();
  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt,
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio
    }
  });

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  const videoResp = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
  const blob = await videoResp.blob();
  return URL.createObjectURL(blob);
};
