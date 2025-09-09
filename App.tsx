/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import { generateEditedImage, generateFilteredImage, generateAdjustedImage } from './services/geminiService';
import Header from './components/Header';
import Spinner from './components/Spinner';
import FilterPanel from './components/FilterPanel';
import AdjustmentPanel from './components/AdjustmentPanel';
import CropPanel from './components/CropPanel';
import TemplatePanel from './components/TemplatePanel';
import { UndoIcon, RedoIcon, EyeIcon } from './components/icons';
import StartScreen from './components/StartScreen';

// Helper to convert a data URL string to a File object
const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");

    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
}

type Tab = 'retouch' | 'adjust' | 'filters' | 'crop' | 'templates';
type ExportQuality = 'low' | 'medium' | 'high';

const TABS: { key: Tab, label: string }[] = [
    { key: 'retouch', label: 'Retouch' },
    { key: 'crop', label: 'Crop' },
    { key: 'adjust', label: 'Adjust' },
    { key: 'filters', label: 'Filters' },
    { key: 'templates', label: 'Story Maker' }
];

const App: React.FC = () => {
  const [history, setHistory] = useState<File[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [editHotspot, setEditHotspot] = useState<{ x: number, y: number } | null>(null);
  const [displayHotspot, setDisplayHotspot] = useState<{ x: number, y: number } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('retouch');
  
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [aspect, setAspect] = useState<number | undefined>();
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [exportQuality, setExportQuality] = useState<ExportQuality>('high');
  const imgRef = useRef<HTMLImageElement>(null);

  const currentImage = history[historyIndex] ?? null;
  const originalImage = history[0] ?? null;

  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);

  // Effect to create and revoke object URLs safely for the current image
  useEffect(() => {
    if (currentImage) {
      const url = URL.createObjectURL(currentImage);
      setCurrentImageUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setCurrentImageUrl(null);
    }
  }, [currentImage]);
  
  // Effect to create and revoke object URLs safely for the original image
  useEffect(() => {
    if (originalImage) {
      const url = URL.createObjectURL(originalImage);
      setOriginalImageUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setOriginalImageUrl(null);
    }
  }, [originalImage]);


  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const addImageToHistory = useCallback((newImageFile: File) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newImageFile);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    // Reset transient states after an action
    setCrop(undefined);
    setCompletedCrop(undefined);
  }, [history, historyIndex]);

  const handleImageUpload = useCallback((file: File) => {
    setError(null);
    setHistory([file]);
    setHistoryIndex(0);
    setEditHotspot(null);
    setDisplayHotspot(null);
    setActiveTab('retouch');
    setCrop(undefined);
    setCompletedCrop(undefined);
  }, []);

  const handleApiError = (err: unknown, context: string) => {
    const rawErrorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
    let displayErrorMessage = `Failed to ${context}. ${rawErrorMessage}`;

    if (rawErrorMessage.includes('429') || rawErrorMessage.includes('RESOURCE_EXHAUSTED') || rawErrorMessage.includes('quota')) {
        displayErrorMessage = "It looks like the AI is a bit busy right now (quota exceeded). Please wait a few moments and try your edit again.";
    }

    setError(displayErrorMessage);
    console.error(`Error during ${context}:`, err);
  };

  const handleDemoImageSelect = useCallback(async (url: string) => {
      setIsLoading(true);
      setError(null);
      try {
          const response = await fetch(url);
          if (!response.ok) {
              throw new Error(`Network response was not ok: ${response.statusText}`);
          }
          const blob = await response.blob();
          const file = new File([blob], "demo-image.jpg", { type: blob.type || 'image/jpeg' });
          handleImageUpload(file);
      } catch (err) {
          handleApiError(err, 'load the demo image');
      } finally {
          setIsLoading(false);
      }
  }, [handleImageUpload]);

  const handleGenerate = useCallback(async () => {
    if (!currentImage) {
      setError('No image loaded to edit.');
      return;
    }
    
    if (!prompt.trim()) {
        setError('Please enter a description for your edit.');
        return;
    }

    if (!editHotspot) {
        setError('Please click on the image to select an area to edit.');
        return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
        const editedImageUrl = await generateEditedImage(currentImage, prompt, editHotspot);
        const newImageFile = dataURLtoFile(editedImageUrl, `edited-${Date.now()}.png`);
        addImageToHistory(newImageFile);
        setEditHotspot(null);
        setDisplayHotspot(null);
    } catch (err) {
        handleApiError(err, 'generate the image');
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, prompt, editHotspot, addImageToHistory]);
  
  const handleApplyFilter = useCallback(async (filterPrompt: string) => {
    if (!currentImage) {
      setError('No image loaded to apply a filter to.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
        const filteredImageUrl = await generateFilteredImage(currentImage, filterPrompt);
        const newImageFile = dataURLtoFile(filteredImageUrl, `filtered-${Date.now()}.png`);
        addImageToHistory(newImageFile);
    } catch (err) {
        handleApiError(err, 'apply the filter');
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);
  
  const handleApplyAdjustment = useCallback(async (adjustmentPrompt: string) => {
    if (!currentImage) {
      setError('No image loaded to apply an adjustment to.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
        const adjustedImageUrl = await generateAdjustedImage(currentImage, adjustmentPrompt);
        const newImageFile = dataURLtoFile(adjustedImageUrl, `adjusted-${Date.now()}.png`);
        addImageToHistory(newImageFile);
    } catch (err) {
        handleApiError(err, 'apply the adjustment');
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);

  const handleApplyCrop = useCallback(() => {
    if (!completedCrop || !imgRef.current) {
        setError('Please select an area to crop.');
        return;
    }

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        setError('Could not process the crop.');
        return;
    }

    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = completedCrop.width * pixelRatio;
    canvas.height = completedCrop.height * pixelRatio;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width,
      completedCrop.height,
    );
    
    const croppedImageUrl = canvas.toDataURL('image/png');
    const newImageFile = dataURLtoFile(croppedImageUrl, `cropped-${Date.now()}.png`);
    addImageToHistory(newImageFile);

  }, [completedCrop, addImageToHistory]);

  const handleUndo = useCallback(() => {
    if (canUndo) {
      setHistoryIndex(historyIndex - 1);
      setEditHotspot(null);
      setDisplayHotspot(null);
    }
  }, [canUndo, historyIndex]);
  
  const handleRedo = useCallback(() => {
    if (canRedo) {
      setHistoryIndex(historyIndex + 1);
      setEditHotspot(null);
      setDisplayHotspot(null);
    }
  }, [canRedo, historyIndex]);

  const handleReset = useCallback(() => {
    if (history.length > 0) {
      setHistoryIndex(0);
      setError(null);
      setEditHotspot(null);
      setDisplayHotspot(null);
    }
  }, [history]);

  const handleUploadNew = useCallback(() => {
      setHistory([]);
      setHistoryIndex(-1);
      setError(null);
      setPrompt('');
      setEditHotspot(null);
      setDisplayHotspot(null);
  }, []);

  const handleDownload = useCallback(() => {
    if (!currentImage) return;

    const qualityMap: Record<ExportQuality, number> = {
      low: 0.5,
      medium: 0.75,
      high: 0.92,
    };
    const jpegQuality = qualityMap[exportQuality];

    const image = new Image();
    const imageUrl = URL.createObjectURL(currentImage);
    image.src = imageUrl;

    image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error('Could not get canvas context');
            URL.revokeObjectURL(imageUrl);
            setError('Could not prepare image for download.');
            return;
        }

        ctx.drawImage(image, 0, 0);

        const dataUrl = canvas.toDataURL('image/jpeg', jpegQuality);

        const link = document.createElement('a');
        link.href = dataUrl;
        
        const originalName = currentImage.name.substring(0, currentImage.name.lastIndexOf('.')) || `edited-${Date.now()}`;
        link.download = `${originalName}-quality-${exportQuality}.jpeg`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(imageUrl);
    };

    image.onerror = () => {
        console.error('Failed to load image for download');
        URL.revokeObjectURL(imageUrl);
        setError('Could not prepare image for download.');
    };

  }, [currentImage, exportQuality]);
  
  const handleFileSelect = (files: FileList | null) => {
    if (files && files[0]) {
      handleImageUpload(files[0]);
    }
  };

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (activeTab !== 'retouch') return;
    
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();

    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    
    setDisplayHotspot({ x: offsetX, y: offsetY });

    const { naturalWidth, naturalHeight, clientWidth, clientHeight } = img;
    const scaleX = naturalWidth / clientWidth;
    const scaleY = naturalHeight / clientHeight;

    const originalX = Math.round(offsetX * scaleX);
    const originalY = Math.round(offsetY * scaleY);

    setEditHotspot({ x: originalX, y: originalY });
};

  const renderContent = () => {
    if (isLoading && !currentImageUrl) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 animate-fade-in">
          <Spinner />
          <p className="text-gray-300">Loading demo image...</p>
        </div>
      );
    }
    
    if (error) {
       return (
           <div className="text-center animate-fade-in bg-red-500/10 border border-red-500/20 p-8 rounded-lg max-w-2xl mx-auto flex flex-col items-center gap-4">
            <h2 className="text-2xl font-bold text-red-300">An Error Occurred</h2>
            <p className="text-md text-red-400">{error}</p>
            <button
                onClick={() => setError(null)}
                className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded-lg text-md transition-colors"
              >
                Try Again
            </button>
          </div>
        );
    }
    
    if (!currentImageUrl) {
      return <StartScreen onFileSelect={handleFileSelect} onDemoImageSelect={handleDemoImageSelect} />;
    }

    const imageDisplay = (
      <div className="relative">
        {/* Base image is the original, always at the bottom */}
        {originalImageUrl && (
            <img
                key={originalImageUrl}
                src={originalImageUrl}
                alt="Original"
                className="w-full h-auto object-contain max-h-[75vh] rounded-xl pointer-events-none"
            />
        )}
        {/* The current image is an overlay that fades in/out for comparison */}
        <img
            ref={imgRef}
            key={currentImageUrl}
            src={currentImageUrl}
            alt="Current"
            onClick={handleImageClick}
            className={`absolute top-0 left-0 w-full h-auto object-contain max-h-[75vh] rounded-xl transition-opacity duration-200 ease-in-out ${isComparing ? 'opacity-0' : 'opacity-100'} ${activeTab === 'retouch' ? 'cursor-crosshair' : ''}`}
        />
      </div>
    );
    
    // For ReactCrop, we need a single image element. We'll use the current one.
    const cropImageElement = (
      <img 
        ref={imgRef}
        key={`crop-${currentImageUrl}`}
        src={currentImageUrl} 
        alt="Crop this image"
        className="w-full h-auto object-contain max-h-[75vh] rounded-xl"
      />
    );


    return (
      <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row items-start gap-8 animate-fade-in">
        {/* LEFT COLUMN - IMAGE */}
        <div className="w-full lg:w-[60%] xl:w-2/3 lg:sticky lg:top-28">
          <div className="relative w-full shadow-2xl rounded-xl overflow-hidden bg-black/20">
              {isLoading && (
                  <div className="absolute inset-0 bg-black/70 z-30 flex flex-col items-center justify-center gap-4 animate-fade-in">
                      <Spinner />
                      <p className="text-gray-300">AI is working its magic...</p>
                  </div>
              )}
              
              {activeTab === 'crop' ? (
                <ReactCrop 
                  crop={crop} 
                  onChange={c => setCrop(c)} 
                  onComplete={c => setCompletedCrop(c)}
                  aspect={aspect}
                  className="max-h-[75vh]"
                >
                  {cropImageElement}
                </ReactCrop>
              ) : imageDisplay }

              {displayHotspot && !isLoading && activeTab === 'retouch' && (
                  <div 
                      className="absolute rounded-full w-6 h-6 bg-blue-500/50 border-2 border-white pointer-events-none -translate-x-1/2 -translate-y-1/2 z-10"
                      style={{ left: `${displayHotspot.x}px`, top: `${displayHotspot.y}px` }}
                  >
                      <div className="absolute inset-0 rounded-full w-6 h-6 animate-ping bg-blue-400"></div>
                  </div>
              )}
          </div>
        </div>

        {/* RIGHT COLUMN - CONTROLS */}
        <div className="w-full lg:w-[40%] xl:w-1/3 flex flex-col gap-4">
          <div className="w-full bg-gray-800/80 border border-gray-700/80 rounded-lg p-1.5 grid grid-cols-3 sm:grid-cols-5 items-center justify-center gap-1.5 backdrop-blur-sm">
              {TABS.map(({ key, label }) => (
                   <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      className={`w-full font-semibold py-2.5 px-2 rounded-md transition-all duration-200 text-sm md:text-base ${
                          activeTab === key 
                          ? 'bg-gradient-to-br from-blue-500 to-cyan-400 text-white shadow-lg shadow-cyan-500/40' 
                          : 'text-gray-300 hover:text-white hover:bg-white/10'
                      }`}
                  >
                      {label}
                  </button>
              ))}
          </div>
          
          <div className="w-full">
              {activeTab === 'retouch' && (
                  <div className="flex flex-col items-center gap-4">
                      <p className="text-md text-gray-400 text-center">
                          {editHotspot ? 'Great! Now describe your localized edit below.' : 'Click an area on the image to make a precise edit.'}
                      </p>
                      <form onSubmit={(e) => { e.preventDefault(); handleGenerate(); }} className="w-full flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <input
                              type="text"
                              value={prompt}
                              onChange={(e) => setPrompt(e.target.value)}
                              placeholder={editHotspot ? "e.g., 'change shirt to blue'" : "First click a point on the image"}
                              className="flex-grow bg-gray-800 border border-gray-700 text-gray-200 rounded-lg p-4 text-base focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={isLoading || !editHotspot}
                          />
                          <button 
                              type="submit"
                              className="w-full sm:w-auto bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-4 px-6 text-base rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
                              disabled={isLoading || !prompt.trim() || !editHotspot}
                          >
                              Generate
                          </button>
                      </form>
                  </div>
              )}
              {activeTab === 'crop' && <CropPanel onApplyCrop={handleApplyCrop} onSetAspect={setAspect} isLoading={isLoading} isCropping={!!completedCrop?.width && completedCrop.width > 0} />}
              {activeTab === 'adjust' && <AdjustmentPanel onApplyAdjustment={handleApplyAdjustment} isLoading={isLoading} />}
              {activeTab === 'filters' && <FilterPanel onApplyFilter={handleApplyFilter} isLoading={isLoading} />}
              {activeTab === 'templates' && <TemplatePanel onApplyAdjustment={handleApplyAdjustment} isLoading={isLoading} />}
          </div>
        
          <div className="w-full flex flex-col gap-3 mt-4">
              <div className="grid grid-cols-2 gap-3">
                  <button 
                      onClick={handleUndo}
                      disabled={!canUndo}
                      className="w-full flex items-center justify-center text-center bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-white/5"
                      aria-label="Undo last action"
                  >
                      <UndoIcon className="w-5 h-5 mr-2" />
                      Undo
                  </button>
                  <button 
                      onClick={handleRedo}
                      disabled={!canRedo}
                      className="w-full flex items-center justify-center text-center bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-white/5"
                      aria-label="Redo last action"
                  >
                      <RedoIcon className="w-5 h-5 mr-2" />
                      Redo
                  </button>
              </div>

              <div className={`grid ${canUndo ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
                {canUndo && (
                  <button 
                      onMouseDown={() => setIsComparing(true)}
                      onMouseUp={() => setIsComparing(false)}
                      onMouseLeave={() => setIsComparing(false)}
                      onTouchStart={() => setIsComparing(true)}
                      onTouchEnd={() => setIsComparing(false)}
                      className="w-full flex items-center justify-center text-center bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base"
                      aria-label="Press and hold to see original image"
                  >
                      <EyeIcon className="w-5 h-5 mr-2" />
                      Compare
                  </button>
                )}
                <button 
                    onClick={handleReset}
                    disabled={!canUndo}
                    className="w-full text-center bg-transparent border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/10 hover:border-white/30 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Reset
                </button>
              </div>

              <button 
                  onClick={handleUploadNew}
                  className="w-full text-center bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base"
              >
                  Upload New
              </button>

              <div className="border-t border-gray-700/60 my-2"></div>

              <div className="flex flex-col gap-3 p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                  <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-400 pl-1 select-none">Export Quality:</span>
                      <div className="flex items-center bg-gray-800 rounded-lg p-0.5 border border-gray-600">
                        {(['low', 'medium', 'high'] as ExportQuality[]).map(q => (
                            <button
                                key={q}
                                onClick={() => setExportQuality(q)}
                                className={`capitalize text-xs sm:text-sm font-semibold py-1 px-2.5 rounded-md transition-all duration-200 ${
                                    exportQuality === q
                                    ? 'bg-green-600 text-white shadow-md shadow-green-500/20'
                                    : 'text-gray-300 hover:bg-white/20'
                                }`}
                            >
                                {q}
                            </button>
                        ))}
                      </div>
                  </div>
                  <button 
                      onClick={handleDownload}
                      disabled={isLoading}
                      className="w-full bg-gradient-to-br from-green-600 to-green-500 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-green-800 disabled:to-green-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
                  >
                      Download
                  </button>
              </div>
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="min-h-screen text-gray-100 flex flex-col">
      <Header />
      <main className={`flex-grow w-full max-w-full mx-auto p-4 md:p-8 flex justify-center ${currentImage ? 'items-start' : 'items-center'}`}>
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
