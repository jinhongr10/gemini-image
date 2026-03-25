export interface ProductImage {
  id: string;
  originalData: string; // Base64
  processedData?: string; // Base64 (The currently selected/active processed image)
  processedVariations?: string[]; // Array of all generated variations
  thumbnail?: string;
  name: string;
  timestamp: number;
  
  // History for Undo/Redo
  history: string[];
  historyIndex: number;
}

export enum ProcessingMode {
  ENHANCE = 'ENHANCE',
  WHITE_BG = 'WHITE_BG',
  SCENE = 'SCENE',
  RESIZE = 'RESIZE',
  RETOUCH = 'RETOUCH',
  RESTORE = 'RESTORE'
}

export interface AnalysisResult {
  productName: string;
  material: string;
  issues: string[];
  score: number;
}

export interface GenerationConfig {
  mode: ProcessingMode;
  scenePrompt?: string; // For SCENE mode
  addShadow: boolean;
  preserveText: boolean;
  customDescription?: string;
  isMasked?: boolean;
  upscaleOption?: '2K' | '4K';
}