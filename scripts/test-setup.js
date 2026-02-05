/**
 * Test Setup Verification Script
 * Verifies that the testing infrastructure is properly configured
 */

const path = require('path');
const fs = require('fs');

console.log('🔍 Verifying StoryboardGen Test Setup\n');

let allChecksPassed = true;

// Check required directories
const requiredDirs = [
  'src/components/__tests__',
  'electron/__tests__',
  'e2e/specs',
];

console.log('📁 Checking required directories...');
requiredDirs.forEach(dir => {
  const fullPath = path.join(__dirname, '..', dir);
  if (fs.existsSync(fullPath)) {
    console.log(`  ✅ ${dir}`);
  } else {
    console.log(`  ❌ ${dir} (missing)`);
    allChecksPassed = false;
  }
});

// Check configuration files
const requiredConfigs = [
  'jest.config.js',
  'babel.config.js',
  'src/jest.setup.js',
  'package.json',
];

console.log('\n⚙️  Checking configuration files...');
requiredConfigs.forEach(config => {
  const fullPath = path.join(__dirname, '..', config);
  if (fs.existsSync(fullPath)) {
    console.log(`  ✅ ${config}`);
  } else {
    console.log(`  ❌ ${config} (missing)`);
    allChecksPassed = false;
  }
});

// Check test dependencies in package.json
console.log('\n📦 Checking test dependencies...');
const packageJson = require('../package.json');
const requiredDeps = [
  '@testing-library/react',
  '@testing-library/jest-dom',
  '@testing-library/user-event',
  'jest',
  'jest-environment-jsdom',
  'electron-mocha',
  'chai',
  'supertest',
];

let allDepsPresent = true;
requiredDeps.forEach(dep => {
  const isDevDep = packageJson.devDependencies && dep in packageJson.devDependencies;
  const isDep = packageJson.dependencies && dep in packageJson.dependencies;

  if (isDevDep || isDep) {
    console.log(`  ✅ ${dep}`);
  } else {
    console.log(`  ❌ ${dep} (missing)`);
    allDepsPresent = false;
  }
});

if (!allDepsPresent) {
  allChecksPassed = false;
}

// Check test scripts
console.log('\n📜 Checking test scripts...');
const testScripts = [
  'test',
  'test:watch',
  'test:coverage',
  'test:unit',
  'test:integration',
  'test:e2e',
];

let allScriptsPresent = true;
testScripts.forEach(script => {
  if (packageJson.scripts && script in packageJson.scripts) {
    console.log(`  ✅ npm run ${script}`);
  } else {
    console.log(`  ❌ npm run ${script} (missing)`);
    allScriptsPresent = false;
  }
});

if (!allScriptsPresent) {
  allChecksPassed = false;
}

// Count test files
console.log('\n📊 Counting test files...');

const testPatterns = [
  { pattern: '**/*.test.tsx', name: 'React Component Tests' },
  { pattern: '**/*.test.js', name: 'Integration Tests' },
  { pattern: 'e2e/specs/*.js', name: 'E2E Test Specs' },
];

testPatterns.forEach(({ pattern, name }) => {
  const { glob } = require('glob');
  const files = glob.sync(pattern, { cwd: path.join(__dirname, '..') });
  console.log(`  ${name}: ${files.length} files`);
  files.forEach(file => {
    console.log(`    - ${file}`);
  });
});

// Summary
console.log('\n' + '='.repeat(50));
if (allChecksPassed) {
  console.log('✅ Test setup is complete!');
  console.log('\nYou can now run tests with:');
  console.log('  npm test              # Run all tests');
  console.log('  npm run test:watch     # Watch mode');
  console.log('  npm run test:coverage  # With coverage');
  console.log('  npm run test:unit      # Unit tests only');
  console.log('  npm run test:integration # Integration tests');
  console.log('  npm run test:e2e        # E2E tests');
} else {
  console.log('❌ Test setup has issues. Please review the output above.');
  console.log('\nTo fix issues:');
  console.log('  1. Ensure all required directories exist');
  console.log('  2. Install missing dependencies: npm install');
  console.log('  3. Verify jest.config.js and babel.config.js are correct');
}
console.log('='.repeat(50));

process.exit(allChecksPassed ? 0 : 1);
