import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SetupScreen } from '../SetupScreen';

describe('SetupScreen Component', () => {
  const mockOnComplete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (global.electronAPI.storeAPIKeys as jest.Mock).mockResolvedValue({ success: true });
  });

  it('renders welcome step', () => {
    render(<SetupScreen onComplete={mockOnComplete} />);

    expect(screen.getByText('Welcome to StoryboardGen')).toBeInTheDocument();
    expect(screen.getByText(/transforms a single image/i)).toBeInTheDocument();
    expect(screen.getByText(/at least one api key/i)).toBeInTheDocument();
  });

  it('renders API key configuration step', async () => {
    render(<SetupScreen onComplete={mockOnComplete} />);

    // Click continue to go to step 2
    const continueButton = screen.getAllByText('Continue')[0];
    await userEvent.click(continueButton);

    // Should show OpenAI field
    expect(screen.getByLabelText('OpenAI API Key')).toBeInTheDocument();
    expect(screen.getByText('Get your API key from OpenAI')).toBeInTheDocument();
  });

  it('requires at least one API key to proceed', async () => {
    render(<SetupScreen onComplete={mockOnComplete} />);

    // Navigate to API keys step
    await userEvent.click(screen.getAllByText('Continue')[0]);

    // Navigate to final step without entering any keys
    await userEvent.click(screen.getAllByText('Continue')[1]);

    // Try to complete setup - should show validation error
    const startButton = screen.getByText('Start Creating');
    await userEvent.click(startButton);

    // Should show validation error
    await waitFor(() => {
      expect(screen.getByText('Please provide at least one API key')).toBeInTheDocument();
    });
  });

  it('allows proceeding with OpenAI key only', async () => {
    render(<SetupScreen onComplete={mockOnComplete} />);

    // Navigate to API keys step
    await userEvent.click(screen.getAllByText('Continue')[0]);

    // Enter OpenAI key
    const openaiInput = screen.getByLabelText('OpenAI API Key');
    await userEvent.type(openaiInput, 'sk-test-key-12345');

    // Continue to final step
    await userEvent.click(screen.getAllByText('Continue')[1]);

    // Click Start Creating to complete setup
    await userEvent.click(screen.getByText('Start Creating'));

    // Should save API keys
    await waitFor(() => {
      expect(global.electronAPI.storeAPIKeys).toHaveBeenCalledWith({
        openai: 'sk-test-key-12345',
        gemini: '',
        replicate: '',
        huggingface: '',
        modal: ''
      });
    });
  });

  it('supports multiple API keys', async () => {
    render(<SetupScreen onComplete={mockOnComplete} />);

    // Navigate to API keys step
    await userEvent.click(screen.getAllByText('Continue')[0]);

    // Enter multiple keys
    await userEvent.type(screen.getByLabelText('OpenAI API Key'), 'sk-test-1');
    await userEvent.type(screen.getByLabelText('Gemini API Key'), 'AIza-test-2');
    await userEvent.type(screen.getByLabelText('Replicate API Token'), 'r8-test-3');
    await userEvent.type(screen.getByLabelText('HuggingFace API Token'), 'hf-test-4');

    // Continue to final step
    await userEvent.click(screen.getAllByText('Continue')[1]);

    // Click Start Creating to complete setup
    await userEvent.click(screen.getByText('Start Creating'));

    await waitFor(() => {
      expect(global.electronAPI.storeAPIKeys).toHaveBeenCalledWith({
        openai: 'sk-test-1',
        gemini: 'AIza-test-2',
        replicate: 'r8-test-3',
        huggingface: 'hf-test-4',
        modal: ''
      });
    });
  });

  it('shows "show setup on startup" checkbox in final step', async () => {
    render(<SetupScreen onComplete={mockOnComplete} />);

    // Navigate to final step by entering API keys
    await userEvent.click(screen.getAllByText('Continue')[0]);
    await userEvent.type(screen.getByLabelText('OpenAI API Key'), 'sk-test-key');
    await userEvent.click(screen.getAllByText('Continue')[1]);

    // Should show the checkbox
    expect(screen.getByLabelText(/show this setup screen every time/i)).toBeInTheDocument();
  });

  it('saves "show setup on startup" preference', async () => {
    render(<SetupScreen onComplete={mockOnComplete} />);

    // Navigate to final step
    await userEvent.click(screen.getAllByText('Continue')[0]);
    await userEvent.type(screen.getByLabelText('OpenAI API Key'), 'sk-test-key');
    await userEvent.click(screen.getAllByText('Continue')[1]);

    // Check the checkbox
    const checkbox = screen.getByLabelText(/show this setup screen every time/i);
    await userEvent.click(checkbox);

    expect(checkbox).toBeChecked();

    // Start Creating should save the preference
    (global.electronAPI.setShowSetupOnStartup as jest.Mock).mockResolvedValue();
    await userEvent.click(screen.getByText('Start Creating'));

    await waitFor(() => {
      expect(global.electronAPI.setShowSetupOnStartup).toHaveBeenCalledWith(true);
    });
  });

  it('displays configured providers in final step', async () => {
    render(<SetupScreen onComplete={mockOnComplete} />);

    // Navigate to final step
    await userEvent.click(screen.getAllByText('Continue')[0]);
    await userEvent.type(screen.getByLabelText('OpenAI API Key'), 'sk-test-key');
    await userEvent.type(screen.getByLabelText('Gemini API Key'), 'AIza-test-key');

    await userEvent.click(screen.getAllByText('Continue')[1]);

    // Should show configured providers
    await waitFor(() => {
      expect(screen.getByText('OpenAI')).toBeInTheDocument();
      expect(screen.getByText('Gemini')).toBeInTheDocument();
    });
  });

  it('allows navigation back', async () => {
    render(<SetupScreen onComplete={mockOnComplete} />);

    // Navigate to step 2
    await userEvent.click(screen.getAllByText('Continue')[0]);

    // Go back to step 1
    await userEvent.click(screen.getByText('Back'));

    // Should be back on welcome step
    expect(screen.getByText('Welcome to StoryboardGen')).toBeInTheDocument();
  });

  it('calls onComplete when setup is finished', async () => {
    render(<SetupScreen onComplete={mockOnComplete} />);

    // Navigate through all steps
    await userEvent.click(screen.getAllByText('Continue')[0]);
    await userEvent.type(screen.getByLabelText('OpenAI API Key'), 'sk-test-key');
    await userEvent.click(screen.getAllByText('Continue')[1]);

    // Click start creating
    await userEvent.click(screen.getByText('Start Creating'));

    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalledTimes(1);
    });
  });
});
