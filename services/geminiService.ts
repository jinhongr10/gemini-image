import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult, ProcessingMode } from "../types";

// Official Gemini image-generation mapping as of 2026-03:
// Nano Banana -> gemini-2.5-flash-image
// Nano Banana Pro -> gemini-3-pro-image-preview
const ANALYSIS_MODEL = "gemini-2.5-flash";
const NANO_BANANA_MODEL = "gemini-2.5-flash-image";
const NANO_BANANA_PRO_MODEL = "gemini-3-pro-image-preview";

// Initialize Gemini Client
// Prefer runtime-provided key (localStorage/global), fall back to build-time env
const getApiKey = (): string | undefined => {
  if (typeof window !== "undefined") {
    const fromStorage = window.localStorage?.getItem("gemini_api_key");
    if (fromStorage) return fromStorage;
    const fromGlobal = (window as any).GEMINI_API_KEY as string | undefined;
    if (fromGlobal) return fromGlobal;
  }
  return process.env.API_KEY as string | undefined;
};

const getClient = () => {
  const apiKey = getApiKey();
  return new GoogleGenAI({ apiKey: apiKey || "dummy-key-to-prevent-crash" });
};

export interface GenerationConfig {
    mode: ProcessingMode;
    scenePrompt?: string;
    customDescription?: string; // New field for user input
    addShadow?: boolean;
    count?: number; // Number of images to generate
    aspectRatio?: string; // "1:1", "3:4", "4:3", "9:16", "16:9"
    isMasked?: boolean; // Whether the input image contains red mask strokes
    upscaleOption?: '2K' | '4K';
}

/**
 * Analyzes the uploaded product image.
 */
export const analyzeProductImage = async (base64Image: string): Promise<AnalysisResult> => {
  if (!getApiKey()) {
      // Return a dummy result instead of crashing
  }

  try {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: ANALYSIS_MODEL,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image,
            },
          },
          {
            text: `Analyze this product image. Return JSON:
            1. "productName": Short name (in Chinese).
            2. "material": Material (in Chinese).
            3. "issues": List of quality issues (in Chinese).
            4. "score": 0-100 score.
            `,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                productName: { type: Type.STRING },
                material: { type: Type.STRING },
                issues: { type: Type.ARRAY, items: { type: Type.STRING } },
                score: { type: Type.INTEGER }
            },
            required: ["productName", "material", "issues", "score"]
        } as Schema
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as AnalysisResult;
    }
    throw new Error("No analysis data returned");
  } catch (error) {
    console.error("Analysis failed:", error);
    return {
      productName: "未知产品",
      material: "未知",
      issues: ["无法分析 (可能是API额度不足)"],
      score: 0,
    };
  }
};

/**
 * Helper to generate a single image
 */
const generateSingleImage = async (
    base64Image: string, 
    modelName: string, 
    promptText: string,
    imageConfig?: { aspectRatio?: string, imageSize?: string }
): Promise<string> => {
    const ai = getClient();
    const response = await ai.models.generateContent({
        model: modelName,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Image,
              },
            },
            {
              text: promptText,
            },
          ],
        },
        config: {
            imageConfig: imageConfig
        }
      });
  
      const parts = response.candidates?.[0]?.content?.parts;
      if (parts) {
        for (const part of parts) {
          if (part.inlineData && part.inlineData.data) {
            return part.inlineData.data;
          }
        }
      }
      throw new Error("No image data generated");
};

/**
 * Generates new versions of the image. Returns an array of base64 strings.
 */
export const generateEnhancedImage = async (
  base64Image: string,
  config: GenerationConfig
): Promise<string[]> => {
  try {
    let promptText = "";
    // Default image backend: Nano Banana
    let modelName = NANO_BANANA_MODEL;
    
    // Background always white
    const bgName = 'pure white';
    const bgHex = '#FFFFFF';

    // Shadow instruction for White BG mode
    const whiteBgShadowInstruction = config.addShadow 
        ? "Grounding: Add a **minimal, tight contact shadow** strictly underneath the base. The shadow must be **faint, light gray, and soft**. Do NOT cast heavy, dark, or long shadows. Do NOT cast shadows onto the product face." 
        : "No shadow. The product should be completely isolated on pure white.";

    // Lighting instruction
    const lightingInstruction = "LIGHTING: **High-Key Lighting**. Use soft, even studio lighting. Eliminate harsh contrasts.";

    // Append custom user description if provided
    const additionalContext = config.customDescription ? `Additional details: ${config.customDescription}.` : "";

    switch (config.mode) {
      case ProcessingMode.WHITE_BG:
        // Optimized Prompt for White Background Mode
        promptText = `Professional e-commerce product photography, 8k resolution, shot with a 85mm telephoto lens (flat perspective).
Subject: The product provided.

**CRITICAL INSTRUCTIONS ON COMPOSITION:**
1.  **PERFECT CENTERING**: The product must be mathematically centered in the frame.
2.  **BACKGROUND**: Seamless ${bgName} background (Hex ${bgHex}).
3.  **PADDING**: Maintain generous negative space. Product should occupy 50-60% of canvas. Do NOT crop edges.

**CRITICAL INSTRUCTIONS ON FIDELITY:**
1.  **PRESERVE GEOMETRY**: Keep the exact shape, curves, buttons, and logos.
2.  **COLOR FIDELITY**: **DO NOT CHANGE THE PRODUCT COLOR**. Check the original image carefully.
    - **IF WHITE**: Render it as **PURE BRIGHT WHITE**. Remove gray/yellow casts.
    - **IF COLORED/METALLIC** (e.g. Black, Gold, Silver, Wood): **PRESERVE THE EXACT ORIGINAL HUE**. Do NOT whiten or desaturate it.
3.  ${lightingInstruction}
4.  **CLEANUP**: Remove existing dirty shadows from the source image.

Appearance: The product surface must be clean, bright, and pristine. Restore realistic material texture.
${whiteBgShadowInstruction} 
${additionalContext}`;
        break;
        
      case ProcessingMode.SCENE:
        // Scene specific shadow logic
        const sceneShadowPrompt = config.addShadow 
           ? "Light Interaction: The product must cast realistic contact shadows onto the environment surfaces (wall or floor) matching the scene's light source direction. Ensure the product reflects the environment colors subtly to look integrated." 
           : "Lighting: Ensure the product looks naturally lit by the environment.";

        promptText = `Photorealistic Product Integration.
Scene Description: ${config.scenePrompt || "minimalist surface"}.
Subject: Integrate the provided product into this scene naturally.

Positioning: The product is the main subject (approx 50% of frame). Ensure correct perspective alignment with the background.

**CRITICAL INSTRUCTIONS ON FIDELITY:**
- **DO NOT CHANGE THE PRODUCT**: The object in the image is a specific SKU. Keep its exact shape, logo, sensor placement, and design details identical to the input.
- **COLOR FIDELITY**: **DO NOT ALTER THE PRODUCT'S ORIGINAL COLOR**. 
    - If white: Keep it **BRIGHT WHITE**. Do not let shadows make it look gray.
    - If colored: Keep the original color (e.g. Chrome, Black, Gold) exactly as is.
- **NO HALLUCINATIONS**: Do not add extra buttons, wires, or change the color of the product.
- **MOUNTING**: If the scene implies a wall (e.g. restroom tiles, office wall), the product must appear firmly INSTALLED/MOUNTED on the wall surface, not floating.
- **CLEAN SCENE**: Do NOT add extraneous objects, text, or labels.

${sceneShadowPrompt}
${additionalContext}`;
        break;
        
      case ProcessingMode.RESIZE:
        promptText = `Resize the product image to a target aspect ratio without stretching or distorting the product.
Strict requirements:
- Do NOT stretch, squash, or deform the product in any way
- Keep the product’s original proportions exactly
- Preserve fine details, edges, logos, textures, and material realism
- The product must remain sharp and high-resolution, with no blur or softness
- No artificial smoothing, no painterly effects, no over-sharpening

Method:
- Keep the product size unchanged
- Expand the canvas to the target aspect ratio
- Fill extended areas naturally using a clean, seamless background consistent with the original
- Maintain consistent lighting and shadow direction
${additionalContext}`;
        break;

      case ProcessingMode.RETOUCH:
        promptText = `Image Editing Task.
User Instruction: ${config.customDescription || "Improve the image"}
${config.isMasked 
    ? "**CRITICAL**: The input image contains semi-transparent RED strokes marking the area to edit. **YOU MUST COMPLETELY REMOVE THE RED STROKES** in the final output and replace them with the requested content or corrected texture. The final image should look pristine with NO red markings left." 
    : "Apply the requested changes to the image."}
Preserve the rest of the image exactly as is. High fidelity, photorealistic result.`;
        break;
        
      case ProcessingMode.RESTORE:
        // Use Nano Banana Pro for higher-fidelity restoration
        modelName = NANO_BANANA_PRO_MODEL;
        promptText = `Image Restoration Task.
Goal: Automatically fix minor imperfections on the product surface while maintaining perfect fidelity to the original.
Specific Actions:
1. **Remove Dust & Scratches**: Identify and remove small dust specks, lint, and scratches from the product surface.
2. **Denoise**: Reduce digital noise and JPEG compression artifacts.
3. **Clarify**: Subtly sharpen fine details and text.

Constraints:
- **DO NOT CHANGE THE BACKGROUND**. Keep the original background exactly as is.
- **DO NOT CHANGE THE PRODUCT SHAPE OR COLOR**.
- **DO NOT CROP**.
- **DO NOT ADD SHADOWS**.
${additionalContext}`;
        break;

      case ProcessingMode.ENHANCE:
        promptText = `Enhance this product image for e-commerce. **Crop and frame the image so the product occupies at least 60% of the view.** Fix lighting, remove noise, and improve sharpness while maintaining high fidelity. 
        ${whiteBgShadowInstruction} 
        ${additionalContext}`;
        break;
        
      default:
        promptText = "Improve this product image.";
    }

    const count = config.count || 1;
    const promises = [];

    // Construct image config
    const imageConfig = {
        aspectRatio: config.aspectRatio,
        imageSize: config.mode === ProcessingMode.RESTORE ? (config.upscaleOption || '2K') : undefined
    };

    for (let i = 0; i < count; i++) {
        const variationPrompt = count > 1 ? `${promptText} (Variation ${i + 1})` : promptText;
        promises.push(generateSingleImage(base64Image, modelName, variationPrompt, imageConfig));
    }

    const results = await Promise.all(promises);
    return results;

  } catch (error: any) {
    console.error("Image generation failed:", error);
    const errorStr = JSON.stringify(error);
    const msg = (error?.message || '') + errorStr;

    if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
        throw new Error("API 配额已耗尽 (429)。您的免费额度可能已用完，或请求过于频繁。请稍后再试，或在 Google AI Studio 绑定计费账户。");
    }
    throw error;
  }
};
