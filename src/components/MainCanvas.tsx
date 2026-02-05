import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Rect, Image as KonvaImage, Text, Group } from 'react-konva';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Button,
  Fab,
  Tooltip,
  CircularProgress,
  LinearProgress,
  Paper,
  Stack,
  Chip,
  Alert,
  AlertTitle,
  Grid
} from '@mui/material';
import {
  Menu as MenuIcon,
  CloudUpload as UploadIcon,
  PlayArrow as GenerateIcon,
  Settings as SettingsIcon,
  Save as SaveIcon,
  FolderOpen as LoadIcon,
  Download as DownloadIcon,
  CheckCircle as CompletedIcon,
  Error as ErrorIcon,
  Schedule as PendingIcon,
  Cached as GeneratingIcon
} from '@mui/icons-material';
import { PromptsPanel } from './PromptsPanel';
import { GenerationDialog } from './GenerationDialog';
import { StoryboardGrid } from './StoryboardGrid';
import { GenerationProgress, PanelStatus } from '../global.d';

interface MainCanvasProps {
  onOpenSettings?: () => void;
}

export function MainCanvas({ onOpenSettings }: MainCanvasProps) {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [selectedPrompt, setSelectedPrompt] = useState<any>(null);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null);
  const [generatedPanels, setGeneratedPanels] = useState<any[]>([]);
  const [showGenerationDialog, setShowGenerationDialog] = useState(false);
  const [downloadingReference, setDownloadingReference] = useState(false);

  const stageRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!window.electronAPI) return;
    // Load default prompt on mount
    loadDefaultPrompt();

    // Setup progress listener with enhanced typing
    window.electronAPI.onGenerationProgress((progress: GenerationProgress) => {
      setGenerationProgress(progress);

      if (progress.status === 'completed') {
        setGeneratedPanels(progress.result?.panels || []);
        setIsGenerating(false);
      } else if (progress.status === 'error') {
        setIsGenerating(false);
      }
    });

    return () => {
      if (window.electronAPI) {
        window.electronAPI.removeAllListeners('generation-progress');
      }
    };
  }, []);

  const loadDefaultPrompt = async () => {
    if (!window.electronAPI) return;
    const prompt = await window.electronAPI.getPrompt('default-20-panel');
    setSelectedPrompt(prompt);
  };

  const handleImageUpload = async () => {
    if (!window.electronAPI) return;
    const imageDataUrl = await window.electronAPI.selectImage();
    if (imageDataUrl) {
      // The data URL is already prepared by the main process
      setReferenceImage(imageDataUrl);
    }
  };

  const handleGenerate = () => {
    if (!referenceImage || !selectedPrompt) {
      return;
    }
    setShowGenerationDialog(true);
  };

  const startGeneration = async (settings: any) => {
    if (!window.electronAPI || !referenceImage) return;
    setShowGenerationDialog(false);
    setIsGenerating(true);
    setGenerationProgress(null);
    setGeneratedPanels([]);

    try {
      const result = await window.electronAPI.generateStoryboard(
        referenceImage,
        selectedPrompt.content,
        settings
      );

      // Set the generated panels to display in grid
      if (result && result.panels) {
        setGeneratedPanels(result.panels);
      }

      setIsGenerating(false);

      // Show success message
      setGenerationProgress({
        status: 'completed',
        progress: 100,
        message: `✓ Successfully generated ${result.panels?.length || 0} storyboard panels!`,
        currentPanel: result.panels?.length || 0,
        totalPanels: result.panels?.length || 0,
        panels: result.panels || [],
        eta: 'Complete',
        stage: 'completed',
        title: 'Generation Complete',
        stats: result.metadata?.stats
      });
    } catch (error) {
      console.error('Generation error:', error);
      setIsGenerating(false);
      setGenerationProgress({
        status: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : 'Failed to generate storyboard',
        currentPanel: 0,
        totalPanels: 0,
        panels: [],
        eta: 'Unknown',
        stage: 'error',
        title: 'Generation Failed'
      });
    }
  };

  // Helper component for displaying panel status
  const PanelStatusDisplay = ({ panel, isCurrent }: { panel: PanelStatus; isCurrent: boolean }) => {
    const getStatusColor = () => {
      if (panel.status === 'completed') return 'success';
      if (panel.status === 'error') return 'error';
      if (panel.status === 'generating') return 'info';
      return 'default';
    };

    const getStatusIcon = () => {
      if (panel.status === 'completed') return <CompletedIcon fontSize="small" />;
      if (panel.status === 'error') return <ErrorIcon fontSize="small" />;
      if (panel.status === 'generating') return <GeneratingIcon fontSize="small" />;
      return <PendingIcon fontSize="small" />;
    };

    return (
      <Chip
        icon={getStatusIcon()}
        label={`Panel ${panel.number}`}
        color={getStatusColor() as any}
        size="small"
        variant={isCurrent ? 'filled' : 'outlined'}
        sx={{ opacity: panel.status === 'pending' ? 0.5 : 1 }}
      />
    );
  };

  const renderProgressInfo = () => {
    if (!generationProgress) return null;

    const { progress, message, currentPanel, totalPanels, eta, stats, panels } = generationProgress;

    return (
      <Box sx={{ width: '100%', maxWidth: 600 }}>
        {/* Main progress bar */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {message}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ height: 8, borderRadius: 1 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {progress}% complete
          </Typography>
        </Box>

        {/* Detailed stats */}
        {stats && (
          <Grid container spacing={1} sx={{ mb: 2 }}>
            <Grid item xs={6}>
              <Paper variant="outlined" sx={{ p: 1, textAlign: 'center' }}>
                <Typography variant="h6" color="primary.main">
                  {currentPanel}/{totalPanels}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Current Panel
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={6}>
              <Paper variant="outlined" sx={{ p: 1, textAlign: 'center' }}>
                <Typography variant="h6" color="success.main">
                  {stats.completed}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Completed
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        )}

        {/* Panel status overview */}
        {panels && panels.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Panel Status:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
              {panels.map((panel) => (
                <PanelStatusDisplay
                  key={panel.number}
                  panel={panel}
                  isCurrent={panel.number === currentPanel}
                />
              ))}
            </Box>
          </Box>
        )}

        {/* Error information */}
        {generationProgress.title && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <AlertTitle>{generationProgress.title}</AlertTitle>
            {generationProgress.message}
            {generationProgress.recovery && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2" component="div">
                  <strong>How to fix:</strong>
                  <Box component="pre" sx={{
                    whiteSpace: 'pre-wrap',
                    fontSize: '0.875rem',
                    mt: 0.5,
                    p: 1,
                    bgcolor: 'rgba(0,0,0,0.1)',
                    borderRadius: 1
                  }}>
                    {generationProgress.recovery}
                  </Box>
                </Typography>
              </Box>
            )}
          </Alert>
        )}
        {!generationProgress.title && generationProgress.errorMessage && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {generationProgress.errorMessage}
          </Alert>
        )}

        {/* Retry information */}
        {generationProgress.retryAttempt && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Retry attempt {generationProgress.retryAttempt} of {generationProgress.maxRetries}
          </Alert>
        )}

        {/* ETA and additional info */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            ETA: {eta}
          </Typography>
          {generationProgress.provider && (
            <Chip
              label={generationProgress.provider}
              size="small"
              variant="outlined"
            />
          )}
        </Box>

        {/* Stage indicator */}
        {generationProgress.subStage && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Stage: {generationProgress.subStage}
          </Typography>
        )}
      </Box>
    );
  };

  const handleDownloadReference = async () => {
    if (!window.electronAPI || !referenceImage) return;

    setDownloadingReference(true);

    try {
      const result = await window.electronAPI.downloadReferenceImage(referenceImage, 'downloads');

      if (result.success) {
        console.log('Reference image downloaded:', result.filePath);
        // You could add a notification here if needed
      } else {
        console.error('Failed to download reference:', result.message);
      }
    } catch (error) {
      console.error('Error downloading reference image:', error);
    } finally {
      setDownloadingReference(false);
    }
  };

  const drawerWidth = 300;

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backgroundColor: 'background.paper',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}
      >
        <Toolbar sx={{ WebkitAppRegion: 'drag' }}>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setDrawerOpen(!drawerOpen)}
            sx={{ mr: 2, WebkitAppRegion: 'no-drag' }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            StoryboardGen
          </Typography>

          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            onClick={handleImageUpload}
            sx={{ mr: 2, WebkitAppRegion: 'no-drag' }}
            disabled={isGenerating}
          >
            {referenceImage ? 'Change Image' : 'Upload Reference'}
          </Button>

          <Button
            variant="contained"
            startIcon={<GenerateIcon />}
            onClick={handleGenerate}
            sx={{ WebkitAppRegion: 'no-drag' }}
            disabled={!referenceImage || !selectedPrompt || isGenerating}
          >
            Generate Storyboard
          </Button>

          <Tooltip title="Settings">
            <IconButton
              color="inherit"
              sx={{ ml: 2, WebkitAppRegion: 'no-drag' }}
              onClick={onOpenSettings}
            >
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
        {isGenerating && generationProgress && (
          <LinearProgress
            variant="determinate"
            value={generationProgress.progress}
            sx={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
          />
        )}
      </AppBar>

      <Drawer
        variant="persistent"
        anchor="left"
        open={drawerOpen}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            backgroundColor: 'background.paper',
            borderRight: '1px solid rgba(255,255,255,0.1)',
            mt: 8
          },
        }}
      >
        <PromptsPanel
          selectedPrompt={selectedPrompt}
          onSelectPrompt={setSelectedPrompt}
        />
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          ml: drawerOpen ? 0 : `-${drawerWidth}px`,
          transition: 'margin-left 0.3s',
          mt: 8,
          height: 'calc(100vh - 64px)',
          overflow: 'auto',
          bgcolor: 'background.default'
        }}
        className="canvas-background"
      >
        {!referenceImage && !generatedPanels.length && (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column'
            }}
          >
            <UploadIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h5" color="text.secondary" gutterBottom>
              Upload a Reference Image
            </Typography>
            <Typography variant="body1" color="text.secondary" align="center" sx={{ maxWidth: 600 }}>
              Start by uploading an image that will serve as the visual reference for your storyboard.
              The AI will maintain the style, colors, and elements from this image throughout all panels.
            </Typography>
            <Button
              variant="contained"
              startIcon={<UploadIcon />}
              onClick={handleImageUpload}
              sx={{ mt: 3 }}
              size="large"
            >
              Upload Reference Image
            </Button>
          </Box>
        )}

        {referenceImage && !isGenerating && generatedPanels.length === 0 && (
          <Box sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
              <Typography variant="h6">
                Reference Image
              </Typography>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadReference}
                disabled={downloadingReference}
              >
                {downloadingReference ? 'Downloading...' : 'Download'}
              </Button>
            </Stack>
            <Paper sx={{ p: 2, mb: 3, display: 'inline-block' }}>
              <img
                src={referenceImage}
                alt="Reference"
                style={{ maxWidth: '100%', maxHeight: 400, display: 'block' }}
              />
            </Paper>
            <Box>
              <Typography variant="body1" color="text.secondary" gutterBottom>
                Your reference image is ready. Click "Generate Storyboard" to create a 20-panel cinematic narrative.
              </Typography>
            </Box>
          </Box>
        )}

        {isGenerating && (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column'
            }}
          >
            <Box sx={{ position: 'relative', mb: 3 }}>
              <CircularProgress size={80} />
              {generationProgress && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    right: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Typography variant="h6" color="text.primary">
                    {generationProgress.progress}%
                  </Typography>
                </Box>
              )}
            </Box>
            <Typography variant="h6" gutterBottom>
              Generating Storyboard
            </Typography>
            {renderProgressInfo()}
          </Box>
        )}

        {!isGenerating && generatedPanels.length > 0 && (
          <StoryboardGrid
            panels={generatedPanels}
            referenceImage={referenceImage}
          />
        )}
      </Box>

      <GenerationDialog
        open={showGenerationDialog}
        onClose={() => setShowGenerationDialog(false)}
        onGenerate={startGeneration}
      />
    </Box>
  );
}