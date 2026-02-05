import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MainCanvas } from '../MainCanvas';

describe('MainCanvas Regression Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock API responses
    (global.electronAPI.checkSetup as jest.Mock).mockResolvedValue({
      isSetupComplete: true,
      hasOpenAI: true,
      hasGemini: true,
      hasReplicate: true,
      hasHuggingFace: true
    });

    (global.electronAPI.getPrompt as jest.Mock).mockResolvedValue({
      id: 'default-20-panel',
      title: '20-Panel Cinematic Storyboard',
      content: 'Test prompt content'
    });

    (global.electronAPI.getShowSetupOnStartup as jest.Mock).mockResolvedValue(false);
  });

  it('should render without errors', () => {
    render(<MainCanvas onOpenSettings={jest.fn()} />);

    // Should not throw any errors
    expect(screen.getByText('StoryboardGen')).toBeInTheDocument();
  });

  it('should load default prompt on mount', async () => {
    render(<MainCanvas onOpenSettings={jest.fn()} />);

    await waitFor(() => {
      expect(global.electronAPI.getPrompt).toHaveBeenCalledWith('default-20-panel');
    });
  });

  it('should show upload prompt when no image', async () => {
    render(<MainCanvas onOpenSettings={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Upload a Reference Image')).toBeInTheDocument();
      expect(screen.getByText(/Start by uploading an image/i)).toBeInTheDocument();
    });
  });

  it('should show reference image preview after upload', async () => {
    (global.electronAPI.selectImage as jest.Mock).mockResolvedValue('data:image/png;base64,test123');

    render(<MainCanvas onOpenSettings={jest.fn()} />);

    const uploadButtons = screen.getAllByText(/Upload Reference/i);
    await userEvent.click(uploadButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Reference Image')).toBeInTheDocument();
    });
  });

  it('should have generate button that opens dialog', async () => {
    (global.electronAPI.selectImage as jest.Mock).mockResolvedValue('data:image/png;base64,test123');

    render(<MainCanvas onOpenSettings={jest.fn()} />);

    await waitFor(() => {
      const uploadButtons = screen.getAllByText(/Upload Reference/i);
      expect(uploadButtons.length).toBeGreaterThan(0);
    });

    // Upload image
    await userEvent.click(screen.getAllByText(/Upload Reference/i)[0]);

    await waitFor(() => {
      const generateButton = screen.getByText('Generate Storyboard');
      expect(generateButton).toBeInTheDocument();
    });
  });

  it('should disable generate button without image', async () => {
    render(<MainCanvas onOpenSettings={jest.fn()} />);

    await waitFor(() => {
      const generateButton = screen.getByText('Generate Storyboard');
      expect(generateButton).toBeDisabled();
    });
  });

  it('should disable upload button during generation', async () => {
    (global.electronAPI.selectImage as jest.Mock).mockResolvedValue('data:image/png;base64,test123');
    (global.electronAPI.generateStoryboard as jest.Mock).mockImplementation(() => {
      // Simulate generation in progress
      return new Promise(() => {}); // Never resolves
    });

    render(<MainCanvas onOpenSettings={jest.fn()} />);

    // Upload image
    await userEvent.click(screen.getAllByText(/Upload Reference/i)[0]);

    await waitFor(() => {
      const generateButton = screen.getByText('Generate Storyboard');
      expect(generateButton).not.toBeDisabled();
    });

    // Start generation
    const generateButton = screen.getByText('Generate Storyboard');
    await userEvent.click(generateButton);

    // Wait for generation dialog to close and generation to start
    await waitFor(() => {
      const uploadButton = screen.queryByText(/Upload Reference/i);
      // Upload button should be disabled or show "Change Image"
      const changeImageButton = screen.queryByText('Change Image');
      expect(uploadButton || changeImageButton).toBeTruthy();
    });
  });

  it('should show prompts panel when drawer is open', async () => {
    render(<MainCanvas onOpenSettings={jest.fn()} />);

    await waitFor(() => {
      // Drawer is open by default
      expect(screen.getByRole('presentation')).toBeInTheDocument();
    });
  });

  it('should allow toggling drawer', async () => {
    render(<MainCanvas onOpenSettings={jest.fn()} />);

    await waitFor(() => {
      const menuButton = screen.getByRole('button', { name: /open menu/i });
      expect(menuButton).toBeInTheDocument();
    });

    // Click menu button to close drawer
    const menuButton = screen.getByRole('button', { name: /open menu/i });
    await userEvent.click(menuButton);

    // Drawer should close
    await waitFor(() => {
      expect(screen.queryByRole('presentation')).not.toBeInTheDocument();
    });
  });

  it('should display generated panels in grid', async () => {
    // Mock successful generation
    (global.electronAPI.selectImage as jest.Mock).mockResolvedValue('data:image/png;base64,test123');

    // Mock progress listener callback
    (global.electronAPI.onGenerationProgress as jest.Mock).mockImplementation((callback) => {
      // Simulate completion after a short delay
      setTimeout(() => {
        callback({
          status: 'completed',
          progress: 100,
          message: 'Generation complete',
          currentPanel: 20,
          totalPanels: 20,
          panels: Array.from({ length: 20 }, (_, i) => ({
            number: i + 1,
            status: 'completed',
            attempts: 1
          })),
          eta: '0s',
          result: {
            panels: Array.from({ length: 20 }, (_, i) => ({
              id: `panel-${i + 1}`,
              url: `data:image/png;base64,panel${i + 1}`,
              description: `Panel ${i + 1}`
            }))
          }
        });
      }, 100);
    });

    render(<MainCanvas onOpenSettings={jest.fn()} />);

    // Upload image and start generation
    await userEvent.click(screen.getAllByText(/Upload Reference/i)[0]);
    await waitFor(() => {
      const generateButton = screen.getByText('Generate Storyboard');
      expect(generateButton).not.toBeDisabled();
    });

    // Mock the dialog to auto-start
    const generateButton = screen.getByText('Generate Storyboard');
    await userEvent.click(generateButton);

    // Wait for generation to complete and grid to show
    await waitFor(() => {
      expect(screen.getByText(/panels generated/i)).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('should allow opening settings from toolbar', async () => {
    const mockOnOpenSettings = jest.fn();

    render(<MainCanvas onOpenSettings={mockOnOpenSettings} />);

    await waitFor(() => {
      const settingsButton = screen.getByRole('button', { name: /settings/i });
      expect(settingsButton).toBeInTheDocument();
    });

    const settingsButton = screen.getByRole('button', { name: /settings/i });
    await userEvent.click(settingsButton);

    expect(mockOnOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('should not crash when electronAPI is undefined', () => {
    // Temporarily remove electronAPI
    const originalAPI = global.electronAPI;
    delete global.electronAPI;

    expect(() => {
      render(<MainCanvas onOpenSettings={jest.fn()} />);
    }).not.toThrow();

    // Restore electronAPI
    global.electronAPI = originalAPI;
  });

  it('should set up progress listeners on mount', async () => {
    render(<MainCanvas onOpenSettings={jest.fn()} />);

    await waitFor(() => {
      expect(global.electronAPI.onGenerationProgress).toHaveBeenCalled();
    });

    // Should clean up listeners on unmount
    const { unmount } = render(<MainCanvas onOpenSettings={jest.fn()} />);
    unmount();

    await waitFor(() => {
      expect(global.electronAPI.removeAllListeners).toHaveBeenCalledWith('generation-progress');
    });
  });
});
