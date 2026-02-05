// Type declaration for uuid module
declare module 'uuid' {
  export function v4(): string;
  export function v1(): string;
  export function v3(name: string, namespace: string): string;
  export function v5(name: string, namespace: string): string;
  export function validate(uuid: string): boolean;
  export function version(uuid: string): number;
}

// Enhanced progress tracking interfaces
export interface PanelStatus {
  number: number;
  status: 'pending' | 'generating' | 'completed' | 'error';
  errorMessage?: string;
  attempts: number;
}

export interface PanelStats {
  total: number;
  completed: number;
  generating: number;
  pending: number;
  error: number;
}

export interface GenerationProgress {
  status: 'initializing' | 'preparing' | 'generating' | 'downloading' | 'processing' | 'api_call' | 'retrying' | 'error_panel' | 'post_processing' | 'completed' | 'error';
  progress: number;
  message: string;
  currentPanel: number;
  totalPanels: number;
  panels: PanelStatus[];
  eta: string;
  stage: string;
  errorMessage?: string;
  title?: string; // Error title for user-friendly error messages
  recovery?: string; // Recovery steps for user-friendly error messages
  provider?: string;
  model?: string;
  subStage?: string;
  stats?: PanelStats;
  retryAttempt?: number;
  maxRetries?: number;
  result?: any;
}

export interface ElectronAPI {
  // API Key Management
  storeAPIKeys: (keys: { openai?: string; gemini?: string; replicate?: string; huggingface?: string; modal?: string }) => Promise<{ success: boolean }>;
  getAPIKeys: () => Promise<{ openai?: string; gemini?: string; replicate?: string; huggingface?: string; modal?: string }>;
  setModalUrl: (url: string) => Promise<{ success: boolean }>;
  getModalUrl: () => Promise<string>;
  checkSetup: () => Promise<{
    isSetupComplete: boolean;
    hasOpenAI: boolean;
    hasGemini: boolean;
    hasReplicate: boolean;
    hasHuggingFace: boolean;
    hasModal: boolean;
  }>;
  setShowSetupOnStartup: (show: boolean) => Promise<void>;
  getShowSetupOnStartup: () => Promise<boolean>;

  // Download Destination Settings
  setDownloadDestination: (destination: string | null) => Promise<{ success: boolean }>;
  getDownloadDestination: () => Promise<string | null>;
  selectDownloadDestination: () => Promise<{ success: boolean; destination?: string; canceled?: boolean; error?: string }>;

  // File Operations
  selectImage: () => Promise<string | null>;

  // Download Operations
  downloadImage: (dataUrl: string, filename: string, preferredLocation?: 'downloads' | 'desktop') => Promise<{
    success: boolean;
    filePath?: string;
    filename?: string;
    message: string;
    error?: string;
  }>;
  downloadReferenceImage: (dataUrl: string, preferredLocation?: 'downloads' | 'desktop') => Promise<{
    success: boolean;
    filePath?: string;
    filename?: string;
    message: string;
    error?: string;
  }>;
  downloadAllPanels: (images: Array<{ dataUrl: string; filename: string }>, zipFilename: string, preferredLocation?: 'downloads' | 'desktop') => Promise<{
    success: boolean;
    filePath?: string;
    filename?: string;
    imageCount?: number;
    message: string;
    error?: string;
  }>;

  // Video Export Operations
  checkFFmpeg: () => Promise<{ isAvailable: boolean; error?: string }>;
  exportVideo: (panels: Array<{ id: string; url: string; description?: string }>, options: {
    format?: 'mp4' | 'webm';
    frameDuration?: number;
    transitionDuration?: number;
    fps?: number;
    quality?: 'low' | 'medium' | 'high';
    width?: number;
    height?: number;
    outputFilename?: string;
  }) => Promise<{
    success: boolean;
    outputPath?: string;
    filename?: string;
    message: string;
    error?: string;
  }>;
  onVideoExportProgress: (callback: (progress: {
    percent: number;
    currentFrame: number;
    totalFrames: number;
    message: string;
  }) => void) => void;

  // Database Operations
  savePrompt: (prompt: any) => Promise<void>;
  getPrompts: () => Promise<any[]>;
  getPrompt: (id: string) => Promise<any>;
  updatePrompt: (id: string, data: any) => Promise<void>;
  deletePrompt: (id: string) => Promise<void>;

  // Generation History
  getAllGenerations: () => Promise<any[]>;
  getGeneration: (id: string) => Promise<any>;
  deleteGeneration: (id: string) => Promise<void>;
  markAsSample: (generationId: string, sampleName: string) => Promise<{ success: boolean }>;
  getSamples: () => Promise<any[]>;

  // Generation Operations
  generateStoryboard: (imageUrl: string, prompt: string, settings: any) => Promise<any>;

  // Progress Updates with enhanced typing
  onGenerationProgress: (callback: (progress: GenerationProgress) => void) => void;

  // Download Progress Updates
  onDownloadProgress: (callback: (progress: { progress: number; message: string }) => void) => void;

  // Remove listeners
  removeAllListeners: (channel: string) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
