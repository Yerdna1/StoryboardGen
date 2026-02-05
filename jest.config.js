module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/jest.setup.tsx'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^electron/(.*)$': '<rootDir>/electron/$1',
    '^@mui/material': '@mui/material',
    '^@mui/icons-material': '@mui/icons-material',
    '^@mui/system': '@mui/system',
  },
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
  },
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/*.(test|spec).[jt]s?(x)',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/build/',
    '/dist/',
    '/e2e/',
    '/electron/',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(axios|replicate|openai|@google/generative-ai|@huggingface/inference|@mui|@emotion)/)',
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    'electron/**/*.js',
    '!src/**/*.d.ts',
    '!src/jest.setup.js',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
};
