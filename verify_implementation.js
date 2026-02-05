#!/usr/bin/env node

/**
 * StoryboardGen AI API Implementation Verification Script
 *
 * This script verifies that all required dependencies are installed
 * and that the API integration modules are properly structured.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 StoryboardGen AI API Implementation Verification\n');

let passedTests = 0;
let failedTests = 0;

// Test 1: Check if required packages are installed
console.log('📦 Checking installed packages...');
const packageJson = require('./package.json');
const requiredPackages = [
  'openai',
  '@google/generative-ai',
  'replicate',
  'axios',
  'electron-store',
  'better-sqlite3'
];

requiredPackages.forEach(pkg => {
  try {
    require.resolve(pkg);
    console.log(`✅ ${pkg} is installed`);
    passedTests++;
  } catch (e) {
    console.log(`❌ ${pkg} is NOT installed`);
    failedTests++;
  }
});

console.log('');

// Test 2: Check if main files exist
console.log('📄 Checking main files...');
const requiredFiles = [
  'electron/api-handlers.js',
  'electron/database.js',
  'electron/main.js',
  'package.json'
];

requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file} exists`);
    passedTests++;
  } else {
    console.log(`❌ ${file} does NOT exist`);
    failedTests++;
  }
});

console.log('');

// Test 3: Check API handlers file structure
console.log('🔧 Checking API handlers structure...');
const apiHandlersPath = path.join(__dirname, 'electron/api-handlers.js');
if (fs.existsSync(apiHandlersPath)) {
  const apiHandlersContent = fs.readFileSync(apiHandlersPath, 'utf8');

  const requiredFunctions = [
    'setupAPIHandlers',
    'generateWithOpenAI',
    'generateWithGemini',
    'generateWithReplicate',
    'parsePanelDescriptions',
    'downloadAndConvertImage',
    'ProgressTracker',
    'setDatabase'
  ];

  requiredFunctions.forEach(func => {
    if (apiHandlersContent.includes(func)) {
      console.log(`✅ Function '${func}' is defined`);
      passedTests++;
    } else {
      console.log(`❌ Function '${func}' is NOT defined`);
      failedTests++;
    }
  });
} else {
  console.log('❌ Cannot check API handlers - file not found');
  failedTests++;
}

console.log('');

// Test 4: Check database file structure
console.log('💾 Checking database structure...');
const databasePath = path.join(__dirname, 'electron/database.js');
if (fs.existsSync(databasePath)) {
  const databaseContent = fs.readFileSync(databasePath, 'utf8');

  const requiredFunctions = [
    'setupDatabase',
    'getDb',
    'setupDatabaseHandlers'
  ];

  requiredFunctions.forEach(func => {
    // More flexible search - check for function declaration or assignment
    const isPresent = databaseContent.includes(`function ${func}`) ||
                     databaseContent.includes(`${func} =`) ||
                     databaseContent.includes(`${func}(`);

    if (isPresent) {
      console.log(`✅ Function '${func}' is defined`);
      passedTests++;
    } else {
      console.log(`❌ Function '${func}' is NOT defined`);
      failedTests++;
    }
  });
} else {
  console.log('❌ Cannot check database - file not found');
  failedTests++;
}

console.log('');

// Test 5: Check main.js file structure
console.log('🚀 Checking main process structure...');
const mainPath = path.join(__dirname, 'electron/main.js');
if (fs.existsSync(mainPath)) {
  const mainContent = fs.readFileSync(mainPath, 'utf8');

  const requiredImports = [
    'setupDatabase',
    'getDb',
    'setupAPIHandlers',
    'setDatabase'
  ];

  requiredImports.forEach(func => {
    if (mainContent.includes(func)) {
      console.log(`✅ Import '${func}' is present`);
      passedTests++;
    } else {
      console.log(`❌ Import '${func}' is NOT present`);
      failedTests++;
    }
  });
} else {
  console.log('❌ Cannot check main process - file not found');
  failedTests++;
}

console.log('');

// Test 6: Check for required API integrations
console.log('🤖 Checking API integrations...');
const apiHandlersContent = fs.readFileSync(apiHandlersPath, 'utf8');

const apiIntegrations = [
  { name: 'OpenAI', patterns: ['new OpenAI', 'dall-e-3', 'openai.images.generate'] },
  { name: 'Google Gemini', patterns: ['GoogleGenerativeAI', 'imagen-3', 'generateImage'] },
  { name: 'Replicate', patterns: ['new Replicate', 'stable-diffusion', 'replicate.run'] }
];

apiIntegrations.forEach(api => {
  const allFound = api.patterns.every(pattern => apiHandlersContent.includes(pattern));
  if (allFound) {
    console.log(`✅ ${api.name} integration is implemented`);
    passedTests++;
  } else {
    console.log(`❌ ${api.name} integration is incomplete`);
    failedTests++;
  }
});

console.log('');

// Test 7: Check for progress tracking features
console.log('📊 Checking progress tracking features...');
const progressFeatures = [
  'ProgressTracker',
  'sendProgress',
  'updatePanelStatus',
  'calculateProgress',
  'calculateETA',
  'getPanelStats'
];

progressFeatures.forEach(feature => {
  if (apiHandlersContent.includes(feature)) {
    console.log(`✅ Progress feature '${feature}' is implemented`);
    passedTests++;
  } else {
    console.log(`❌ Progress feature '${feature}' is NOT implemented`);
    failedTests++;
  }
});

console.log('');

// Test 8: Check for error handling
console.log('⚠️  Checking error handling...');
const errorHandlingFeatures = [
  'try {',
  'catch',
  'throw new Error',
  'retry',
  'rate limit',
  '429'
];

errorHandlingFeatures.forEach(feature => {
  if (apiHandlersContent.includes(feature)) {
    console.log(`✅ Error handling '${feature}' is present`);
    passedTests++;
  } else {
    console.log(`❌ Error handling '${feature}' is NOT present`);
    failedTests++;
  }
});

console.log('');

// Final summary
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`✅ Passed Tests: ${passedTests}`);
console.log(`❌ Failed Tests: ${failedTests}`);
console.log(`📊 Success Rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (failedTests === 0) {
  console.log('\n🎉 All tests passed! The implementation is ready for testing.\n');
  process.exit(0);
} else {
  console.log('\n⚠️  Some tests failed. Please review the issues above.\n');
  process.exit(1);
}