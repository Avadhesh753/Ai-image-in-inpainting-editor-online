import React, { useRef, useEffect, useState, useCallback } from 'react';
import { editImageWithMask } from '../services/geminiService';

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

const Spinner: React.FC = () => (
  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
);

type Tool = 'brush' | 'eraser';

interface ImageEditorProps {
  imageFile: File;
  onEditComplete: (editedImageBase64: string) => void;
}

const ImageEditor: React.FC<ImageEditorProps> = ({ imageFile, onEditComplete }) => {
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(40);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [tool, setTool] = useState<Tool>('brush');
  const [isMaskVisible, setIsMaskVisible] = useState(true);
  const history = useRef<ImageData[]>([]);
  const historyIndex = useRef(-1);

  const image = useRef<HTMLImageElement | null>(null);
  
  const resizeCanvases = useCallback(() => {
    if (!image.current || !containerRef.current || !imageCanvasRef.current || !drawingCanvasRef.current) return;
  
    const { naturalWidth, naturalHeight } = image.current;
    if (naturalWidth === 0) return;

    const container = containerRef.current;
    const { width: containerWidth, height: containerHeight } = container.getBoundingClientRect();
  
    const imageAspectRatio = naturalWidth / naturalHeight;
    const containerAspectRatio = containerWidth / containerHeight;
  
    let renderWidth, renderHeight;
  
    if (imageAspectRatio > containerAspectRatio) {
      renderWidth = containerWidth;
      renderHeight = containerWidth / imageAspectRatio;
    } else {
      renderHeight = containerHeight;
      renderWidth = containerHeight * imageAspectRatio;
    }
    
    imageCanvasRef.current.width = renderWidth;
    imageCanvasRef.current.height = renderHeight;
    drawingCanvasRef.current.width = renderWidth;
    drawingCanvasRef.current.height = renderHeight;
  
    const imageCtx = imageCanvasRef.current.getContext('2d');
    if (imageCtx) {
      imageCtx.drawImage(image.current, 0, 0, renderWidth, renderHeight);
    }

    const drawingCtx = drawingCanvasRef.current.getContext('2d');
    const lastMask = history.current[historyIndex.current];
    if (drawingCtx && lastMask) {
      // Create a temporary canvas to draw the mask at its original size
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = lastMask.width;
      tempCanvas.height = lastMask.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.putImageData(lastMask, 0, 0);
        // Now draw the scaled version of the mask onto the visible canvas
        drawingCtx.clearRect(0, 0, renderWidth, renderHeight);
        drawingCtx.drawImage(tempCanvas, 0, 0, renderWidth, renderHeight);
      }
    }
  }, []);
  
  useEffect(() => {
    const imageUrl = URL.createObjectURL(imageFile);
    image.current = new Image();
    image.current.src = imageUrl;
    
    const container = containerRef.current;
    if (!container) return;

    // Use a ResizeObserver to reliably handle canvas resizing when the container changes size.
    // This is more robust than a simple window 'resize' event for responsive layouts.
    const observer = new ResizeObserver(() => {
      if (image.current?.complete && image.current.naturalWidth > 0) {
        resizeCanvases();
      }
    });
    observer.observe(container);

    image.current.onload = () => {
        resizeCanvases();
        saveToHistory(); // Save the initial blank state for the undo history
    };
    
    // Cleanup function to prevent memory leaks
    return () => {
      URL.revokeObjectURL(imageUrl);
      observer.disconnect();
    };
  }, [imageFile, resizeCanvases]);

  const getPointerPos = (canvas: HTMLCanvasElement, evt: React.MouseEvent | React.TouchEvent) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in evt ? evt.touches[0].clientX : evt.clientX;
    const clientY = 'touches' in evt ? evt.touches[0].clientY : evt.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const saveToHistory = () => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    history.current.splice(historyIndex.current + 1);
    history.current.push(imageData);
    historyIndex.current = history.current.length - 1;
  }

  const handleUndo = () => {
    if (historyIndex.current > 0) {
      historyIndex.current--;
      const canvas = drawingCanvasRef.current;
      const ctx = canvas?.getContext('2d');
      const imageData = history.current[historyIndex.current];
      if (canvas && ctx && imageData) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.putImageData(imageData, 0, 0);
      }
    }
  }

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    setIsDrawing(true);
    const { x, y } = getPointerPos(canvas, e);
    
    ctx.globalCompositeOperation = tool === 'brush' ? 'source-over' : 'destination-out';
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getPointerPos(canvas, e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = tool === 'brush' ? 'rgba(255, 0, 255, 0.7)' : 'rgba(0,0,0,1)';
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    const canvas = drawingCanvasRef.current;
    if (!canvas || !isDrawing) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.closePath();
    }
    setIsDrawing(false);
    saveToHistory();
  };

  const clearMask = () => {
    historyIndex.current = 0;
    const imageData = history.current[historyIndex.current];
    const canvas = drawingCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx && imageData) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.putImageData(imageData, 0, 0);
      saveToHistory(); // Save the cleared state
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a description for the edit.');
      return;
    }
    const drawingCanvas = drawingCanvasRef.current;
    if (!drawingCanvas) return;
    
    const drawingCtx = drawingCanvas.getContext('2d');
    if (!drawingCtx) return;
    
    const pixelBuffer = new Uint32Array(drawingCtx.getImageData(0, 0, drawingCanvas.width, drawingCanvas.height).data.buffer);
    if (!pixelBuffer.some(color => color !== 0)) {
        setError("Please draw a mask on the image to indicate the area to be edited.");
        return;
    }

    setError(null);
    setIsLoading(true);

    try {
      if (!image.current) throw new Error("Original image not found");

      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = image.current.naturalWidth;
      maskCanvas.height = image.current.naturalHeight;
      const maskCtx = maskCanvas.getContext('2d');
      if (!maskCtx) throw new Error("Could not create mask context");

      maskCtx.fillStyle = 'black';
      maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
      
      // Draw the current mask (from history) onto the full-resolution mask canvas
      const currentMaskState = history.current[historyIndex.current];
      if (currentMaskState) {
        const tempHistoryCanvas = document.createElement('canvas');
        tempHistoryCanvas.width = currentMaskState.width;
        tempHistoryCanvas.height = currentMaskState.height;
        const tempHistoryCtx = tempHistoryCanvas.getContext('2d');
        if (tempHistoryCtx) {
          tempHistoryCtx.putImageData(currentMaskState, 0, 0);
          maskCtx.drawImage(tempHistoryCanvas, 0, 0, maskCanvas.width, maskCanvas.height);
        }
      }
      
      const imageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 0) { // Check alpha channel of the drawn mask
              data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; // Set to white
          }
      }
      maskCtx.putImageData(imageData, 0, 0);
      const maskBase64 = maskCanvas.toDataURL('image/png');
      
      const originalImageBase64 = await fileToBase64(imageFile);
      const result = await editImageWithMask(originalImageBase64, maskBase64, prompt);
      onEditComplete(result);

    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center gap-4 animate-fade-in">
      <div 
        ref={containerRef}
        className="relative w-full flex-grow flex items-center justify-center touch-none overflow-hidden"
        style={{ minHeight: '200px' }} // Added min-height to ensure container has initial dimensions
      >
        <canvas ref={imageCanvasRef} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg shadow-lg border border-gray-600" />
        <canvas 
          ref={drawingCanvasRef}
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-crosshair transition-opacity ${isMaskVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>

      <div className="w-full max-w-3xl bg-gray-800 p-4 rounded-lg shadow-md border border-gray-700 flex flex-col gap-4">
        {/* Toolbar */}
        <div className="flex items-center gap-4 flex-wrap justify-center sm:justify-between p-2 rounded-md bg-gray-700/50">
           <div className="flex items-center gap-2">
            <button onClick={() => setTool('brush')} className={`p-2 rounded-md transition-colors ${tool === 'brush' ? 'bg-purple-600 text-white' : 'bg-gray-600 hover:bg-gray-500'}`} title="Brush Tool">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
            </button>
            <button onClick={() => setTool('eraser')} className={`p-2 rounded-md transition-colors ${tool === 'eraser' ? 'bg-purple-600 text-white' : 'bg-gray-600 hover:bg-gray-500'}`} title="Eraser Tool">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
            </button>
            <button onClick={handleUndo} disabled={historyIndex.current <= 0} className="p-2 rounded-md bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50" title="Undo">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
            </button>
           </div>
           <div className="flex items-center gap-2 flex-grow sm:flex-grow-0 min-w-[120px]">
            <label htmlFor="brushSize" className="font-medium text-gray-300 text-sm whitespace-nowrap">Size:</label>
            <input id="brushSize" type="range" min="5" max="150" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="flex-grow h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer" />
          </div>
          <div className="flex items-center gap-2">
              <label htmlFor="mask-toggle" className="text-sm text-gray-300">Show Mask</label>
              <button role="switch" aria-checked={isMaskVisible} onClick={() => setIsMaskVisible(!isMaskVisible)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isMaskVisible ? 'bg-purple-600' : 'bg-gray-600'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isMaskVisible ? 'translate-x-6' : 'translate-x-1'}`}/>
              </button>
          </div>
          <button onClick={clearMask} className="px-3 py-2 text-sm bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500">
            Clear Mask
          </button>
        </div>
        {/* Prompt Input */}
        <div className="flex flex-col gap-2">
            <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., 'Change the shirt to a vibrant red color'"
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none transition text-white placeholder-gray-400 resize-none"
                rows={2}
                disabled={isLoading}
            />
            <button
                onClick={handleGenerate}
                disabled={isLoading}
                className="w-full py-3 px-4 flex items-center justify-center bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50"
            >
                {isLoading ? <><Spinner /> <span className="ml-2">Generating...</span></> : 'Generate Image'}
            </button>
        </div>
        {error && <p className="text-red-400 text-sm text-center mt-2">{error}</p>}
      </div>
    </div>
  );
};

export default ImageEditor;