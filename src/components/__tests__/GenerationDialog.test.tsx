import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GenerationDialog } from '../GenerationDialog';

describe('GenerationDialog Component', () => {
  const mockOnGenerate = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock API keys
    (global.electronAPI.getAPIKeys as jest.Mock).mockResolvedValue({
      openai: 'sk-test-key',
      gemini: 'AIza-test-key',
      replicate: 'r8-test-key',
      huggingface: 'hf-test-key'
    });
  });

  it('renders dialog with title', () => {
    render(<GenerationDialog open={true} onClose={mockOnClose} onGenerate={mockOnGenerate} />);

    expect(screen.getByText('Generate Storyboard')).toBeInTheDocument();
  });

  it('shows all available providers', async () => {
    render(<GenerationDialog open={true} onClose={mockOnClose} onGenerate={mockOnGenerate} />);

    await waitFor(() => {
      const providerSelect = screen.getByLabelText('AI Provider');
      expect(providerSelect).toBeInTheDocument();
    });
  });

  it('includes local providers even without API keys', async () => {
    // Mock no API keys
    (global.electronAPI.getAPIKeys as jest.Mock).mockResolvedValue({});

    render(<GenerationDialog open={true} onClose={mockOnClose} onGenerate={mockOnGenerate} />);

    await waitFor(() => {
      const providerSelect = screen.getByLabelText('AI Provider');
      expect(providerSelect).toBeInTheDocument();

      // Open select and verify local providers are available
      fireEvent.mouseDown(providerSelect);

      expect(screen.getByText(/Automatic1111.*Local/i)).toBeInTheDocument();
      expect(screen.getByText(/ComfyUI.*Local/i)).toBeInTheDocument();
    });
  });

  it('displays provider features when provider is selected', async () => {
    render(<GenerationDialog open={true} onClose={mockOnClose} onGenerate={mockOnGenerate} />);

    // Wait for component to fully render with providers
    await waitFor(() => {
      expect(global.electronAPI.getAPIKeys).toHaveBeenCalled();
    }, { timeout: 3000 });

    // Use fireEvent instead of userEvent for simpler interaction
    await waitFor(() => {
      const providerSelect = screen.getByLabelText('AI Provider');
      fireEvent.change(providerSelect, { target: { value: 'huggingface' } });
    }, { timeout: 3000 });

    await waitFor(() => {
      expect(screen.getByText('500K+ models')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('shows HuggingFace specific settings when HuggingFace is selected', async () => {
    render(<GenerationDialog open={true} onClose={mockOnClose} onGenerate={mockOnGenerate} />);

    await waitFor(() => {
      const providerSelect = screen.getByLabelText('AI Provider');
      userEvent.selectOptions(providerSelect, 'huggingface');
    });

    await waitFor(() => {
      expect(screen.getByText('Model Type')).toBeInTheDocument();
      expect(screen.getByLabelText('Server URL')).not.toBeInTheDocument();
    });
  });

  it('shows Automatic1111 server configuration when selected', async () => {
    render(<GenerationDialog open={true} onClose={mockOnClose} onGenerate={mockOnGenerate} />);

    await waitFor(() => {
      const providerSelect = screen.getByLabelText('AI Provider');
      userEvent.selectOptions(providerSelect, 'automatic1111');
    });

    await waitFor(() => {
      expect(screen.getByText('Automatic1111 Server Configuration')).toBeInTheDocument();
      expect(screen.getByLabelText('Server URL')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('http://127.0.0.1:7860')).toBeInTheDocument();
    });
  });

  it('shows ComfyUI server configuration when selected', async () => {
    render(<GenerationDialog open={true} onClose={mockOnClose} onGenerate={mockOnGenerate} />);

    await waitFor(() => {
      const providerSelect = screen.getByLabelText('AI Provider');
      userEvent.selectOptions(providerSelect, 'comfyui');
    });

    await waitFor(() => {
      expect(screen.getByText('ComfyUI Server Configuration')).toBeInTheDocument();
      expect(screen.getByLabelText('Server URL')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('http://127.0.0.1:8188')).toBeInTheDocument();
    });
  });

  it('allows changing server URLs for local providers', async () => {
    render(<GenerationDialog open={true} onClose={mockOnClose} onGenerate={mockOnGenerate} />);

    await waitFor(() => {
      const providerSelect = screen.getByLabelText('AI Provider');
      userEvent.selectOptions(providerSelect, 'automatic1111');
    });

    const serverUrlInput = screen.getByLabelText('Server URL');
    await userEvent.clear(serverUrlInput);
    await userEvent.type(serverUrlInput, 'http://localhost:8080');

    expect(serverUrlInput).toHaveValue('http://localhost:8080');
  });

  it('detects Qwen model and shows info alert', async () => {
    render(<GenerationDialog open={true} onClose={mockOnClose} onGenerate={mockOnGenerate} />);

    await waitFor(() => {
      const providerSelect = screen.getByLabelText('AI Provider');
      userEvent.selectOptions(providerSelect, 'huggingface');
    });

    await waitFor(() => {
      const modelSelect = screen.getByLabelText('Model');
      fireEvent.change(modelSelect, { target: { value: 'custom' } });
    });

    await waitFor(() => {
      const customModelInput = screen.getByLabelText('Custom Model ID');
      fireEvent.change(customModelInput, { target: { value: 'Qwen/Qwen-Image-Edit-2511' } });
    });

    await waitFor(() => {
      expect(screen.getByText(/Qwen Image Editor.*detected/i)).toBeInTheDocument();
    });
  });

  it('calls onGenerate with correct settings for HuggingFace', async () => {
    render(<GenerationDialog open={true} onClose={mockOnClose} onGenerate={mockOnGenerate} />);

    await waitFor(() => {
      const providerSelect = screen.getByLabelText('AI Provider');
      userEvent.selectOptions(providerSelect, 'huggingface');
    });

    await waitFor(() => {
      // Set image-to-image mode
      const imgToImgButton = screen.getByText('Image to Image');
      fireEvent.click(imgToImgButton);
    });

    await waitFor(() => {
      // Click generate
      const generateButton = screen.getByText('Start Generation');
      fireEvent.click(generateButton);
    });

    await waitFor(() => {
      expect(mockOnGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'huggingface',
          modelType: 'image_to_image',
          model: expect.any(String),
          negative_prompt: expect.any(String),
          guidance_scale: expect.any(Number),
          num_inference_steps: expect.any(Number),
          width: 1024,
          height: 1024,
          strength: 0.7
        })
      );
    });
  });

  it('calls onGenerate with correct settings for Automatic1111', async () => {
    render(<GenerationDialog open={true} onClose={mockOnClose} onGenerate={mockOnGenerate} />);

    await waitFor(() => {
      const providerSelect = screen.getByLabelText('AI Provider');
      userEvent.selectOptions(providerSelect, 'automatic1111');
    });

    await waitFor(() => {
      const generateButton = screen.getByText('Start Generation');
      fireEvent.click(generateButton);
    });

    await waitFor(() => {
      expect(mockOnGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'automatic1111',
          automatic1111Url: 'http://127.0.0.1:7860',
          steps: 30,
          cfg_scale: 7,
          sampler: 'DPM++ 2M Karras'
        })
      );
    });
  });

  it('calls onGenerate with correct settings for ComfyUI', async () => {
    render(<GenerationDialog open={true} onClose={mockOnClose} onGenerate={mockOnGenerate} />);

    await waitFor(() => {
      const providerSelect = screen.getByLabelText('AI Provider');
      userEvent.selectOptions(providerSelect, 'comfyui');
    });

    await waitFor(() => {
      const generateButton = screen.getByText('Start Generation');
      fireEvent.click(generateButton);
    });

    await waitFor(() => {
      expect(mockOnGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'comfyui',
          comfyUiUrl: 'http://127.0.0.1:8188',
          model: 'sd_xl_base_1.0.safetensors',
          steps: 30,
          cfg_scale: 7,
          sampler: 'dpmpp_2m',
          scheduler: 'karras'
        })
      );
    });
  });

  it('closes dialog when cancel is clicked', async () => {
    render(<GenerationDialog open={true} onClose={mockOnClose} onGenerate={mockOnGenerate} />);

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
    expect(mockOnGenerate).not.toHaveBeenCalled();
  });

  it('shows info alert for local providers when no API keys configured', async () => {
    (global.electronAPI.getAPIKeys as jest.Mock).mockResolvedValue({});

    render(<GenerationDialog open={true} onClose={mockOnClose} onGenerate={mockOnGenerate} />);

    await waitFor(() => {
      expect(screen.getByText(/Using local providers/i)).toBeInTheDocument();
      expect(screen.getByText(/No API keys needed/i)).toBeInTheDocument();
    });
  });

  it('disables generate button when no provider selected', () => {
    render(<GenerationDialog open={true} onClose={mockOnClose} onGenerate={mockOnGenerate} />);

    // Initially, no provider is selected
    const generateButton = screen.getByText('Start Generation');
    expect(generateButton).toBeDisabled();
  });
});
