import React from 'react';
import 'whatwg-fetch';
import '@testing-library/jest-dom';

// Extend global interface
declare global {
  namespace NodeJS {
    interface Global {
      electronAPI: any;
    }
  }
}

// Mock electronAPI
(global as any).electronAPI = {
  // API Key Management
  storeAPIKeys: jest.fn().mockResolvedValue({ success: true }),
  getAPIKeys: jest.fn().mockResolvedValue({ openai: 'test-key', gemini: 'test-key', replicate: 'test-key', huggingface: 'test-key' }),
  checkSetup: jest.fn().mockResolvedValue({ isSetupComplete: true, hasOpenAI: true, hasGemini: true, hasReplicate: true, hasHuggingFace: true }),
  setShowSetupOnStartup: jest.fn().mockResolvedValue(undefined),
  getShowSetupOnStartup: jest.fn().mockResolvedValue(false),

  // Download Destination Settings
  setDownloadDestination: jest.fn().mockResolvedValue({ success: true }),
  getDownloadDestination: jest.fn().mockResolvedValue(null),
  selectDownloadDestination: jest.fn().mockResolvedValue({ success: true, destination: '/path/to/folder' }),

  // File Operations
  selectImage: jest.fn().mockResolvedValue('data:image/png;base64,test'),

  // Download Operations
  downloadImage: jest.fn().mockResolvedValue({ success: true }),
  downloadReferenceImage: jest.fn().mockResolvedValue({ success: true }),
  downloadAllPanels: jest.fn().mockResolvedValue({ success: true }),
  onDownloadProgress: jest.fn(),

  // Video Export Operations
  checkFFmpeg: jest.fn().mockResolvedValue({ available: true }),
  exportVideo: jest.fn().mockResolvedValue({ success: true }),
  onVideoExportProgress: jest.fn(),

  // Database Operations
  savePrompt: jest.fn().mockResolvedValue({ success: true }),
  getPrompts: jest.fn().mockResolvedValue([]),
  getPrompt: jest.fn().mockResolvedValue({ id: 'test', title: 'Test', content: 'Test content' }),
  updatePrompt: jest.fn().mockResolvedValue({ success: true }),
  deletePrompt: jest.fn().mockResolvedValue({ success: true }),

  // Generation Operations
  generateStoryboard: jest.fn(),

  // Progress Updates
  onGenerationProgress: jest.fn(),

  // Remove listeners
  removeAllListeners: jest.fn(),
};

// Mock MUI Components - mock the entire package
jest.mock('@mui/material', () => {
  const React = require('react');
  return {
    Box: ({ children, ...props }: any) => <div data-mui="Box" {...props}>{children}</div>,
    Drawer: ({ children, ...props }: any) => <div data-mui="Drawer" {...props}>{children}</div>,
    AppBar: ({ children, ...props }: any) => <div data-mui="AppBar" {...props}>{children}</div>,
    Toolbar: ({ children, ...props }: any) => <div data-mui="Toolbar" {...props}>{children}</div>,
    Typography: ({ children, variant, ...props }: any) => {
      const Tag = variant?.startsWith('h') ? (variant === 'h6' ? 'h6' : variant === 'h5' ? 'h5' : 'p') : 'p';
      return React.createElement(Tag, { ...props, 'data-mui': 'Typography' }, children);
    },
    Button: ({ children, disabled, startIcon, ...props }: any) => (
      <button data-mui="Button" disabled={disabled} {...props}>{startIcon}{children}</button>
    ),
    IconButton: ({ children, disabled, ...props }: any) => (
      <button data-mui="IconButton" disabled={disabled} {...props}>{children}</button>
    ),
    Fab: ({ children, ...props }: any) => <button data-mui="Fab" {...props}>{children}</button>,
    Tooltip: ({ children, title, ...props }: any) => (
      <div data-mui="Tooltip" title={title} {...props}>{children}</div>
    ),
    CircularProgress: (props: any) => <div data-mui="CircularProgress" {...props} />,
    LinearProgress: (props: any) => <div data-mui="LinearProgress" {...props} />,
    Paper: ({ children, ...props }: any) => <div data-mui="Paper" {...props}>{children}</div>,
    Stack: ({ children, direction, ...props }: any) => (
      <div data-mui="Stack" data-direction={direction} {...props}>{children}</div>
    ),
    Chip: ({ children, icon, label, ...props }: any) => (
      <span data-mui="Chip" {...props}>{icon}{label || children}</span>
    ),
    Alert: ({ children, severity, ...props }: any) => (
      <div data-mui="Alert" data-severity={severity} {...props}>{children}</div>
    ),
    AlertTitle: ({ children, ...props }: any) => <div data-mui="AlertTitle" {...props}>{children}</div>,
    Grid: ({ children, container, item, spacing, ...props }: any) => (
      <div data-mui="Grid" data-container={container} data-item={item} data-spacing={spacing} {...props}>{children}</div>
    ),
    Dialog: ({ children, open, ...props }: any) => (
      open ? <div data-mui="Dialog" {...props}>{children}</div> : null
    ),
    DialogTitle: ({ children, ...props }: any) => <div data-mui="DialogTitle" {...props}>{children}</div>,
    DialogContent: ({ children, ...props }: any) => <div data-mui="DialogContent" {...props}>{children}</div>,
    DialogContentText: ({ children, ...props }: any) => <div data-mui="DialogContentText" {...props}>{children}</div>,
    DialogActions: ({ children, ...props }: any) => <div data-mui="DialogActions" {...props}>{children}</div>,
    TextField: ({ label, helperText, error, InputProps, inputProps, value, onChange, ...props }: any) => (
      <div data-mui="TextField" {...props}>
        {label && <label>{label}</label>}
        <input type="text" value={value} onChange={onChange} {...inputProps} />
        {helperText && <small>{helperText}</small>}
      </div>
    ),
    FormControl: ({ children, ...props }: any) => <div data-mui="FormControl" {...props}>{children}</div>,
    InputLabel: ({ children, ...props }: any) => <label data-mui="InputLabel" {...props}>{children}</label>,
    Select: ({ children, value, onChange, label, native, ...props }: any) => (
      <div data-mui="Select" {...props}>
        {label && <label>{label}</label>}
        <select value={value} onChange={onChange} aria-label={label}>
          {children}
        </select>
      </div>
    ),
    MenuItem: ({ children, value, ...props }: any) => (
      <option value={value} data-mui="MenuItem" {...props}>{children}</option>
    ),
    FormHelperText: ({ children, ...props }: any) => <small data-mui="FormHelperText" {...props}>{children}</small>,
    FormControlLabel: ({ children, control, label, ...props }: any) => (
      <label data-mui="FormControlLabel" {...props}>
        {control}
        {label}
        {children}
      </label>
    ),
    Checkbox: ({ checked, onChange, ...props }: any) => (
      <input
        type="checkbox"
        data-mui="Checkbox"
        checked={checked}
        onChange={onChange}
        {...props}
      />
    ),
    Radio: ({ checked, onChange, ...props }: any) => (
      <input type="radio" data-mui="Radio" checked={checked} onChange={onChange} {...props} />
    ),
    RadioGroup: ({ children, value, onChange, ...props }: any) => (
      <div data-mui="RadioGroup" {...props}>{children}</div>
    ),
    ToggleButtonGroup: ({ children, value, exclusive, onChange, ...props }: any) => (
      <div data-mui="ToggleButtonGroup" {...props}>{children}</div>
    ),
    ToggleButton: ({ children, value, selected, onChange, ...props }: any) => (
      <button data-mui="ToggleButton" data-selected={selected} aria-pressed={selected} {...props}>{children}</button>
    ),
    Divider: (props: any) => <hr data-mui="Divider" {...props} />,
    Slider: ({ value, onChange, ...props }: any) => (
      <input type="range" data-mui="Slider" value={value} onChange={onChange} {...props} />
    ),
    Collapse: ({ children, in: open, ...props }: any) => (
      open ? <div data-mui="Collapse" {...props}>{children}</div> : null
    ),
    useTheme: jest.fn(() => ({})),
  };
});

// Mock MUI Icons - mock the entire module with all named exports
jest.mock('@mui/icons-material', () => ({
  Menu: () => <span data-icon="Menu" />,
  CloudUpload: () => <span data-icon="CloudUpload" />,
  PlayArrow: () => <span data-icon="PlayArrow" />,
  Settings: () => <span data-icon="Settings" />,
  Save: () => <span data-icon="Save" />,
  FolderOpen: () => <span data-icon="FolderOpen" />,
  Download: () => <span data-icon="Download" />,
  CheckCircle: () => <span data-icon="CheckCircle" />,
  Error: () => <span data-icon="Error" />,
  Schedule: () => <span data-icon="Schedule" />,
  Cached: () => <span data-icon="Cached" />,
  AutoAwesome: () => <span data-icon="AutoAwesome" />,
  Info: () => <span data-icon="Info" />,
  Warning: () => <span data-icon="Warning" />,
  Close: () => <span data-icon="Close" />,
  Add: () => <span data-icon="Add" />,
  Edit: () => <span data-icon="Edit" />,
  Delete: () => <span data-icon="Delete" />,
  Send: () => <span data-icon="Send" />,
  Description: () => <span data-icon="Description" />,
  ArrowBack: () => <span data-icon="ArrowBack" />,
  LightMode: () => <span data-icon="LightMode" />,
  DarkMode: () => <span data-icon="DarkMode" />,
  Storage: () => <span data-icon="Storage" />,
  Image: () => <span data-icon="Image" />,
}));

// Keep Konva mock (canvas dependencies)
jest.mock('react-konva', () => ({
  Stage: ({ children }: any) => <div data-konva="Stage">{children}</div>,
  Layer: ({ children }: any) => <div data-konva="Layer">{children}</div>,
  Rect: (props: any) => <div data-konva="Rect" {...props} />,
  Image: (props: any) => <img data-konva="Image" {...props} />,
  Text: (props: any) => <span data-konva="Text" {...props} />,
  Group: ({ children }: any) => <div data-konva="Group">{children}</div>,
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
(global as any).IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock ResizeObserver
(global as any).ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};
