import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  IconButton,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Button,
  Stack,
  Tooltip,
  Snackbar,
  Alert,
  LinearProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField
} from '@mui/material';
import {
  Download as DownloadIcon,
  MovieCreation as ExportIcon,
  ViewModule as GridIcon,
  VideoSettings as SettingsIcon
} from '@mui/icons-material';

interface StoryboardGridProps {
  panels: any[];
  referenceImage: string | null;
}

export function StoryboardGrid({ panels, referenceImage }: StoryboardGridProps) {
  const [selectedPanel, setSelectedPanel] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'sequential'>('grid');
  const [downloadingPanel, setDownloadingPanel] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadingReference, setDownloadingReference] = useState(false);
  const [exportingVideo, setExportingVideo] = useState(false);
  const [videoExportProgress, setVideoExportProgress] = useState(0);
  const [showVideoExportDialog, setShowVideoExportDialog] = useState(false);
  const [ffmpegAvailable, setFfmpegAvailable] = useState(true);
  const [videoExportOptions, setVideoExportOptions] = useState({
    format: 'mp4' as 'mp4' | 'webm',
    frameDuration: 3,
    transitionDuration: 0.5,
    fps: 30,
    quality: 'medium' as 'low' | 'medium' | 'high'
  });
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  useEffect(() => {
    if (window.electronAPI) {
      // Setup download progress listener
      window.electronAPI.onDownloadProgress((progress: any) => {
        setDownloadProgress(progress.progress);
      });

      // Setup video export progress listener
      window.electronAPI.onVideoExportProgress((progress: any) => {
        setVideoExportProgress(progress.percent);
      });

      // Check FFmpeg availability
      const checkFFmpeg = async () => {
        if (window.electronAPI) {
          const result = await window.electronAPI.checkFFmpeg();
          setFfmpegAvailable(result.isAvailable);
        }
      };
      checkFFmpeg();

      return () => {
        if (window.electronAPI) {
          window.electronAPI.removeAllListeners('download-progress');
          window.electronAPI.removeAllListeners('video-export-progress');
        }
      };
    }
  }, []);

  const showNotification = (message: string, severity: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ open: true, message, severity });
  };

  const handleExportVideo = async () => {
    if (!window.electronAPI || panels.length === 0) return;

    if (!ffmpegAvailable) {
      showNotification(
        'FFmpeg is not available. Please install FFmpeg to export videos.',
        'error'
      );
      return;
    }

    setShowVideoExportDialog(true);
  };

  const startVideoExport = async () => {
    if (!window.electronAPI || panels.length === 0) return;

    setShowVideoExportDialog(false);
    setExportingVideo(true);
    setVideoExportProgress(0);

    try {
      const result = await window.electronAPI.exportVideo(panels, videoExportOptions);

      if (result.success) {
        showNotification(`Video exported successfully to ${result.filename}`, 'success');
      } else {
        showNotification(`Failed to export video: ${result.message}`, 'error');
      }
    } catch (error) {
      console.error('Error exporting video:', error);
      showNotification('Failed to export video', 'error');
    } finally {
      setExportingVideo(false);
      setVideoExportProgress(0);
    }
  };

  const handleDownloadAll = async () => {
    if (!window.electronAPI || panels.length === 0) return;

    setDownloadingAll(true);
    setDownloadProgress(0);

    try {
      // Prepare images for download
      const images = panels.map((panel, index) => ({
        dataUrl: panel.url,
        filename: `panel-${String(index + 1).padStart(2, '0')}`
      }));

      // Create timestamp for zip filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const zipFilename = `storyboard-${timestamp}`;

      const result = await window.electronAPI.downloadAllPanels(images, zipFilename, 'downloads');

      if (result.success) {
        showNotification(`Successfully downloaded ${result.imageCount} panels as ZIP`, 'success');
      } else {
        showNotification(`Failed to download panels: ${result.message}`, 'error');
      }
    } catch (error) {
      console.error('Error downloading all panels:', error);
      showNotification('Failed to download panels', 'error');
    } finally {
      setDownloadingAll(false);
      setDownloadProgress(0);
    }
  };

  const handleDownloadPanel = async (panel: any) => {
    if (!window.electronAPI) return;

    setDownloadingPanel(panel.id);

    try {
      const panelIndex = panels.findIndex(p => p.id === panel.id);
      const filename = `storyboard-panel-${String(panelIndex + 1).padStart(2, '0')}`;

      const result = await window.electronAPI.downloadImage(panel.url, filename, 'downloads');

      if (result.success) {
        showNotification(`Panel downloaded to ${result.filename}`, 'success');
      } else {
        showNotification(`Failed to download panel: ${result.message}`, 'error');
      }
    } catch (error) {
      console.error('Error downloading panel:', error);
      showNotification('Failed to download panel', 'error');
    } finally {
      setDownloadingPanel(null);
    }
  };

  const handleDownloadReference = async () => {
    if (!window.electronAPI || !referenceImage) return;

    setDownloadingReference(true);

    try {
      const result = await window.electronAPI.downloadReferenceImage(referenceImage, 'downloads');

      if (result.success) {
        showNotification(`Reference image downloaded to ${result.filename}`, 'success');
      } else {
        showNotification(`Failed to download reference: ${result.message}`, 'error');
      }
    } catch (error) {
      console.error('Error downloading reference image:', error);
      showNotification('Failed to download reference image', 'error');
    } finally {
      setDownloadingReference(false);
    }
  };

  const renderPanel = (panel: any, index: number) => (
    <Paper
      key={panel.id}
      sx={{
        position: 'relative',
        paddingBottom: '56.25%', // 16:9 aspect ratio
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.3s',
        '&:hover': {
          transform: 'scale(1.02)',
          boxShadow: 4
        }
      }}
      onClick={() => setSelectedPanel(panel)}
    >
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `url(${panel.url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            bgcolor: 'rgba(0,0,0,0.7)',
            borderRadius: 1,
            px: 1,
            py: 0.5
          }}
        >
          <Typography variant="caption" color="white">
            Panel {index + 1}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Typography variant="h5">Generated Storyboard</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<GridIcon />}
            onClick={() => setViewMode(viewMode === 'grid' ? 'sequential' : 'grid')}
            disabled={downloadingAll}
          >
            {viewMode === 'grid' ? 'Sequential View' : 'Grid View'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleDownloadAll}
            disabled={downloadingAll || panels.length === 0}
          >
            {downloadingAll ? `Downloading (${Math.round(downloadProgress)}%)` : 'Download All'}
          </Button>
          <Button
            variant="contained"
            startIcon={<ExportIcon />}
            onClick={handleExportVideo}
            disabled={downloadingAll || exportingVideo || !ffmpegAvailable}
          >
            {exportingVideo ? `Exporting (${Math.round(videoExportProgress)}%)` : 'Export as Video'}
          </Button>
        </Stack>
      </Stack>

      {referenceImage && (
        <Box mb={3}>
          <Stack direction="row" alignItems="center" spacing={2} mb={1}>
            <Typography variant="subtitle1">
              Reference Image
            </Typography>
            <Button
              size="small"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadReference}
              disabled={downloadingReference}
              variant="outlined"
            >
              {downloadingReference ? 'Downloading...' : 'Download'}
            </Button>
          </Stack>
          <Paper sx={{ display: 'inline-block', p: 1 }}>
            <img
              src={referenceImage}
              alt="Reference"
              style={{ height: 120, display: 'block' }}
            />
          </Paper>
        </Box>
      )}

      {downloadingAll && downloadProgress > 0 && (
        <Box mb={2}>
          <LinearProgress variant="determinate" value={downloadProgress} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Creating ZIP file... {Math.round(downloadProgress)}%
          </Typography>
        </Box>
      )}

      {exportingVideo && videoExportProgress > 0 && (
        <Box mb={2}>
          <LinearProgress variant="determinate" value={videoExportProgress} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Exporting video... {Math.round(videoExportProgress)}%
          </Typography>
        </Box>
      )}

      {viewMode === 'grid' ? (
        <Grid container spacing={2}>
          {panels.map((panel, index) => (
            <Grid item xs={12} sm={6} md={3} key={panel.id}>
              {renderPanel(panel, index)}
            </Grid>
          ))}
        </Grid>
      ) : (
        <Stack spacing={2}>
          {panels.map((panel, index) => (
            <Box key={panel.id}>
              {renderPanel(panel, index)}
              {panel.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, ml: 2 }}>
                  {panel.description}
                </Typography>
              )}
            </Box>
          ))}
        </Stack>
      )}

      <Dialog
        open={!!selectedPanel}
        onClose={() => setSelectedPanel(null)}
        maxWidth="lg"
        fullWidth
      >
        <DialogContent sx={{ p: 0, position: 'relative' }}>
          {selectedPanel && (
            <>
              <img
                src={selectedPanel.url}
                alt={`Panel ${panels.indexOf(selectedPanel) + 1}`}
                style={{ width: '100%', display: 'block' }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  display: 'flex',
                  gap: 1
                }}
              >
                <Tooltip title="Download">
                  <IconButton
                    onClick={() => handleDownloadPanel(selectedPanel)}
                    disabled={downloadingPanel === selectedPanel.id}
                    sx={{
                      bgcolor: 'rgba(0,0,0,0.7)',
                      color: 'white',
                      '&:hover': { bgcolor: 'rgba(0,0,0,0.9)' },
                      '&:disabled': { bgcolor: 'rgba(0,0,0,0.5)' }
                    }}
                  >
                    {downloadingPanel === selectedPanel.id ? (
                      <DownloadIcon sx={{ animation: 'pulse 1s infinite' }} />
                    ) : (
                      <DownloadIcon />
                    )}
                  </IconButton>
                </Tooltip>
              </Box>
              {selectedPanel.description && (
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    bgcolor: 'rgba(0,0,0,0.8)',
                    p: 2
                  }}
                >
                  <Typography color="white">
                    Panel {panels.indexOf(selectedPanel) + 1}: {selectedPanel.description}
                  </Typography>
                </Box>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Video Export Settings Dialog */}
      <Dialog
        open={showVideoExportDialog}
        onClose={() => setShowVideoExportDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <SettingsIcon />
            <Typography variant="h6">Video Export Settings</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Video Format</InputLabel>
              <Select
                value={videoExportOptions.format}
                label="Video Format"
                onChange={(e) => setVideoExportOptions({
                  ...videoExportOptions,
                  format: e.target.value as 'mp4' | 'webm'
                })}
              >
                <MenuItem value="mp4">MP4 (H.264)</MenuItem>
                <MenuItem value="webm">WebM (VP9)</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Quality</InputLabel>
              <Select
                value={videoExportOptions.quality}
                label="Quality"
                onChange={(e) => setVideoExportOptions({
                  ...videoExportOptions,
                  quality: e.target.value as 'low' | 'medium' | 'high'
                })}
              >
                <MenuItem value="low">Low (Smaller file)</MenuItem>
                <MenuItem value="medium">Medium (Balanced)</MenuItem>
                <MenuItem value="high">High (Larger file)</MenuItem>
              </Select>
            </FormControl>

            <TextField
              type="number"
              label="Frame Duration (seconds)"
              value={videoExportOptions.frameDuration}
              onChange={(e) => setVideoExportOptions({
                ...videoExportOptions,
                frameDuration: parseFloat(e.target.value) || 3
              })}
              inputProps={{ min: 1, max: 10, step: 0.5 }}
              helperText="How long each panel is displayed"
            />

            <TextField
              type="number"
              label="Transition Duration (seconds)"
              value={videoExportOptions.transitionDuration}
              onChange={(e) => setVideoExportOptions({
                ...videoExportOptions,
                transitionDuration: parseFloat(e.target.value) || 0.5
              })}
              inputProps={{ min: 0, max: 2, step: 0.1 }}
              helperText="Cross-fade duration between panels"
            />

            <TextField
              type="number"
              label="Frame Rate (FPS)"
              value={videoExportOptions.fps}
              onChange={(e) => setVideoExportOptions({
                ...videoExportOptions,
                fps: parseInt(e.target.value) || 30
              })}
              inputProps={{ min: 15, max: 60, step: 5 }}
              helperText="Frames per second for the video"
            />

            <Box sx={{ bgcolor: 'background.paper', p: 2, borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>Summary:</strong> {panels.length} panels × {videoExportOptions.frameDuration}s each
                ≈ {Math.ceil(panels.length * videoExportOptions.frameDuration)}s video
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowVideoExportDialog(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={startVideoExport}
            startIcon={<ExportIcon />}
          >
            Export Video
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={notification.open}
        autoHideDuration={4000}
        onClose={() => setNotification({ ...notification, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setNotification({ ...notification, open: false })}
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}