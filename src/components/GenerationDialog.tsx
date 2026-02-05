import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Typography,
  Box,
  Stack,
  Chip,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
  Paper
} from '@mui/material';
import {
  Image as TextToImageIcon,
  Edit as ImageToImageIcon
} from '@mui/icons-material';

interface GenerationDialogProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (settings: any) => void;
}

export function GenerationDialog({ open, onClose, onGenerate }: GenerationDialogProps) {
  const [provider, setProvider] = useState('');
  const [quality, setQuality] = useState('high');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [style, setStyle] = useState('cinematic');
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);

  // HuggingFace specific settings
  const [hfModel, setHfModel] = useState('stabilityai/stable-diffusion-xl-base-1.0');
  const [hfModelType, setHfModelType] = useState<'text_to_image' | 'image_to_image'>('text_to_image');
  const [customModel, setCustomModel] = useState('');

  // Local provider settings
  const [auto1111Url, setAuto1111Url] = useState('http://127.0.0.1:7860');
  const [comfyUiUrl, setComfyUiUrl] = useState('http://127.0.0.1:8188');
  const [localModel, setLocalModel] = useState('');

  useEffect(() => {
    checkAvailableProviders();
  }, [open]);

  const checkAvailableProviders = async () => {
    if (!window.electronAPI) return;
    const keys = await window.electronAPI.getAPIKeys();
    const available = [];
    if (keys.openai) available.push('openai');
    if (keys.gemini) available.push('gemini');
    if (keys.replicate) available.push('replicate');
    if (keys.huggingface) available.push('huggingface');
    if (keys.modal) available.push('modal');
    // Local providers are always available
    available.push('automatic1111', 'comfyui');
    setAvailableProviders(available);

    // Auto-select first available provider
    if (available.length > 0 && !provider) {
      setProvider(available[0]);
    }
  };

  const handleGenerate = () => {
    const settings: any = {
      provider,
      quality,
      aspectRatio,
      style,
      panelCount: 20 // Fixed for now, could be made configurable
    };

    // Add HuggingFace specific settings
    if (provider === 'huggingface') {
      settings.model = customModel || hfModel;
      settings.modelType = hfModelType;
      settings.negative_prompt = "blurry, low quality, distorted, ugly, bad anatomy, extra limbs";
      settings.guidance_scale = 7.5;
      settings.num_inference_steps = 30;
      settings.width = 1024;
      settings.height = 1024;
      settings.strength = 0.7; // For image-to-image
    }

    // Add Automatic1111 specific settings
    if (provider === 'automatic1111') {
      settings.automatic1111Url = auto1111Url;
      settings.model = localModel;
      settings.steps = 30;
      settings.cfg_scale = 7;
      settings.sampler = 'DPM++ 2M Karras';
      settings.width = 1024;
      settings.height = 1024;
      settings.negative_prompt = "blurry, low quality, distorted, ugly, bad anatomy, extra limbs";
    }

    // Add ComfyUI specific settings
    if (provider === 'comfyui') {
      settings.comfyUiUrl = comfyUiUrl;
      settings.model = localModel || 'sd_xl_base_1.0.safetensors';
      settings.steps = 30;
      settings.cfg_scale = 7;
      settings.sampler = 'dpmpp_2m';
      settings.scheduler = 'karras';
      settings.width = 1024;
      settings.height = 1024;
      settings.negative_prompt = "blurry, low quality, distorted, ugly, bad anatomy";
    }

    onGenerate(settings);
  };

  const providerInfo = {
    openai: {
      name: 'OpenAI (DALL-E 3)',
      models: ['dall-e-3'],
      features: ['High quality', 'Consistent style', 'Fast generation']
    },
    gemini: {
      name: 'Google Gemini (Imagen 3)',
      models: ['imagen-3'],
      features: ['Photorealistic', 'Advanced understanding', 'Style control']
    },
    replicate: {
      name: 'Replicate',
      models: ['stable-diffusion-xl', 'playground-v2'],
      features: ['Multiple models', 'Cost effective', 'Customizable']
    },
    huggingface: {
      name: 'HuggingFace',
      models: ['stabilityai/stable-diffusion-xl-base-1.0', 'runwayml/stable-diffusion-v1-5', 'custom'],
      features: ['500K+ models', 'Custom models', 'Qwen Image Editor', 'Image-to-image']
    },
    modal: {
      name: 'Modal (Qwen Image Edit)',
      models: ['Qwen-Image-Edit-2511', 'Custom'],
      features: ['Character consistency', 'Image-to-image', 'H100 GPU', 'Cinematic quality']
    },
    automatic1111: {
      name: 'Automatic1111 (Local)',
      models: ['SDXL', 'SD 1.5', 'SD 2.1'],
      features: ['Local GPU', 'Free', 'Fast', 'No API limits']
    },
    comfyui: {
      name: 'ComfyUI (Local)',
      models: ['SDXL', 'Flux', 'Custom Workflows'],
      features: ['Local GPU', 'Node-based', 'Customizable', 'Advanced']
    }
  };

  const popularHuggingFaceModels = [
    { value: 'stabilityai/stable-diffusion-xl-base-1.0', label: 'SDXL (Works with Free API) ⭐' },
    { value: 'custom', label: 'Custom Model...' }
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Generate Storyboard</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <FormControl fullWidth>
            <InputLabel>AI Provider</InputLabel>
            <Select
              value={provider}
              label="AI Provider"
              onChange={(e) => setProvider(e.target.value)}
            >
              {availableProviders.map((p) => (
                <MenuItem key={p} value={p}>
                  {providerInfo[p as keyof typeof providerInfo]?.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {provider && (
            <Box sx={{ bgcolor: 'background.default', p: 2, borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Features:
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                {providerInfo[provider as keyof typeof providerInfo]?.features.map((feature) => (
                  <Chip key={feature} label={feature} size="small" />
                ))}
              </Stack>
            </Box>
          )}

          {/* HuggingFace specific settings */}
          {provider === 'huggingface' && (
            <>
              <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                <Typography variant="subtitle2" gutterBottom>
                  Model Type
                </Typography>
                <ToggleButtonGroup
                  value={hfModelType}
                  exclusive
                  onChange={(e, newType) => newType && setHfModelType(newType)}
                  fullWidth
                  sx={{ mb: 2 }}
                >
                  <ToggleButton value="text_to_image" aria-label="text to image">
                    <TextToImageIcon sx={{ mr: 1 }} />
                    Text to Image
                  </ToggleButton>
                  <ToggleButton value="image_to_image" aria-label="image to image">
                    <ImageToImageIcon sx={{ mr: 1 }} />
                    Image to Image
                  </ToggleButton>
                </ToggleButtonGroup>

                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                  {hfModelType === 'text_to_image'
                    ? 'Generate images from text descriptions. Best for creating new scenes.'
                    : 'Transform your reference image. Great for style transfer and Qwen Image Editor.'}
                </Typography>
              </Paper>

              <FormControl fullWidth>
                <InputLabel>Model</InputLabel>
                <Select
                  value={customModel || hfModel}
                  label="Model"
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === 'custom') {
                      setCustomModel('');
                    } else {
                      setHfModel(value);
                      setCustomModel('');
                    }
                  }}
                >
                  {popularHuggingFaceModels.map((model) => (
                    <MenuItem key={model.value} value={model.value}>
                      {model.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {(customModel === '' || customModel) && (
                <TextField
                  fullWidth
                  label="Custom Model ID"
                  placeholder="e.g., QuantStack/Qwen-Image-Edit-2509-GGUF"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  helperText="Enter any HuggingFace model ID for image generation"
                  disabled={hfModel !== 'custom' && customModel === ''}
                />
              )}

              {customModel?.toLowerCase().includes('qwen') && (
                <Alert severity="info" sx={{ mt: 1 }}>
                  <Typography variant="body2">
                    <strong>Qwen Image Editor</strong> detected! This model excels at semantic image editing,
                    object rotation, and style transfer while maintaining the original structure.
                  </Typography>
                </Alert>
              )}
            </>
          )}

          {/* Automatic1111 specific settings */}
          {provider === 'automatic1111' && (
            <>
              <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                <Typography variant="subtitle2" gutterBottom>
                  Automatic1111 Server Configuration
                </Typography>
                <TextField
                  fullWidth
                  label="Server URL"
                  value={auto1111Url}
                  onChange={(e) => setAuto1111Url(e.target.value)}
                  placeholder="http://127.0.0.1:7860"
                  helperText="Make sure SD WebUI is running with --api flag"
                  sx={{ mt: 2 }}
                />
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  Download Automatic1111 from GitHub and run: webui.sh --api
                </Typography>
              </Paper>

              <TextField
                fullWidth
                label="Model (optional)"
                value={localModel}
                onChange={(e) => setLocalModel(e.target.value)}
                placeholder="Leave empty to use currently selected model"
                helperText="Model filename in your SD WebUI models folder"
              />
            </>
          )}

          {/* ComfyUI specific settings */}
          {provider === 'comfyui' && (
            <>
              <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                <Typography variant="subtitle2" gutterBottom>
                  ComfyUI Server Configuration
                </Typography>
                <TextField
                  fullWidth
                  label="Server URL"
                  value={comfyUiUrl}
                  onChange={(e) => setComfyUiUrl(e.target.value)}
                  placeholder="http://127.0.0.1:8188"
                  helperText="Make sure ComfyUI is running"
                  sx={{ mt: 2 }}
                />
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  Download ComfyUI from GitHub and run: run_nvidia_gpu.bat
                </Typography>
              </Paper>

              <TextField
                fullWidth
                label="Model (optional)"
                value={localModel}
                onChange={(e) => setLocalModel(e.target.value)}
                placeholder="sd_xl_base_1.0.safetensors"
                helperText="Model filename in your ComfyUI models folder"
              />

              <Alert severity="info" sx={{ mt: 1 }}>
                <Typography variant="body2">
                  <strong>ComfyUI</strong> provides advanced node-based image generation with full customization.
                  Supports SDXL, Flux, and custom workflows.
                </Typography>
              </Alert>
            </>
          )}

          <FormControl fullWidth>
            <InputLabel>Quality</InputLabel>
            <Select
              value={quality}
              label="Quality"
              onChange={(e) => setQuality(e.target.value)}
            >
              <MenuItem value="standard">Standard (Faster)</MenuItem>
              <MenuItem value="high">High (Recommended)</MenuItem>
              <MenuItem value="ultra">Ultra (Best quality)</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Aspect Ratio</InputLabel>
            <Select
              value={aspectRatio}
              label="Aspect Ratio"
              onChange={(e) => setAspectRatio(e.target.value)}
            >
              <MenuItem value="16:9">16:9 (Widescreen)</MenuItem>
              <MenuItem value="21:9">21:9 (Cinematic)</MenuItem>
              <MenuItem value="4:3">4:3 (Classic)</MenuItem>
              <MenuItem value="1:1">1:1 (Square)</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Visual Style</InputLabel>
            <Select
              value={style}
              label="Visual Style"
              onChange={(e) => setStyle(e.target.value)}
            >
              <MenuItem value="cinematic">Cinematic</MenuItem>
              <MenuItem value="realistic">Photorealistic</MenuItem>
              <MenuItem value="stylized">Stylized</MenuItem>
              <MenuItem value="minimal">Minimal</MenuItem>
            </Select>
          </FormControl>

          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              This will generate 20 panels based on your reference image and selected prompt.
              Generation typically takes 2-5 minutes depending on the provider and settings.
            </Typography>
          </Box>

          {availableProviders.filter(p => p !== 'automatic1111' && p !== 'comfyui').length === 0 && (
            <Alert severity="info">
              Using local providers (Automatic1111/ComfyUI). Make sure your local SD WebUI or ComfyUI is running.
              No API keys needed for local generation!
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleGenerate}
          variant="contained"
          disabled={!provider}
        >
          Start Generation
        </Button>
      </DialogActions>
    </Dialog>
  );
}
