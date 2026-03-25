import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef, useCallback } from 'react';

export interface OverlayConfig {
  x: number; // 0-100 percentage
  y: number; // 0-100 percentage
  scale: number; // 1-200 percentage relative to base image width
}

interface MaskCanvasProps {
  base64Image: string;
  brushSize: number;
  overlayImage: string | null;
  overlayConfig: OverlayConfig;
  onUpdate: (combinedData: string | null) => void;
  isRetouchMode: boolean;
}

export interface MaskCanvasRef {
  exportImage: () => string | null;
}

type ToolType = 'brush' | 'pan';

export const MaskCanvas = forwardRef<MaskCanvasRef, MaskCanvasProps>(({ 
  base64Image, 
  brushSize,
  overlayImage,
  overlayConfig,
  onUpdate,
  isRetouchMode
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Image Resources
  const [baseImgElement, setBaseImgElement] = useState<HTMLImageElement | null>(null);
  const [overlayImgElement, setOverlayImgElement] = useState<HTMLImageElement | null>(null);
  
  // State
  const [hasStrokes, setHasStrokes] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  
  // Transform State
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  
  // Tool State
  const [activeTool, setActiveTool] = useState<ToolType>('brush');
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // References for drag calculations
  const lastMousePos = useRef({ x: 0, y: 0 });
  // To track previous image dims for preserving view state
  const prevImageDims = useRef<{w: number, h: number} | null>(null);

  // 1. Load Images
  useEffect(() => {
    const img = new Image();
    img.src = `data:image/jpeg;base64,${base64Image}`;
    img.onload = () => {
      // Check if dimensions are roughly the same (allowing for small rounding errors)
      // If so, preserve view state.
      let shouldResetView = true;
      if (prevImageDims.current) {
          const wDiff = Math.abs(prevImageDims.current.w - img.naturalWidth);
          const hDiff = Math.abs(prevImageDims.current.h - img.naturalHeight);
          if (wDiff < 5 && hDiff < 5) {
              shouldResetView = false;
          }
      }

      setBaseImgElement(img);
      prevImageDims.current = { w: img.naturalWidth, h: img.naturalHeight };
      
      if (shouldResetView) {
          // Reset view when new image loads with different size
          setScale(1);
          setOffset({ x: 0, y: 0 });
      }
    };
  }, [base64Image]);

  useEffect(() => {
    if (overlayImage) {
      const img = new Image();
      img.src = `data:image/jpeg;base64,${overlayImage}`;
      img.onload = () => {
        setOverlayImgElement(img);
      };
    } else {
      setOverlayImgElement(null);
    }
  }, [overlayImage]);

  // 2. Keyboard Shortcuts (Spacebar to Pan)
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.code === 'Space' && !e.repeat) {
              setIsSpacePressed(true);
          }
      };
      const handleKeyUp = (e: KeyboardEvent) => {
          if (e.code === 'Space') {
              setIsSpacePressed(false);
              setIsPanning(false); // Stop panning if key released
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      return () => {
          window.removeEventListener('keydown', handleKeyDown);
          window.removeEventListener('keyup', handleKeyUp);
      };
  }, []);

  // 3. Expose Export
  useImperativeHandle(ref, () => ({
    exportImage: () => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      return canvas.toDataURL('image/jpeg', 0.95).split(',')[1];
    }
  }));

  // 4. Render Canvas Logic
  const renderCanvas = useCallback(() => {
    if (!baseImgElement || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Save the current composite operation (which might be affected by eraser strokes if we had them, 
    // strictly speaking we are just drawing red on top, so standard over is fine)
    
    // Draw Base
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(baseImgElement, 0, 0, canvas.width, canvas.height);

    // Draw Overlay
    if (overlayImgElement) {
        const aspect = overlayImgElement.naturalWidth / overlayImgElement.naturalHeight;
        
        // Scale relative to canvas width
        const drawWidth = canvas.width * (overlayConfig.scale / 100);
        const drawHeight = drawWidth / aspect;

        const posX = (canvas.width * (overlayConfig.x / 100)) - (drawWidth / 2);
        const posY = (canvas.height * (overlayConfig.y / 100)) - (drawHeight / 2);

        ctx.drawImage(overlayImgElement, posX, posY, drawWidth, drawHeight);
    }
  }, [baseImgElement, overlayImgElement, overlayConfig]);

  // 5. Initial Sizing & Redraw triggers
  useEffect(() => {
    if (!baseImgElement || !canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    
    // Fit canvas logic (initial fit)
    const { clientWidth, clientHeight } = container;
    const imgRatio = baseImgElement.naturalWidth / baseImgElement.naturalHeight;
    const containerRatio = clientWidth / clientHeight;

    let finalWidth, finalHeight;
    if (containerRatio > imgRatio) {
      finalHeight = clientHeight - 40; // padding
      finalWidth = finalHeight * imgRatio;
    } else {
      finalWidth = clientWidth - 40; // padding
      finalHeight = finalWidth / imgRatio;
    }

    // Set display size
    canvas.style.width = `${finalWidth}px`;
    canvas.style.height = `${finalHeight}px`;

    // Set internal resolution
    canvas.width = baseImgElement.naturalWidth;
    canvas.height = baseImgElement.naturalHeight;

    renderCanvas();
    setHasStrokes(false);

  }, [baseImgElement, renderCanvas]);

  // Re-render if overlay changes (clears strokes effectively as we don't store paths)
  useEffect(() => {
      if (baseImgElement) {
          renderCanvas();
          setHasStrokes(false);
      }
  }, [overlayImgElement, overlayConfig, renderCanvas]);


  // 6. Interaction Helpers
  const getClientPos = (e: React.MouseEvent | React.TouchEvent) => {
      if ('touches' in e) {
          return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
      return { x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY };
  };

  const getCanvasCoordinates = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    // rect includes the CSS transform scale, so standard logic works perfectly!
    // As the element gets bigger on screen, rect gets bigger, scaleX gets smaller, 
    // mapping the larger screen pixels back to the same internal pixels.
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  // 7. Event Handlers
  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    // Determine action based on Tool or Spacebar
    const isPanAction = activeTool === 'pan' || isSpacePressed;
    
    const { x, y } = getClientPos(e);
    lastMousePos.current = { x, y };

    if (isPanAction) {
        setIsPanning(true);
        return;
    }

    if (!isRetouchMode) return;
    
    // Start Drawing
    setIsDrawing(true);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    
    const coords = getCanvasCoordinates(x, y);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
    // Adjust brush size relative to canvas resolution
    ctx.lineWidth = Math.max(1, brushSize * (canvasRef.current!.width / 1000));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    const { x, y } = getClientPos(e);
    
    if (isPanning) {
        const deltaX = x - lastMousePos.current.x;
        const deltaY = y - lastMousePos.current.y;
        setOffset(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
        lastMousePos.current = { x, y };
        return;
    }

    if (isDrawing && isRetouchMode) {
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        const coords = getCanvasCoordinates(x, y);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
        setHasStrokes(true);
    }
  };

  const handleMouseUp = () => {
    if (isDrawing) {
        setIsDrawing(false);
        const canvas = canvasRef.current;
        if (canvas) {
            const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
            onUpdate(dataUrl.split(',')[1]);
        }
    }
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
      e.stopPropagation();
      // Zoom logic
      if (e.ctrlKey || e.metaKey || isRetouchMode) {
          // If in retouch mode, wheel defaults to zoom for better UX
          const delta = -e.deltaY * 0.001;
          const newScale = Math.min(Math.max(0.5, scale + delta), 5);
          setScale(newScale);
      }
  };

  const resetView = () => {
      setScale(1);
      setOffset({ x: 0, y: 0 });
  };

  const clearMask = () => {
      renderCanvas(); 
      setHasStrokes(false);
      onUpdate(null);
  };

  // 8. Dynamic Cursor
  const getCursor = () => {
      if (isSpacePressed || activeTool === 'pan') {
          return isPanning ? 'cursor-grabbing' : 'cursor-grab';
      }
      return isRetouchMode ? 'cursor-crosshair' : 'cursor-default';
  };

  return (
    <div className="w-full h-full relative bg-slate-100 overflow-hidden rounded-lg group">
       {/* Canvas Container with Transform */}
       <div 
         ref={containerRef}
         className={`w-full h-full flex items-center justify-center ${getCursor()}`}
         onWheel={handleWheel}
         onMouseDown={handleMouseDown}
         onMouseMove={handleMouseMove}
         onMouseUp={handleMouseUp}
         onMouseLeave={handleMouseUp}
         onTouchStart={handleMouseDown}
         onTouchMove={handleMouseMove}
         onTouchEnd={handleMouseUp}
       >
           <canvas
            ref={canvasRef}
            className="shadow-xl transition-transform duration-75 ease-out origin-center"
            style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`
            }}
          />
       </div>
      
      {/* Retouch Toolbar */}
      {isRetouchMode && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur shadow-xl border border-slate-200 rounded-2xl p-2 flex items-center gap-2 transition-opacity">
              {/* Tool Switcher */}
              <div className="flex bg-slate-100 p-1 rounded-xl mr-2">
                  <button 
                     onClick={() => setActiveTool('brush')}
                     className={`p-2 rounded-lg transition-all ${activeTool === 'brush' ? 'bg-white shadow text-brand-600' : 'text-slate-500 hover:text-slate-700'}`}
                     title="画笔工具 (B)"
                  >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 10.66a5 5 0 0 1 2.67 8.67L12 24l-3.33-1.67A5 5 0 0 1 7.34 18H2v-6h5.34l3.33-1.66A5 5 0 0 1 12 11.34V18h6v-7.34z"/><path d="M12 2v6"/></svg>
                  </button>
                  <button 
                     onClick={() => setActiveTool('pan')}
                     className={`p-2 rounded-lg transition-all ${activeTool === 'pan' ? 'bg-white shadow text-brand-600' : 'text-slate-500 hover:text-slate-700'}`}
                     title="抓手工具 (Space)"
                  >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6l-4-4-4 4-2-2-8 8Z"/><path d="M14 6.5a2 2 0 0 0-4 0v9"/></svg>
                  </button>
              </div>

              <div className="h-6 w-px bg-slate-200 mx-1"></div>

              {/* Zoom Controls */}
              <button onClick={() => setScale(s => Math.max(0.5, s - 0.5))} className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
              <span className="text-xs font-mono w-10 text-center text-slate-500">{Math.round(scale * 100)}%</span>
              <button onClick={() => setScale(s => Math.min(5, s + 0.5))} className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
              
              <button onClick={resetView} className="px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded border border-slate-200 mx-1">
                  100%
              </button>

              <div className="h-6 w-px bg-slate-200 mx-1"></div>

              {/* Actions */}
              <button 
                onClick={clearMask}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:hover:bg-transparent"
                disabled={!hasStrokes}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                清除
              </button>
          </div>
      )}

      {/* Helper Tip */}
      {isRetouchMode && scale > 1 && activeTool === 'brush' && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-3 py-1 rounded-full text-[10px] backdrop-blur opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              按住空格键拖动画面
          </div>
      )}
    </div>
  );
});

MaskCanvas.displayName = 'MaskCanvas';