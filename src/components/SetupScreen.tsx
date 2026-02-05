import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Paper,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Alert,
  Link,
  Chip,
  Stack,
  FormControlLabel,
  Checkbox,
  IconButton
} from '@mui/material';
import {
  VpnKey as KeyIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Close as CloseIcon,
  FolderOpen as FolderIcon
} from '@mui/icons-material';

interface SetupScreenProps {
  onComplete: () => void;
}

export function SetupScreen({ onComplete }: SetupScreenProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [apiKeys, setApiKeys] = useState({
    openai: '',
    gemini: '',
    replicate: '',
    huggingface: '',
    modal: ''
  });
  const [modalUrl, setModalUrl] = useState('https://andrej-galad--film-generator-image-edit-qwenimageeditgen-94d79a.modal.run/');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSetupOnStartup, setShowSetupOnStartup] = useState(false);
  const [downloadDestination, setDownloadDestination] = useState<string | null>(null);

  useEffect(() => {
    // Load download destination and modal URL on mount
    if (window.electronAPI) {
      window.electronAPI.getDownloadDestination().then(setDownloadDestination);
      window.electronAPI.getModalUrl().then(setModalUrl);
    }
  }, []);

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleApiKeyChange = (provider: string, value: string) => {
    setApiKeys(prev => ({ ...prev, [provider]: value }));
    setErrors(prev => ({ ...prev, [provider]: '' }));
  };

  const handleSelectDownloadDestination = async () => {
    if (!window.electronAPI) return;

    const result = await window.electronAPI.selectDownloadDestination();
    if (result.success && result.destination) {
      setDownloadDestination(result.destination);
      await window.electronAPI.setDownloadDestination(result.destination);
    }
  };

  const validateAndSave = async () => {
    const newErrors: Record<string, string> = {};

    // At least one API key must be provided
    if (!apiKeys.openai && !apiKeys.gemini && !apiKeys.replicate && !apiKeys.huggingface && !apiKeys.modal) {
      newErrors.general = 'Please provide at least one API key';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Save API keys
    if (!window.electronAPI) return;
    await window.electronAPI.storeAPIKeys(apiKeys);

    // Save Modal URL
    await window.electronAPI.setModalUrl(modalUrl);

    // Save "show setup on startup" preference
    await window.electronAPI.setShowSetupOnStartup(showSetupOnStartup);

    onComplete();
  };

  const steps = [
    {
      label: 'Welcome to StoryboardGen',
      content: (
        <Box>
          <Typography variant="body1" gutterBottom>
            StoryboardGen transforms a single image into a cinematic storyboard film.
            Generate 20-panel narratives with consistent visual style and evolving story.
          </Typography>
          <Box sx={{ mt: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="subtitle2" color="primary" gutterBottom>
              What you'll need:
            </Typography>
            <Stack spacing={1} sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                • At least one API key (OpenAI, Google Gemini, Replicate, HuggingFace, or Modal)
              </Typography>
              <Typography variant="body2" color="text.secondary">
                • A reference image to base your storyboard on
              </Typography>
              <Typography variant="body2" color="text.secondary">
                • A creative vision for your cinematic narrative
              </Typography>
            </Stack>
          </Box>
        </Box>
      )
    },
    {
      label: 'Configure API Keys',
      content: (
        <Box>
          <Typography variant="body1" gutterBottom>
            Enter your API keys for the providers you want to use. You need at least one.
          </Typography>

          <Box sx={{ mt: 3 }}>
            <Paper sx={{ p: 2, mb: 2 }}>
              <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                <KeyIcon color="primary" />
                <Typography variant="subtitle1">OpenAI</Typography>
                <Chip label="DALL-E 3" size="small" />
              </Stack>
              <TextField
                fullWidth
                type="password"
                label="OpenAI API Key"
                value={apiKeys.openai}
                onChange={(e) => handleApiKeyChange('openai', e.target.value)}
                placeholder="sk-..."
                helperText={
                  <Link href="https://platform.openai.com/api-keys" target="_blank" rel="noopener">
                    Get your API key from OpenAI
                  </Link>
                }
              />
            </Paper>

            <Paper sx={{ p: 2, mb: 2 }}>
              <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                <KeyIcon color="primary" />
                <Typography variant="subtitle1">Google Gemini</Typography>
                <Chip label="Imagen 3" size="small" />
              </Stack>
              <TextField
                fullWidth
                type="password"
                label="Gemini API Key"
                value={apiKeys.gemini}
                onChange={(e) => handleApiKeyChange('gemini', e.target.value)}
                placeholder="AIza..."
                helperText={
                  <Link href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener">
                    Get your API key from Google AI Studio
                  </Link>
                }
              />
            </Paper>

            <Paper sx={{ p: 2, mb: 2 }}>
              <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                <KeyIcon color="primary" />
                <Typography variant="subtitle1">Replicate</Typography>
                <Chip label="SDXL & More" size="small" />
              </Stack>
              <TextField
                fullWidth
                type="password"
                label="Replicate API Token"
                value={apiKeys.replicate}
                onChange={(e) => handleApiKeyChange('replicate', e.target.value)}
                placeholder="r8_..."
                helperText={
                  <Link href="https://replicate.com/account/api-tokens" target="_blank" rel="noopener">
                    Get your API token from Replicate
                  </Link>
                }
              />
            </Paper>

            <Paper sx={{ p: 2, mb: 2 }}>
              <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                <KeyIcon color="primary" />
                <Typography variant="subtitle1">HuggingFace</Typography>
                <Chip label="500K+ Models" size="small" />
              </Stack>
              <TextField
                fullWidth
                type="password"
                label="HuggingFace API Token"
                value={apiKeys.huggingface}
                onChange={(e) => handleApiKeyChange('huggingface', e.target.value)}
                placeholder="hf_..."
                helperText={
                  <Link href="https://huggingface.co/settings/tokens" target="_blank" rel="noopener">
                    Get your API token from HuggingFace
                  </Link>
                }
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Access 500,000+ models including Qwen Image Editor and custom models
              </Typography>
            </Paper>

            <Paper sx={{ p: 2, mb: 2 }}>
              <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                <KeyIcon color="primary" />
                <Typography variant="subtitle1">Modal (Qwen Image Edit)</Typography>
                <Chip label="Character Consistency" size="small" color="primary" />
              </Stack>
              <TextField
                fullWidth
                type="password"
                label="Modal API Token"
                value={apiKeys.modal}
                onChange={(e) => handleApiKeyChange('modal', e.target.value)}
                placeholder="Modal token ID"
                helperText={
                  <Link href="https://modal.com/settings/tokens" target="_blank" rel="noopener">
                    Get your API token from Modal
                  </Link>
                }
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                type="text"
                label="Modal Function URL"
                value={modalUrl}
                onChange={(e) => setModalUrl(e.target.value)}
                placeholder="https://your-username--your-function.modal.run/"
                helperText="Enter your deployed Modal function URL (pre-filled with default)"
              />
              <Typography variant="caption" color="success.main" sx={{ mt: 0.5, display: 'block' }}>
                Best for maintaining character consistency across storyboard panels
              </Typography>
            </Paper>

            {errors.general && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {errors.general}
              </Alert>
            )}
          </Box>
        </Box>
      )
    },
    {
      label: 'Ready to Create',
      content: (
        <Box>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <CheckIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Setup Complete!
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Your API keys are securely saved. You're ready to start creating cinematic storyboards.
            </Typography>
          </Box>

          <Box sx={{ mt: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              Your configured providers:
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              {apiKeys.openai && <Chip label="OpenAI" size="small" color="primary" />}
              {apiKeys.gemini && <Chip label="Gemini" size="small" color="primary" />}
              {apiKeys.replicate && <Chip label="Replicate" size="small" color="primary" />}
              {apiKeys.huggingface && <Chip label="HuggingFace" size="small" color="primary" />}
            </Stack>
          </Box>

          <Paper sx={{ mt: 3, p: 2, bgcolor: 'background.default' }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={showSetupOnStartup}
                  onChange={(e) => setShowSetupOnStartup(e.target.checked)}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography variant="body2">
                    Show this setup screen every time the app starts
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Useful if you want to configure different API keys each time
                  </Typography>
                </Box>
              }
            />
          </Paper>

          <Paper sx={{ mt: 2, p: 2, bgcolor: 'background.default' }}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight="bold" gutterBottom>
                Download Destination
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Choose where your downloaded storyboards will be saved
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                  {downloadDestination || 'Default: OUTPUT folder in project directory'}
                </Typography>
              </Box>
              <Button
                variant="outlined"
                size="small"
                startIcon={<FolderIcon />}
                onClick={handleSelectDownloadDestination}
              >
                Browse...
              </Button>
              {downloadDestination && (
                <Button
                  variant="text"
                  size="small"
                  color="secondary"
                  onClick={() => {
                    setDownloadDestination(null);
                    window.electronAPI?.setDownloadDestination(null);
                  }}
                >
                  Reset
                </Button>
              )}
            </Box>
            {!downloadDestination && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                By default, files will be saved to the OUTPUT folder in the StoryboardGen project directory
              </Typography>
            )}
          </Paper>
        </Box>
      )
    }
  ];

  return (
    <Container maxWidth="md" sx={{ height: '100vh', display: 'flex', alignItems: 'center', py: 2 }}>
      <Paper elevation={3} sx={{ width: '100%', maxHeight: '90vh', overflowY: 'auto', p: 4, position: 'relative' }}>
        <IconButton
          onClick={onComplete}
          sx={{ position: 'absolute', top: 8, right: 8 }}
          aria-label="Close setup"
        >
          <CloseIcon />
        </IconButton>
        <Typography variant="h4" align="center" gutterBottom sx={{ pr: 4 }}>
          StoryboardGen Setup
        </Typography>

        <Stepper activeStep={activeStep} orientation="vertical" sx={{ mt: 4 }}>
          {steps.map((step, index) => (
            <Step key={step.label}>
              <StepLabel>{step.label}</StepLabel>
              <StepContent>
                {step.content}
                <Box sx={{ mb: 2, mt: 3 }}>
                  <div>
                    {index === steps.length - 1 ? (
                      <Button
                        variant="contained"
                        onClick={validateAndSave}
                        sx={{ mt: 1, mr: 1 }}
                      >
                        Start Creating
                      </Button>
                    ) : (
                      <Button
                        variant="contained"
                        onClick={handleNext}
                        sx={{ mt: 1, mr: 1 }}
                      >
                        Continue
                      </Button>
                    )}
                    {index > 0 && (
                      <Button
                        onClick={handleBack}
                        sx={{ mt: 1, mr: 1 }}
                      >
                        Back
                      </Button>
                    )}
                  </div>
                </Box>
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </Paper>
    </Container>
  );
}