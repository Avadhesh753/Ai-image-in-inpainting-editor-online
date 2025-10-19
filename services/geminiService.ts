import { GoogleGenAI, Modality } from "@google/genai";

const fileDataToBase64 = (fileData: string): string => {
  return fileData.substring(fileData.indexOf(',') + 1);
};

export const editImageWithMask = async (
  originalImageBase64: string,
  maskImageBase64: string,
  prompt: string
): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set. Please set it in your environment.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // A more detailed instruction for the model to improve accuracy
  const systemPrompt = `You are an expert image editor. The user will provide an image, a mask, and a text prompt.
You must edit the area of the image defined by the white parts of the mask according to the text prompt. 
The black parts of the mask must remain untouched. Only output the edited image.
User prompt: "${prompt}"`;

  const originalImagePart = {
    inlineData: {
      data: fileDataToBase64(originalImageBase64),
      mimeType: 'image/png',
    },
  };

  const maskImagePart = {
    inlineData: {
      data: fileDataToBase64(maskImageBase64),
      mimeType: 'image/png',
    },
  };
  
  const textPart = {
    text: systemPrompt,
  };

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            textPart,
            originalImagePart,
            maskImagePart,
          ],
        },
        config: {
            responseModalities: [Modality.IMAGE],
        },
      });

    const firstPart = response.candidates?.[0]?.content?.parts?.[0];
    if (firstPart && firstPart.inlineData) {
      const base64ImageBytes: string = firstPart.inlineData.data;
      return `data:image/png;base64,${base64ImageBytes}`;
    } else {
        const safetyFeedback = response.candidates?.[0]?.safetyRatings;
        let errorMessage = "No image was generated. The response may have been blocked due to safety policies.";
        if (safetyFeedback) {
            errorMessage += ` Safety feedback: ${JSON.stringify(safetyFeedback)}`;
        }
      throw new Error(errorMessage);
    }
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error(`Failed to edit image: ${error instanceof Error ? error.message : String(error)}`);
  }
};
