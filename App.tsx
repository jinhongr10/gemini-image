import React, { useState, useMemo, useEffect, useRef } from 'react';
import { UploadArea, UploadedFile, convertFileToBase64 } from './components/UploadArea';
import { Button } from './components/Button';
import { MaskCanvas, MaskCanvasRef } from './components/MaskCanvas';
import { HistoryPanel } from './components/HistoryPanel';
import { generateEnhancedImage } from './services/geminiService';
import { ProcessingMode, ProductImage } from './types';

// Preset scenes
const SCENE_STYLES = [
  { 
    id: 'hotel_bath', 
    label: '酒店卫生间 (Hotel Bathroom)', 
    prompt: 'A high-end 5-star hotel bathroom vanity, marble surfaces, warm ambient cove lighting, large mirror reflection, premium hospitality atmosphere, elegant and clean, neutral tones' 
  },
  { 
    id: 'mall_restroom', 
    label: '商场卫生间 (Mall Restroom)', 
    prompt: 'A modern high-end shopping mall restroom, sleek commercial design, bright cool lighting, large format tiles, public facility aesthetic, clean and spacious, stainless steel accents' 
  },
  { 
    id: 'facility', 
    label: '工程设施 (Facility View)', 
    prompt: 'Commercial facility restroom. Focus on installation clarity, wall-mounted positioning. Practical, engineering-focused environment, neutral industrial tiles, professional maintenance atmosphere.' 
  },
  { 
    id: 'handwash', 
    label: '洗手台区 (Hand Wash Area)', 
    prompt: 'A public restroom hand washing station, row of sinks, large mirror, commercial faucet, clean wall surface for soap dispenser installation, bright public facility lighting' 
  },
  { 
    id: 'urinal', 
    label: '小便斗区 (Urinal Area)', 
    prompt: 'A commercial men\'s restroom wall surface, adjacent to urinals, privacy dividers, clean tiled wall, public hygiene facility context, wall-mounted accessories placement' 
  },
  { 
    id: 'hospital', 
    label: '医疗卫浴 (Hospital Restroom)', 
    prompt: 'A sterile hospital restroom environment, medical grade cleanliness, white and light blue tones, accessibility grab bars, professional healthcare facility aesthetic, hygienic wall surface' 
  },
  {
    id: 'office',
    label: '商务办公 (Modern Office)',
    prompt: 'A modern office wall surface, clean professional background, neutral tones, soft commercial lighting, product mounted on vertical wall, high-end business atmosphere'
  },
  { 
    id: 'minimal', 
    label: '极简家居 (Minimal Home)', 
    prompt: 'A minimalist modern home interior surface, soft daylight, white and beige tones, clean composition, high-end magazine style photography' 
  },
  { 
    id: 'luxury', 
    label: '奢华卫浴 (Luxury Bath)', 
    prompt: 'A marble countertop in a high-end luxury bathroom, warm ambient lighting, spa-like atmosphere, golden accents, premium product display' 
  },
  { 
    id: 'kitchen', 
    label: '现代厨房 (Modern Kitchen)', 
    prompt: 'A clean wooden kitchen counter, blurred modern kitchen background, morning sunlight streaming in, fresh and clean vibe' 
  },
  { 
    id: 'studio', 
    label: '纯色影棚 (Studio Color)', 
    prompt: 'Professional studio photography, solid soft pastel background, three-point lighting, sharp focus, commercial aesthetics, vogue style' 
  },
  { 
    id: 'outdoor', 
    label: '自然户外 (Nature Outdoor)', 
    prompt: 'A natural stone surface outdoors, blurred greenery and foliage in background, dappled sunlight and shadows, organic and fresh feel' 
  },
  {
    id: 'custom',
    label: '自定义场景 (Custom)',
    prompt: '' // Handled dynamically in handleGenerate
  }
];

const RESOLUTION_OPTIONS = [
  { label: '原图尺寸', value: 'ORIGINAL' },
  { label: '1024 x 1024', value: '1024' },
  { label: '2048 x 2048', value: '2048' },
  { label: '3000 x 3000', value: '3000' },
];

const ASPECT_RATIOS = [
    { label: '1:1', value: '1:1' },
    { label: '3:4', value: '3:4' },
    { label: '4:3', value: '4:3' },
    { label: '9:16', value: '9:16' },
    { label: '16:9', value: '16:9' },
];

export default function App() {
  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Image State Management
  const [uploadedImages, setUploadedImages] = useState<ProductImage[]>([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOverWorkspace, setIsDragOverWorkspace] = useState(false);
  
  // History UI State
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  
  // Settings State
  const [outputMode, setOutputMode] = useState<ProcessingMode>(ProcessingMode.WHITE_BG);
  const [selectedStyleId, setSelectedStyleId] = useState<string>('hotel_bath'); 
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [addShadow, setAddShadow] = useState<boolean>(true);
  const [generateCount, setGenerateCount] = useState<number>(1);
  const [targetRatio, setTargetRatio] = useState<string>('1:1');
  const [brushSize, setBrushSize] = useState<number>(15); // Fine brush default
  
  // New State for Restore Resolution
  const [restoreResolution, setRestoreResolution] = useState<'2K' | '4K'>('2K');

  // Overlay State
  const [overlayImage, setOverlayImage] = useState<string | null>(null);
  const [overlayConfig, setOverlayConfig] = useState({ x: 50, y: 50, scale: 30 });
  
  // Canvas Refs
  const maskCanvasRef = useRef<MaskCanvasRef>(null);
  const overlayInputRef = useRef<HTMLInputElement>(null);

  // Mask Data (for Retouch mode)
  const [maskedImageData, setMaskedImageData] = useState<string | null>(null);
  
  // Export State
  const [exportFormat, setExportFormat] = useState<'JPG' | 'PNG'>('JPG');
  const [exportSize, setExportSize] = useState<string>('ORIGINAL');
  
  const [error, setError] = useState<string | null>(null);

  // Derived State
  const activeImage = useMemo(() => 
    uploadedImages.find(img => img.id === activeImageId) || null, 
    [uploadedImages, activeImageId]
  );

  // Reset overlay when switching images
  useEffect(() => {
      setOverlayImage(null);
      setOverlayConfig({ x: 50, y: 50, scale: 30 });
      setMaskedImageData(null);
      setShowHistoryPanel(false);
  }, [activeImageId]);

  // Load Theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
    }
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const newVal = !prev;
      localStorage.setItem('theme', newVal ? 'dark' : 'light');
      return newVal;
    });
  };

  const handleImagesSelect = (files: UploadedFile[]) => {
    const newImages: ProductImage[] = files.map(f => ({
      id: f.id,
      originalData: f.data,
      name: f.name,
      timestamp: Date.now(),
      history: [f.data],
      historyIndex: 0
    }));

    setUploadedImages(prev => {
      const updated = [...prev, ...newImages];
      // Auto-select the first new image if none was selected
      if (!activeImageId && newImages.length > 0) {
        setActiveImageId(newImages[0].id);
      }
      return updated;
    });
    setError(null);
  };

  const handleDeleteImage = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setUploadedImages(prev => {
      const remaining = prev.filter(img => img.id !== id);
      if (activeImageId === id) {
        setActiveImageId(remaining.length > 0 ? remaining[remaining.length - 1].id : null);
      }
      return remaining;
    });
  };

  const handleClearAll = () => {
      setUploadedImages([]);
      setActiveImageId(null);
  };

  const handleMaskUpdate = (data: string | null) => {
      setMaskedImageData(data);
  };

  const handleOverlaySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = (evt) => {
              if (evt.target?.result) {
                  setOverlayImage((evt.target.result as string).split(',')[1]);
              }
          };
          reader.readAsDataURL(file);
      }
  };

  const handleMergeOverlay = () => {
      if (maskCanvasRef.current && activeImage) {
          const mergedData = maskCanvasRef.current.exportImage();
          if (mergedData) {
              setUploadedImages(prev => prev.map(img => {
                  if (img.id === activeImage.id) {
                      const currentHistory = img.history || [img.originalData];
                      const currentIndex = img.historyIndex ?? 0;
                      const newHistory = [...currentHistory.slice(0, currentIndex + 1), mergedData];
                      
                      return { 
                        ...img, 
                        processedData: mergedData,
                        history: newHistory,
                        historyIndex: newHistory.length - 1,
                        processedVariations: undefined
                      };
                  }
                  return img;
              }));
              setOverlayImage(null); // Clear overlay after merge
          }
      }
  };

  const handleUndo = () => {
      if (!activeImage) return;
      if (activeImage.historyIndex > 0) {
          setUploadedImages(prev => prev.map(img => {
              if (img.id === activeImage.id) {
                  const newIndex = img.historyIndex - 1;
                  return {
                      ...img,
                      historyIndex: newIndex,
                      processedData: img.history[newIndex]
                  };
              }
              return img;
          }));
      }
  };

  const handleRedo = () => {
      if (!activeImage) return;
      if (activeImage.historyIndex < activeImage.history.length - 1) {
          setUploadedImages(prev => prev.map(img => {
              if (img.id === activeImage.id) {
                  const newIndex = img.historyIndex + 1;
                  return {
                      ...img,
                      historyIndex: newIndex,
                      processedData: img.history[newIndex]
                  };
              }
              return img;
          }));
      }
  };

  const handleHistoryJump = (index: number) => {
    if (!activeImage) return;
    if (index >= 0 && index < activeImage.history.length) {
        setUploadedImages(prev => prev.map(img => {
            if (img.id === activeImage.id) {
                return {
                    ...img,
                    historyIndex: index,
                    processedData: img.history[index]
                };
            }
            return img;
        }));
    }
  };

  const handleGenerate = async () => {
    if (!activeImage) return;
    setIsProcessing(true);
    setError(null);

    const style = SCENE_STYLES.find(s => s.id === selectedStyleId);
    
    // Determine source data
    let sourceData = activeImage.processedData || activeImage.originalData;
    let isMasked = false;

    // If there is an active overlay that hasn't been merged, merge it temporarily for generation
    if (overlayImage && maskCanvasRef.current) {
        const exported = maskCanvasRef.current.exportImage();
        if (exported) {
            sourceData = exported;
        }
    }

    // For Retouch mode: If user drew a mask, use the canvas export which includes red mask
    if (outputMode === ProcessingMode.RETOUCH) {
        if (maskCanvasRef.current) {
            const exported = maskCanvasRef.current.exportImage();
            if (exported) {
                sourceData = exported;
                isMasked = true; 
            }
        }
    }

    // Scene Prompt Logic: Handle Custom vs Preset
    let finalScenePrompt = style?.prompt;
    let finalCustomDesc = customPrompt;

    if (outputMode === ProcessingMode.SCENE && selectedStyleId === 'custom') {
        if (!customPrompt.trim()) {
            setError("请输入自定义场景描述");
            setIsProcessing(false);
            return;
        }
        finalScenePrompt = customPrompt; // Use user input as the main prompt
        finalCustomDesc = ""; // Clear supplement to avoid redundancy in the prompt construction
    }

    const countToGenerate = (outputMode === ProcessingMode.SCENE) ? generateCount : 1;

    try {
      const results = await generateEnhancedImage(sourceData, {
        mode: outputMode,
        scenePrompt: finalScenePrompt,
        customDescription: finalCustomDesc,
        addShadow: addShadow,
        count: countToGenerate,
        aspectRatio: outputMode === ProcessingMode.RESIZE ? targetRatio : undefined,
        isMasked: isMasked,
        upscaleOption: outputMode === ProcessingMode.RESTORE ? restoreResolution : undefined
      });
      
      // Update the active image with the processed result(s)
      setUploadedImages(prev => prev.map(img => {
          if (img.id === activeImage.id) {
              // History Management
              const currentHistory = img.history || [img.originalData];
              const currentIndex = img.historyIndex ?? 0;
              // Truncate future history if we were in the middle of undo stack
              const historyUpToNow = currentHistory.slice(0, currentIndex + 1);
              const newResult = results[0];
              const newHistory = [...historyUpToNow, newResult];

              return { 
                ...img, 
                processedData: newResult,
                history: newHistory,
                historyIndex: newHistory.length - 1,
                processedVariations: results 
              };
          }
          return img;
      }));

      // Clear mask after successful generation
      setMaskedImageData(null);
      setOverlayImage(null);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "生成失败。请检查 API Key 设置或网络连接。");
    } finally {
      setIsProcessing(false);
    }
  };

  const selectVariation = (base64Data: string) => {
      if (!activeImage) return;
      // Selecting a variation updates the view (processedData) but usually we don't push to history 
      // until an action is taken on it, but for simplicity let's just update the view. 
      // If the user hits "Undo" it will go back to the state before generation.
      setUploadedImages(prev => prev.map(img => 
        img.id === activeImage.id ? { ...img, processedData: base64Data } : img
      ));
  };

  const processImageForDownload = (base64Data: string, size: string, format: 'JPG' | 'PNG'): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = `data:image/jpeg;base64,${base64Data}`;
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.naturalWidth;
        let height = img.naturalHeight;

        if (size !== 'ORIGINAL') {
            const targetSize = parseInt(size);
             const aspect = width / height;
             if (width > height) {
                 width = targetSize;
                 height = width / aspect;
             } else {
                 height = targetSize;
                 width = height * aspect;
             }
        }

        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          const mimeType = format === 'JPG' ? 'image/jpeg' : 'image/png';
          resolve(canvas.toDataURL(mimeType, 0.9).split(',')[1]);
        } else {
            resolve(base64Data);
        }
      };
    });
  };

  const handleDownload = async () => {
      if (!activeImage) return;
      // If overlay is active, download merged
      let dataToSave = activeImage.processedData || activeImage.originalData;
      if (overlayImage && maskCanvasRef.current) {
          const merged = maskCanvasRef.current.exportImage();
          if (merged) dataToSave = merged;
      }

      const result = await processImageForDownload(dataToSave, exportSize, exportFormat);
      
      const link = document.createElement('a');
      link.href = `data:image/${exportFormat === 'JPG' ? 'jpeg' : 'png'};base64,${result}`;
      link.download = `${activeImage.name.split('.')[0]}_processed.${exportFormat.toLowerCase()}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  // Workspace Drag & Drop Handlers
  const handleWorkspaceDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      // Only trigger if dragging files to avoid flickering
      if (e.dataTransfer.types.includes('Files')) {
          setIsDragOverWorkspace(true);
      }
  };

  const handleWorkspaceDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
      setIsDragOverWorkspace(false);
  };

  const handleWorkspaceDrop = async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOverWorkspace(false);
      
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const files: File[] = Array.from(e.dataTransfer.files);
          const validFiles = files.filter(f => 
             f.type.startsWith('image/') || 
             f.name.toLowerCase().endsWith('.heic') || 
             f.name.toLowerCase().endsWith('.heif')
          );
          
          if (validFiles.length > 0) {
              const currentCount = uploadedImages.length;
              if (currentCount + validFiles.length > 5) {
                   alert("最多只能上传 5 张图片");
                   return;
              }
              
              try {
                  const processed = await Promise.all(validFiles.map(convertFileToBase64));
                  handleImagesSelect(processed);
              } catch (err) {
                  console.error(err);
                  alert("处理图片失败");
              }
          }
      }
  };

  return (
    <div className={`flex flex-col h-screen transition-colors ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'}`}>
        {/* Header */}
        <header className={`flex items-center justify-between px-6 py-4 border-b ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-white bg-white'}`}>
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white shadow-brand-500/30 shadow-lg">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                </div>
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-600 to-indigo-600">
                    ProShot <span className="text-brand-600 font-extrabold">AI</span>
                </span>
            </div>
            <div className="flex items-center gap-4">
                 <button onClick={handleClearAll} className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                     清空所有
                 </button>
                 <div className="h-4 w-px bg-slate-300 dark:bg-slate-700"></div>
                
                 <Button variant="ghost" size="sm" onClick={toggleTheme} className="w-9 h-9 p-0 rounded-full">
                    {isDarkMode ? '☀️' : (
                       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                         <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                       </svg>
                    )}
                </Button>
                <Button variant="ghost" size="sm" className="w-9 h-9 p-0 rounded-full">
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                     <circle cx="12" cy="12" r="3"></circle>
                     <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                   </svg>
                </Button>

                 <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Gemini 2.5 在线</span>
                </div>
            </div>
        </header>

        {/* Main Layout Grid */}
        <div className="flex-1 flex overflow-hidden p-6 gap-6">
             {/* Left Column: Canvas + Thumbnails */}
             <div className="flex-1 flex flex-col min-w-0 gap-4">
                 <div className="flex justify-between items-center px-1">
                    <h2 className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        摄影工作区 {uploadedImages.length > 0 ? `(${uploadedImages.findIndex(i => i.id === activeImageId) + 1}/${uploadedImages.length})` : '(0/0)'}
                    </h2>
                 </div>
                 
                 {/* Workspace Container with Drop Handling */}
                 <div 
                    className={`flex-1 relative rounded-3xl overflow-hidden transition-all flex flex-col items-center justify-center border-2 border-dashed ${!activeImage ? 'bg-slate-50 border-slate-300' : (isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-brand-200 shadow-sm')} ${isDragOverWorkspace ? 'border-brand-500 ring-4 ring-brand-500/20' : ''}`}
                    onDragOver={handleWorkspaceDragOver}
                    onDragLeave={handleWorkspaceDragLeave}
                    onDrop={handleWorkspaceDrop}
                 >
                     {/* Drag Overlay */}
                     {isDragOverWorkspace && (
                         <div className="absolute inset-0 z-50 bg-brand-50/90 dark:bg-slate-800/90 border-4 border-brand-500 border-dashed rounded-3xl flex flex-col items-center justify-center animate-in fade-in duration-200 pointer-events-none">
                             <svg className="w-16 h-16 text-brand-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                             </svg>
                             <h3 className="text-2xl font-bold text-brand-700 dark:text-brand-400">释放以添加图片</h3>
                         </div>
                     )}

                     {/* If active image exists, show viewer or canvas */}
                     {activeImage ? (
                         <div className="w-full h-full flex flex-col items-center justify-center p-8 relative group/canvas">
                             
                             {/* Undo/Redo/History Toolbar (Visible on Hover/Active) */}
                             <div className="absolute top-6 left-6 z-20 flex gap-2">
                                <div className="flex bg-white/90 dark:bg-slate-900/90 backdrop-blur rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-1">
                                    <button 
                                        onClick={handleUndo}
                                        disabled={activeImage.historyIndex <= 0}
                                        className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 transition-colors"
                                        title="撤销 (Undo)"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
                                    </button>
                                    <div className="w-px bg-slate-200 dark:bg-slate-700 my-1 mx-0.5"></div>
                                    <button 
                                        onClick={handleRedo}
                                        disabled={activeImage.historyIndex >= (activeImage.history.length - 1)}
                                        className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 transition-colors"
                                        title="重做 (Redo)"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>
                                    </button>
                                    
                                    <div className="w-px bg-slate-200 dark:bg-slate-700 my-1 mx-0.5"></div>
                                    
                                    <button 
                                        onClick={() => setShowHistoryPanel(!showHistoryPanel)}
                                        className={`p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors ${showHistoryPanel ? 'bg-slate-100 dark:bg-slate-800 text-brand-600 dark:text-brand-400' : ''}`}
                                        title="历史记录 (History)"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                    </button>
                                </div>
                             </div>

                             {/* Visual History Panel */}
                             <HistoryPanel 
                                isOpen={showHistoryPanel}
                                history={activeImage.history}
                                activeIndex={activeImage.historyIndex}
                                onSelect={handleHistoryJump}
                                onClose={() => setShowHistoryPanel(false)}
                             />

                             {/* Show MaskCanvas if in Retouch mode OR if an Overlay is active */}
                             {(outputMode === ProcessingMode.RETOUCH || overlayImage) ? (
                                 <MaskCanvas 
                                    ref={maskCanvasRef}
                                    base64Image={activeImage.processedData || activeImage.originalData}
                                    brushSize={brushSize}
                                    overlayImage={overlayImage}
                                    overlayConfig={overlayConfig}
                                    onUpdate={handleMaskUpdate}
                                    isRetouchMode={outputMode === ProcessingMode.RETOUCH}
                                 />
                             ) : (
                                 /* Standard Viewer */
                                 <img 
                                    src={`data:image/jpeg;base64,${activeImage.processedData || activeImage.originalData}`} 
                                    alt="Active" 
                                    className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
                                 />
                             )}

                             {/* Variations strip overlay (floating) - Hide if editing */}
                             {!(outputMode === ProcessingMode.RETOUCH || overlayImage) && activeImage.processedVariations && activeImage.processedVariations.length > 1 && (
                                 <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 bg-white/90 dark:bg-black/70 p-2.5 rounded-2xl shadow-xl backdrop-blur border border-slate-200 dark:border-slate-700">
                                     {activeImage.processedVariations.map((v, i) => (
                                         <img 
                                            key={i} 
                                            src={`data:image/jpeg;base64,${v}`} 
                                            className={`w-14 h-14 object-cover rounded-xl cursor-pointer border-2 transition-transform hover:scale-105 ${activeImage.processedData === v ? 'border-brand-500' : 'border-transparent'}`}
                                            onClick={() => selectVariation(v)}
                                            alt={`Variation ${i + 1}`}
                                         />
                                     ))}
                                 </div>
                             )}
                         </div>
                     ) : (
                         /* Empty State / Upload Area */
                         <div className="w-full h-full p-4">
                            <UploadArea onImagesSelect={handleImagesSelect} currentCount={uploadedImages.length} isDarkMode={isDarkMode} />
                         </div>
                     )}
                 </div>

                 {/* Bottom Thumbnails */}
                 <div className={`h-24 rounded-2xl border flex items-center px-4 gap-3 overflow-x-auto ${isDarkMode ? 'border-slate-800 bg-slate-800' : 'border-slate-200 bg-white shadow-sm'}`}>
                      {uploadedImages.map(img => (
                          <div 
                             key={img.id} 
                             onClick={() => setActiveImageId(img.id)}
                             className={`relative w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${activeImageId === img.id ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-transparent hover:border-slate-300'}`}
                          >
                              <img src={`data:image/jpeg;base64,${img.processedData || img.thumbnail || img.originalData}`} className="w-full h-full object-cover" alt="" />
                              <button 
                                 onClick={(e) => handleDeleteImage(e, img.id)}
                                 className="absolute top-0 right-0 bg-black/50 text-white w-5 h-5 flex items-center justify-center rounded-bl hover:bg-red-500 text-xs"
                              >
                                  ×
                              </button>
                          </div>
                      ))}
                      <div className="w-16 h-16 flex-shrink-0">
                          <UploadArea onImagesSelect={handleImagesSelect} currentCount={uploadedImages.length} compact isDarkMode={isDarkMode} />
                      </div>
                 </div>
             </div>

             {/* Right Sidebar (Controls) */}
             <div className="w-[340px] flex-shrink-0 flex flex-col">
                  {/* Card Container */}
                  <div className={`flex-1 rounded-3xl shadow-sm border overflow-hidden flex flex-col ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                      
                      {/* Title */}
                      <div className="px-6 py-6 pb-2">
                        <div className="flex items-center gap-2 mb-1">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-brand-600">
                                <path d="M10 3h4v18h-4zM3 8h4v8H3zM17 8h4v8h-4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>参数设置</h3>
                        </div>
                      </div>

                      {/* Content Area */}
                      <div className="flex-1 overflow-y-auto px-6 py-4">
                          {activeImage ? (
                             <div className="flex flex-col gap-8">
                                 {/* Mode Selection */}
                                 <div className="space-y-3">
                                     <label className="text-xs font-semibold text-slate-500">输出模式</label>
                                     <div className={`grid grid-cols-2 gap-1 p-1 rounded-xl ${isDarkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
                                         {[
                                             { id: ProcessingMode.WHITE_BG, label: '白底图' },
                                             { id: ProcessingMode.SCENE, label: '场景图' },
                                             { id: ProcessingMode.RESIZE, label: '智能扩图' },
                                             { id: ProcessingMode.RETOUCH, label: '智能修图' },
                                             { id: ProcessingMode.RESTORE, label: '修复画质' }, // Added Restore Button
                                         ].map(opt => (
                                             <button
                                                key={opt.id}
                                                onClick={() => {
                                                    setOutputMode(opt.id);
                                                    setCustomPrompt('');
                                                }}
                                                className={`py-2 text-sm font-medium rounded-lg transition-all ${outputMode === opt.id ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                             >
                                                 {opt.label}
                                             </button>
                                         ))}
                                     </div>
                                 </div>
                                 
                                 {/* Image Overlay / Asset Section - Always Available */}
                                 <div className="space-y-3">
                                     <label className="text-xs font-semibold text-slate-500">素材叠加 (可选)</label>
                                     
                                     {!overlayImage ? (
                                         <div 
                                            onClick={() => overlayInputRef.current?.click()}
                                            className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${isDarkMode ? 'border-slate-700 hover:border-slate-500 bg-slate-800' : 'border-slate-200 hover:border-brand-300 bg-slate-50'}`}
                                         >
                                             <span className="text-sm text-slate-500">点击添加图片/Logo</span>
                                         </div>
                                     ) : (
                                         <div className="space-y-3 animate-in fade-in">
                                             {/* Overlay Controls */}
                                             <div className="space-y-2 p-3 rounded-lg border bg-slate-50 dark:bg-slate-800 dark:border-slate-700">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-medium">大小 ({overlayConfig.scale}%)</span>
                                                    <input 
                                                        type="range" min="5" max="150" value={overlayConfig.scale}
                                                        onChange={(e) => setOverlayConfig(p => ({...p, scale: parseInt(e.target.value)}))}
                                                        className="w-24 h-1.5 bg-slate-200 rounded-lg accent-brand-600"
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-medium">水平 ({overlayConfig.x}%)</span>
                                                    <input 
                                                        type="range" min="0" max="100" value={overlayConfig.x}
                                                        onChange={(e) => setOverlayConfig(p => ({...p, x: parseInt(e.target.value)}))}
                                                        className="w-24 h-1.5 bg-slate-200 rounded-lg accent-brand-600"
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-medium">垂直 ({overlayConfig.y}%)</span>
                                                    <input 
                                                        type="range" min="0" max="100" value={overlayConfig.y}
                                                        onChange={(e) => setOverlayConfig(p => ({...p, y: parseInt(e.target.value)}))}
                                                        className="w-24 h-1.5 bg-slate-200 rounded-lg accent-brand-600"
                                                    />
                                                </div>
                                                
                                                <div className="flex gap-2 pt-2">
                                                    <Button size="sm" variant="secondary" onClick={handleMergeOverlay} className="flex-1 text-xs h-7">融合图层</Button>
                                                    <Button size="sm" variant="ghost" onClick={() => setOverlayImage(null)} className="text-red-500 hover:text-red-700 text-xs h-7">移除</Button>
                                                </div>
                                             </div>
                                         </div>
                                     )}
                                     <input type="file" ref={overlayInputRef} onChange={handleOverlaySelect} accept="image/*" className="hidden" />
                                 </div>

                                 <div className="h-px bg-slate-100 dark:bg-slate-700" />

                                 {/* White BG Options */}
                                 {outputMode === ProcessingMode.WHITE_BG && (
                                     <div className="space-y-3 animate-in fade-in slide-in-from-top-2 pt-2">
                                          <div className="space-y-2">
                                              <label className="text-xs font-semibold text-slate-500">补充描述 (可选)</label>
                                              <textarea 
                                                 value={customPrompt}
                                                 onChange={(e) => setCustomPrompt(e.target.value)}
                                                 className={`w-full p-3 rounded-xl border text-sm h-20 resize-none outline-none focus:ring-2 focus:ring-brand-500/20 ${isDarkMode ? 'bg-slate-700 border-slate-600 placeholder-slate-400' : 'bg-slate-50 border-slate-200 placeholder-slate-400'}`}
                                                 placeholder="例如：保持产品原有光泽，修复表面反光..."
                                              />
                                          </div>
                                     </div>
                                 )}

                                 {/* Scene Options */}
                                 {outputMode === ProcessingMode.SCENE && (
                                     <div className="space-y-5 animate-in fade-in slide-in-from-top-2">
                                         <div className="space-y-2">
                                             <label className="text-xs font-semibold text-slate-500">场景风格</label>
                                             <div className="relative">
                                                 <select 
                                                    value={selectedStyleId}
                                                    onChange={(e) => setSelectedStyleId(e.target.value)}
                                                    className={`w-full p-3 rounded-xl border text-sm appearance-none cursor-pointer outline-none focus:ring-2 focus:ring-brand-500/20 ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}
                                                 >
                                                     {SCENE_STYLES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                                 </select>
                                                 <div className="absolute right-3 top-3.5 pointer-events-none text-slate-400">
                                                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                                                 </div>
                                             </div>
                                         </div>

                                         <div className="space-y-2">
                                             <label className="text-xs font-semibold text-slate-500">生成数量 (1-5)</label>
                                             <div className="flex gap-2">
                                                 {[1, 2, 3, 4, 5].map(num => (
                                                     <button
                                                        key={num}
                                                        onClick={() => setGenerateCount(num)}
                                                        className={`flex-1 h-9 rounded-lg text-sm font-medium border transition-all ${generateCount === num ? 'bg-brand-50 border-brand-500 text-brand-600' : 'bg-white border-slate-200 text-slate-600 hover:border-brand-200'}`}
                                                     >
                                                         {num}
                                                     </button>
                                                 ))}
                                             </div>
                                         </div>

                                         <div className="space-y-2">
                                             <label className="text-xs font-semibold text-slate-500">
                                                {selectedStyleId === 'custom' ? '场景描述 (必填)' : '补充描述 (可选)'}
                                             </label>
                                             <textarea 
                                                value={customPrompt}
                                                onChange={(e) => setCustomPrompt(e.target.value)}
                                                className={`w-full p-3 rounded-xl border text-sm h-20 resize-none outline-none focus:ring-2 focus:ring-brand-500/20 ${isDarkMode ? 'bg-slate-700 border-slate-600 placeholder-slate-400' : 'bg-slate-50 border-slate-200 placeholder-slate-400'}`}
                                                placeholder={selectedStyleId === 'custom' ? "请详细描述您想要的场景，例如：一张深色的胡桃木办公桌上，旁边放着一杯咖啡，背景是明亮的落地窗..." : "例如：木质纹理，窗边自然光，旁边放一瓶绿植..."}
                                             />
                                         </div>
                                     </div>
                                 )}

                                 {/* Resize Options */}
                                 {outputMode === ProcessingMode.RESIZE && (
                                     <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                         <label className="text-xs font-semibold text-slate-500">目标比例</label>
                                         <div className="grid grid-cols-3 gap-2">
                                             {ASPECT_RATIOS.map(r => (
                                                 <button
                                                    key={r.value}
                                                    onClick={() => setTargetRatio(r.value)}
                                                    className={`py-2 px-1 text-sm rounded-lg border transition-all ${targetRatio === r.value ? 'bg-brand-50 border-brand-500 text-brand-600' : 'bg-white border-slate-200 text-slate-600 hover:border-brand-200'}`}
                                                 >
                                                     {r.label}
                                                 </button>
                                             ))}
                                         </div>
                                     </div>
                                 )}

                                 {/* Retouch Options */}
                                 {outputMode === ProcessingMode.RETOUCH && (
                                     <div className="space-y-5 animate-in fade-in slide-in-from-top-2">
                                          <div className="space-y-3">
                                              <div className="flex justify-between items-center">
                                                <label className="text-xs font-semibold text-slate-500">画笔大小</label>
                                                <span className="text-xs text-slate-400">{brushSize}px</span>
                                              </div>
                                              <input 
                                                type="range" 
                                                min="1" 
                                                max="100" 
                                                value={brushSize} 
                                                onChange={(e) => setBrushSize(Number(e.target.value))}
                                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-600"
                                              />
                                          </div>
                                          
                                          <div className="space-y-2">
                                              <label className="text-xs font-semibold text-slate-500">修改需求 (必填)</label>
                                              <textarea 
                                                 value={customPrompt}
                                                 onChange={(e) => setCustomPrompt(e.target.value)}
                                                 className={`w-full p-3 rounded-xl border text-sm h-32 resize-none outline-none focus:ring-2 focus:ring-brand-500/20 ${isDarkMode ? 'bg-slate-700 border-slate-600 placeholder-slate-400' : 'bg-slate-50 border-slate-200 placeholder-slate-400'}`}
                                                 placeholder="请涂抹要修改的区域，并在此描述修改内容。例如：把这里改成红色，或者：移除这个瑕疵..."
                                              />
                                          </div>
                                     </div>
                                 )}

                                 {/* Restore Options (New) */}
                                 {outputMode === ProcessingMode.RESTORE && (
                                     <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                         <div className={`p-3 text-xs rounded-lg border leading-relaxed ${isDarkMode ? 'bg-blue-900/20 text-blue-200 border-blue-800' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                                             ✨ AI 将自动识别并修复图片表面的灰尘、划痕和噪点，同时保持产品原有细节和背景不变。
                                         </div>

                                         <div className="space-y-2">
                                              <label className="text-xs font-semibold text-slate-500">画质分辨率</label>
                                              <div className="flex gap-2">
                                                  {['2K', '4K'].map(res => (
                                                      <button
                                                        key={res}
                                                        onClick={() => setRestoreResolution(res as any)}
                                                        className={`flex-1 h-9 rounded-lg text-sm font-medium border transition-all ${restoreResolution === res ? 'bg-brand-50 border-brand-500 text-brand-600 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-brand-200'}`}
                                                      >
                                                          {res}
                                                      </button>
                                                  ))}
                                              </div>
                                         </div>

                                         <div className="space-y-2">
                                             <label className="text-xs font-semibold text-slate-500">补充说明 (可选)</label>
                                             <textarea 
                                                value={customPrompt}
                                                onChange={(e) => setCustomPrompt(e.target.value)}
                                                className={`w-full p-3 rounded-xl border text-sm h-20 resize-none outline-none focus:ring-2 focus:ring-brand-500/20 ${isDarkMode ? 'bg-slate-700 border-slate-600 placeholder-slate-400' : 'bg-slate-50 border-slate-200 placeholder-slate-400'}`}
                                                placeholder="例如：只修复表面划痕，不要改变材质反光..."
                                             />
                                         </div>
                                     </div>
                                 )}

                                 <div className="h-px bg-slate-100 dark:bg-slate-700" />

                                 {/* Enhancement Section (Not for Retouch mode usually, but could be useful) */}
                                 {outputMode !== ProcessingMode.RETOUCH && outputMode !== ProcessingMode.RESTORE && (
                                    <div className="space-y-4">
                                        <label className="text-xs font-semibold text-slate-500">画质增强</label>
                                        <div className={`flex items-center justify-between p-4 rounded-xl border ${isDarkMode ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                                            <div className="flex items-center gap-3">
                                                <div className="text-brand-500">
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                                                    </svg>
                                                </div>
                                                <span className="text-sm font-medium">添加自然阴影</span>
                                            </div>
                                            
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" checked={addShadow} onChange={(e) => setAddShadow(e.target.checked)} className="sr-only peer" />
                                                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
                                            </label>
                                        </div>
                                    </div>
                                 )}

                                 <Button 
                                    onClick={handleGenerate} 
                                    isLoading={isProcessing} 
                                    className="w-full py-3.5 text-base font-semibold shadow-xl shadow-brand-500/20 active:scale-[0.98] transition-transform"
                                    disabled={outputMode === ProcessingMode.RETOUCH && !customPrompt.trim()}
                                 >
                                     {isProcessing ? '正在处理...' : (outputMode === ProcessingMode.RETOUCH ? '🎨 确认修改' : (outputMode === ProcessingMode.RESTORE ? '🪄 开始修复' : '⚡ 开始生成图片'))}
                                 </Button>
                                 
                                 {error && (
                                     <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100">
                                         {error}
                                     </div>
                                 )}

                                 <div className="h-px bg-slate-100 dark:bg-slate-700" />
                                 
                                 {/* Export Section */}
                                 <div className="space-y-4 pb-4">
                                     <label className="text-xs font-semibold text-slate-500">导出选项</label>
                                     
                                     {/* Format */}
                                     <div className="grid grid-cols-2 gap-3">
                                         {['JPG', 'PNG'].map((fmt) => (
                                             <button
                                                key={fmt}
                                                onClick={() => setExportFormat(fmt as any)}
                                                className={`py-2 rounded-lg border text-sm font-medium transition-all ${exportFormat === fmt ? 'border-brand-500 text-brand-600 bg-brand-50' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                             >
                                                 {fmt}
                                             </button>
                                         ))}
                                     </div>

                                     {/* Resolution */}
                                     <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-500">分辨率</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {RESOLUTION_OPTIONS.map(o => (
                                                <button
                                                    key={o.value}
                                                    onClick={() => setExportSize(o.value)}
                                                    className={`py-2 px-1 text-xs rounded-lg border transition-all ${exportSize === o.value ? 'border-brand-500 text-brand-600 bg-brand-50' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                                >
                                                    {o.label}
                                                </button>
                                            ))}
                                        </div>
                                     </div>

                                     <Button variant="outline" onClick={handleDownload} className="w-full py-3 border-slate-300 hover:border-slate-400 text-slate-700">
                                         <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                         </svg>
                                         下载 原图
                                     </Button>
                                 </div>
                             </div>
                          ) : (
                              /* Empty State for Settings */
                              <div className="h-full flex flex-col items-center justify-center text-center opacity-40 pb-10">
                                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mb-4 text-slate-300">
                                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                      <line x1="9" y1="3" x2="9" y2="21" />
                                      <path d="M15 3v18" />
                                      <path d="M3 9h18" />
                                      <path d="M3 15h18" />
                                  </svg>
                                  <p className="text-sm font-medium">请先上传图片</p>
                              </div>
                          )}
                      </div>
                  </div>
             </div>
        </div>
    </div>
  );
}