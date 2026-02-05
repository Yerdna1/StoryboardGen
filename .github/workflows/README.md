# GitHub Actions CI/CD Workflows

This directory contains automated workflows for building, testing, and releasing StoryboardGen.

## Workflows

### 1. CI (Continuous Integration)
**File:** `ci.yml`
**Triggers:** On every push and pull request to main/develop branches
**Purpose:** Run automated tests, linting, and security scans

**Jobs:**
- **Lint and Test**: Runs code formatting checks, linting, and unit tests with coverage
- **Integration Tests**: Tests on multiple OS and Node.js versions
- **Security Scan**: Runs npm audit and CodeQL analysis

### 2. Build and Release
**File:** `build-and-release.yml`
**Triggers:**
- Push to main branch
- Creating a version tag (v*)
- Manual workflow dispatch

**Jobs:**
- **Test**: Runs the test suite
- **Build**: Creates distributable packages for Windows, macOS, and Linux
- **Release**: Creates a GitHub release with all artifacts (only on tags)

## How to Use

### Creating a Release

1. Update the version in `package.json`
2. Commit your changes:
   ```bash
   git add package.json
   git commit -m "Bump version to v1.0.1"
   ```
3. Create a tag:
   ```bash
   git tag v1.0.1
   git push origin main --tags
   ```
4. The workflow will automatically:
   - Run tests
   - Build for all platforms
   - Create a draft release with all artifacts

### Manual Build

You can trigger a build manually from the Actions tab on GitHub:
1. Go to Actions tab
2. Select "Build and Release" workflow
3. Click "Run workflow"
4. Select the branch and click "Run workflow"

## Build Artifacts

The workflow produces these artifacts:

**Windows:**
- `.exe` installer (NSIS)
- `.msi` installer (if configured)

**macOS:**
- `.dmg` disk image
- `.zip` archive

**Linux:**
- `.AppImage` universal package
- `.deb` package (Debian/Ubuntu)
- `.rpm` package (RedHat/Fedora)

## Requirements

For local builds, you need:
- Node.js 18 or higher
- Platform-specific tools:
  - **Windows**: Windows SDK
  - **macOS**: Xcode Command Line Tools
  - **Linux**: rpm, dpkg-dev

## Secrets

The workflows use these GitHub secrets:
- `GITHUB_TOKEN`: Automatically provided by GitHub
- `CODECOV_TOKEN`: (Optional) For code coverage reports

## Troubleshooting

### Icon Generation Issues
- Windows: The .ico file is a placeholder. Use a proper ICO converter for production
- macOS: The workflow tries to generate .icns automatically using iconutil

### Build Failures
- Check the Node.js version matches your local environment
- Ensure all dependencies are properly listed in package.json
- For Linux builds, make sure native dependencies are installed

### Testing Issues
- Tests run with `--passWithNoTests` flag to prevent failures on empty test suites
- Integration tests use xvfb on Linux for headless testing