import React from 'react';
import { enableMockUploader, disableMockUploader } from '@/lib/nativeUploader';

export const DevTools = () => {
  const [showDevTools, setShowDevTools] = React.useState(
    localStorage.getItem('showDevTools') === 'true'
  );

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Press Shift + D + V to toggle dev tools
      if (e.shiftKey && e.key === 'D') {
        const nextKey = (event: KeyboardEvent) => {
          if (event.key === 'V') {
            setShowDevTools(prev => {
              const newValue = !prev;
              localStorage.setItem('showDevTools', newValue.toString());
              return newValue;
            });
            document.removeEventListener('keydown', nextKey);
          }
        };
        document.addEventListener('keydown', nextKey);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!showDevTools) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-card border rounded-lg p-4 shadow-lg z-50">
      <h3 className="font-bold mb-2">🔧 Dev Tools</h3>
      <div className="space-y-2">
        <button
          onClick={enableMockUploader}
          className="block w-full text-left px-2 py-1 bg-green-600 text-white rounded text-sm"
        >
          📷 Enable Mock Photo Uploader
        </button>
        <button
          onClick={disableMockUploader}
          className="block w-full text-left px-2 py-1 bg-red-600 text-white rounded text-sm"
        >
          ❌ Disable Mock Uploader
        </button>
        <div className="text-xs text-muted-foreground mt-2">
          Native Available: {(window as any).NativeUploaderAvailable ? '✅' : '❌'}
        </div>
        <div className="text-xs text-muted-foreground">
          Press Shift+D+V to toggle
        </div>
      </div>
    </div>
  );
};