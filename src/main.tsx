import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initializeNativeUploader } from './lib/nativeUploader'

// Initialize native uploader
initializeNativeUploader();

createRoot(document.getElementById("root")!).render(<App />);
