import React from 'react';
import { AppProvider } from '@shopify/polaris';
import '@shopify/polaris/build/esm/styles.css';
import { VideoList } from './components/VideoList';
import { VideoEditor } from './components/VideoEditor';

// Simple routing based on URL
function App() {
  const path = window.location.pathname;

  if (path.includes('/videos/') && path !== '/admin/videos') {
    const videoId = path.split('/').pop();
    return (
      <AppProvider>
        <VideoEditor videoId={videoId} />
      </AppProvider>
    );
  }

  return (
    <AppProvider>
      <VideoList />
    </AppProvider>
  );
}

export default App;
