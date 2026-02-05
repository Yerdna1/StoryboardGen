# StoryboardGen Testing Guide

This directory contains comprehensive tests for the StoryboardGen application.

## Test Structure

```
StoryboardGen/
├── src/
│   ├── __tests__/           # Component unit tests
│   │   └── *.test.tsx
│   └── jest.setup.js        # Jest setup file
├── electron/
│   └── __tests__/           # Backend integration tests
│       └── *.test.js
├── e2e/
│   ├── specs/               # E2E test specifications
│   │   ├── app-launch.spec.js
│   │   ├── setup-flow.spec.js
│   │   ├── generation-flow.spec.js
│   │   ├── local-providers.spec.js
│   │   └── downloads.spec.js
│   └── run-tests.js          # E2E test runner
├── jest.config.js            # Jest configuration
├── babel.config.js           # Babel configuration
└── README.md                 # This file
```

## Running Tests

### Unit Tests (React Components)

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run only unit tests
npm run test:unit
```

### Integration Tests (Electron API Handlers)

```bash
# Run all integration tests
npm run test:integration
```

### E2E Tests (Full Application)

```bash
# Run E2E tests
npm run test:e2e
```

## Test Categories

### Unit Tests

- **SetupScreen.test.tsx**: Tests the setup/onboarding flow
- **GenerationDialog.test.tsx**: Tests the generation configuration dialog
- **MainCanvas.regression.test.tsx**: Regression tests for the main canvas component

### Integration Tests

- **api-handlers.test.js**: Tests for IPC handlers and database operations
- Provider integration tests
- Error handling tests
- Progress tracking tests

### E2E Tests

- **app-launch.spec.js**: Application launch and initialization
- **setup-flow.spec.js**: Complete user onboarding flow
- **generation-flow.spec.js**: Full storyboard generation workflow
- **local-providers.spec.js**: Local provider (Automatic1111, ComfyUI) integration
- **downloads.spec.js**: Download and export functionality

## Writing New Tests

### Component Tests

1. Create test file alongside component: `ComponentName.test.tsx`
2. Import dependencies and mocks
3. Write test cases following this pattern:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentName } from '../ComponentName';

describe('ComponentName', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup mocks
  });

  it('should render', () => {
    render(<ComponentName />);
    expect(screen.getByText(/expected text/i)).toBeInTheDocument();
  });
});
```

### E2E Tests

1. Create spec file in `e2e/specs/`
2. Add test case to `e2e/run-tests.js`
3. Follow the pattern:

```javascript
runner.addTest('Test Name', async () => {
  // Test implementation
  // Use Playwright for browser automation
});
```

## Test Utilities

### Mocks

All `window.electronAPI` methods are mocked in `src/jest.setup.js`:

```typescript
global.electronAPI = {
  storeAPIKeys: jest.fn(),
  getAPIKeys: jest.fn(),
  checkSetup: jest.fn(),
  // ... more methods
};
```

### Common Test Patterns

#### Testing Async Operations

```typescript
await waitFor(() => {
  expect(mockFunction).toHaveBeenCalled();
});
```

#### Testing User Interactions

```typescript
const button = screen.getByText('Click Me');
await userEvent.click(button);
```

#### Testing Form Inputs

```typescript
const input = screen.getByLabelText('Email');
await userEvent.type(input, 'test@example.com');
expect(input).toHaveValue('test@example.com');
```

## Coverage Goals

Current coverage targets (defined in `jest.config.js`):

- **Branches**: 60%
- **Functions**: 60%
- **Lines**: 60%
- **Statements**: 60%

## CI/CD Integration

To run tests in CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run tests
  run: |
    npm test
    npm run test:coverage
    npm run test:e2e
```

## Troubleshooting

### Tests fail with "electronAPI is not defined"

Ensure tests are wrapped with:
```typescript
if (!window.electronAPI) return;
```

Or mock in setup file.

### Port 3000 already in use

Kill the process:
```bash
lsof -ti:3000 | xargs kill -9
```

### Better-sqlite3 build errors

Rebuild for Electron:
```bash
npx electron-rebuild -f -w better-sqlite3
```

## Test Data

Test data is stored separately to avoid conflicts with development data:

- Database: `storyboard-test.db`
- Store: `test-config.json`

## Continuous Improvement

- Add tests for new features
- Maintain or improve coverage
- Update tests for bug fixes
- Review and refine test utilities
