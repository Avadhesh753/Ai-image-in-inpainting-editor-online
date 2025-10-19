import React, { useState, useCallback } from 'react';
import ImageUploader from './components/ImageUploader';
import ImageEditor from './components/ImageEditor';

const App: React.FC = () => {
  const [originalImage, setOriginalImage] = useState<File | null>(null);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState<boolean>(false);

  const handleImageUpload = useCallback((file: File) => {
    setOriginalImage(file);
    setEditedImage(null);
    setShowEditor(true); 
  }, []);

  const handleReset = useCallback(() => {
    setOriginalImage(null);
    setEditedImage(null);
    setShowEditor(false);
  }, []);
  
  const handleBackToEditor = useCallback(() => {
    setEditedImage(null);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
      <header className="sticky top-0 z-50 bg-gray-800/80 backdrop-blur-sm shadow-md border-b border-gray-700">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-8 h-8 text-purple-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15.3895 7.64C15.3895 10.29 13.2895 12.4 10.6495 12.4C8.00951 12.4 5.90951 10.29 5.90951 7.64C5.90951 5 8.00951 2.89 10.6495 2.89C13.2895 2.89 15.3895 5 15.3895 7.64Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path><path d="M19.34 14.7C20.66 16.03 21.12 18.2 20.2 19.89C19.28 21.58 17.22 22.37 15.37 21.79L10.55 20.11L13.11 17.55C14.82 15.84 17.63 13.02 19.34 14.7Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path><path d="M10.55 20.11L4.82996 21.79C2.97996 22.37 0.919957 21.58 0.00995697 19.89C-0.900043 18.2 -0.440043 16.03 0.889957 14.7C2.59996 13.03 5.41996 15.84 7.11996 17.55L10.55 20.11Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path></svg>
            <h1 className="text-xl sm:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
              AI Image Inpainter
            </h1>
          </div>
           {originalImage && (
             <button 
                onClick={handleReset}
                className="px-4 py-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 text-sm"
              >
                New Image
              </button>
           )}
        </div>
      </header>

      <main className="w-full max-w-7xl mx-auto flex-grow flex flex-col items-center justify-center p-4 sm:p-6 md:p-8">
        {!showEditor && !editedImage && (
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-2">Unleash Your Creativity</h2>
            <p className="text-lg text-gray-400 mb-8">
              Upload an image, brush over an area, and describe your desired change.
            </p>
            <ImageUploader onImageUpload={handleImageUpload} />
          </div>
        )}
        
        {showEditor && originalImage && !editedImage && (
          <ImageEditor 
            imageFile={originalImage}
            onEditComplete={setEditedImage} 
          />
        )}
        
        {editedImage && (
          <div className="flex flex-col items-center gap-6 w-full animate-fade-in">
            <h2 className="text-2xl font-bold text-green-400">Image Generated Successfully!</h2>
            <div className="relative border-4 border-purple-500 rounded-lg shadow-lg">
               <img src={editedImage} alt="Edited result" className="max-w-full max-h-[60vh] rounded-md" />
            </div>
            <div className="flex items-center gap-4 mt-4">
              <a 
                href={editedImage} 
                download="edited-image.png"
                className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
              >
                Download Image
              </a>
              <button 
                onClick={handleBackToEditor}
                className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
              >
                Back to Editor
              </button>
              <button 
                onClick={handleReset}
                className="px-6 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50"
              >
                Start Over
              </button>
            </div>
          </div>
        )}
      </main>
      
      <footer className="w-full bg-gray-800/50 border-t border-gray-700 mt-8">
        <div className="w-full max-w-7xl mx-auto text-center p-4 text-gray-500 text-sm">
          <p>&copy; {new Date().getFullYear()} AI Image Inpainter. All Rights Reserved.</p>
          <p className="mt-1">Powered by Google Gemini Nano Banana (gemini-2.5-flash-image)</p>
        </div>
      </footer>
    </div>
  );
};

export default App;