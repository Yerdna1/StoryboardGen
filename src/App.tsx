import React, { useEffect, useState } from 'react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { SetupScreen } from './components/SetupScreen';
import { MainCanvas } from './components/MainCanvas';
import './App.css';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#3b82f6',
    },
    secondary: {
      main: '#8b5cf6',
    },
    background: {
      default: '#0a0a0a',
      paper: '#1a1a1a',
    },
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
  },
});

function App() {
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);
  const [setupInfo, setSetupInfo] = useState<any>(null);

  useEffect(() => {
    // Check if initial setup is complete
    if (window.electronAPI) {
      checkSetup();
    }
  }, []);

  const checkSetup = async () => {
    if (!window.electronAPI) return;

    // Check if setup is complete and if we should show setup on startup
    const [setupResult, showSetupOnStartup] = await Promise.all([
      window.electronAPI.checkSetup(),
      window.electronAPI.getShowSetupOnStartup()
    ]);

    setSetupInfo(setupResult);

    // Show setup screen if setup is not complete, or if user has chosen to always show it
    setIsSetupComplete(setupResult.isSetupComplete && !showSetupOnStartup);
  };

  const handleSetupComplete = () => {
    setIsSetupComplete(true);
  };

  const handleOpenSettings = () => {
    setIsSetupComplete(false);
  };

  if (isSetupComplete === null) {
    return (
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <div className="app-loading">
          <div className="loading-spinner"></div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <div className="App">
        {!isSetupComplete ? (
          <SetupScreen onComplete={handleSetupComplete} />
        ) : (
          <MainCanvas onOpenSettings={handleOpenSettings} />
        )}
      </div>
    </ThemeProvider>
  );
}

export default App;