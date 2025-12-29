# CI/CD Pipeline Documentation

DBView uses GitHub Actions for continuous integration and deployment. This document covers the workflows, configuration, and release process.

## Workflows Overview

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | Push/PR to main, develop | Lint, type check, test, build |
| `release.yml` | Version tag (v*) or manual | Build & publish releases |

## CI Workflow (`ci.yml`)

Runs on every push and pull request to `main` and `develop` branches.

### Jobs

#### 1. Lint & Type Check
- Runs ESLint
- Type checks all TypeScript packages
- Runs on Ubuntu

#### 2. Build Desktop
- Builds the desktop app for all platforms
- Runs in parallel on macOS, Ubuntu, Windows
- Uploads build artifacts (retained for 7 days)

#### 3. Test
- Runs the test suite
- Currently allows failures (WIP)

### Triggering CI

CI runs automatically on:
- Push to `main` or `develop`
- Pull requests targeting `main` or `develop`

## Release Workflow (`release.yml`)

Builds and publishes the desktop app to GitHub Releases.

### Trigger Options

#### 1. Version Tag (Recommended)
```bash
# Create and push a version tag
git tag v1.0.0
git push origin v1.0.0
```

#### 2. Manual Dispatch
1. Go to Actions > Release Desktop App
2. Click "Run workflow"
3. Enter version (e.g., `1.0.0`)
4. Check "prerelease" if applicable
5. Click "Run workflow"

### Release Process

```
┌─────────────────────────────────────────────────────────────────┐
│                     Release Workflow                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Create Release (Draft)                                       │
│     └─► Creates GitHub release in draft state                   │
│                                                                  │
│  2. Build (Parallel)                                             │
│     ├─► macOS: .dmg, .zip (universal: x64 + arm64)             │
│     ├─► Windows: .exe (x64)                                     │
│     └─► Linux: .AppImage, .deb (x64)                            │
│                                                                  │
│  3. Upload Artifacts                                             │
│     └─► Uploads all installers + latest.yml files               │
│                                                                  │
│  4. Publish Release                                              │
│     └─► Marks release as non-draft (visible to users)           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Build Artifacts

| Platform | Files Generated |
|----------|----------------|
| macOS | `DBView-{version}-universal.dmg`, `DBView-{version}-universal.zip`, `latest-mac.yml` |
| Windows | `DBView-{version}-Setup.exe`, `latest.yml` |
| Linux | `DBView-{version}.AppImage`, `DBView-{version}.deb`, `latest-linux.yml` |

## Code Signing (Optional)

For production releases, code signing is recommended to avoid security warnings.

### macOS Code Signing

Required secrets:
```
MAC_CERTIFICATE          # Base64-encoded .p12 certificate
MAC_CERTIFICATE_PASSWORD # Certificate password
APPLE_ID                 # Apple ID email
APPLE_APP_SPECIFIC_PASSWORD # App-specific password
APPLE_TEAM_ID            # Apple Developer Team ID
```

Setup:
1. Export your Developer ID certificate as .p12
2. Base64 encode it: `base64 -i certificate.p12 | pbcopy`
3. Add as `MAC_CERTIFICATE` secret
4. Add other secrets

### Windows Code Signing

Required secrets:
```
WIN_CERTIFICATE          # Base64-encoded .pfx certificate
WIN_CERTIFICATE_PASSWORD # Certificate password
```

Setup:
1. Purchase a code signing certificate (e.g., DigiCert, Sectigo)
2. Export as .pfx file
3. Base64 encode it: `base64 -i certificate.pfx`
4. Add as secrets

## Repository Secrets

Go to Settings > Secrets and variables > Actions to add:

| Secret | Required | Description |
|--------|----------|-------------|
| `GITHUB_TOKEN` | Auto | Automatically provided by GitHub |
| `MAC_CERTIFICATE` | Optional | macOS code signing certificate |
| `MAC_CERTIFICATE_PASSWORD` | Optional | macOS certificate password |
| `APPLE_ID` | Optional | Apple ID for notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | Optional | App-specific password |
| `APPLE_TEAM_ID` | Optional | Apple Developer Team ID |
| `WIN_CERTIFICATE` | Optional | Windows code signing certificate |
| `WIN_CERTIFICATE_PASSWORD` | Optional | Windows certificate password |

## How to Release

### Standard Release

1. **Update version** in `apps/desktop/package.json`:
   ```json
   {
     "version": "1.0.0"
   }
   ```

2. **Commit the change**:
   ```bash
   git add apps/desktop/package.json
   git commit -m "chore: bump version to 1.0.0"
   ```

3. **Create and push tag**:
   ```bash
   git tag v1.0.0
   git push origin main
   git push origin v1.0.0
   ```

4. **Monitor the release**:
   - Go to Actions tab to watch progress
   - Once complete, check Releases for the new version

### Pre-release (Beta/Alpha)

```bash
# Beta release
git tag v1.0.0-beta.1
git push origin v1.0.0-beta.1

# Alpha release
git tag v1.0.0-alpha.1
git push origin v1.0.0-alpha.1
```

Pre-releases are automatically marked as such in GitHub.

### Hotfix Release

```bash
# Create hotfix branch
git checkout -b hotfix/1.0.1 v1.0.0

# Make fixes, then tag
git tag v1.0.1
git push origin hotfix/1.0.1
git push origin v1.0.1
```

## Auto-Updater Integration

The release workflow generates `latest.yml`, `latest-mac.yml`, and `latest-linux.yml` files that the auto-updater uses to check for updates.

When a new release is published:
1. GitHub Release is created with all installers
2. `latest*.yml` files contain version info and checksums
3. Desktop app checks these files to detect updates
4. Users are notified and can update

## Troubleshooting

### Build fails on macOS

1. Check if native modules need rebuilding
2. Ensure electron-rebuild runs during install
3. Check macOS runner version compatibility

### Build fails on Windows

1. Long path issues: Enable long paths in Windows
2. Native module issues: Check node-gyp requirements
3. Signing issues: Verify certificate is valid

### Build fails on Linux

1. Missing dependencies: Check if libsecret-1-dev is installed
2. AppImage issues: Ensure FUSE is available

### Release not visible

1. Check if workflow completed successfully
2. Verify the release was published (not draft)
3. Check if tag was pushed correctly

## Local Testing

Test the build locally before pushing:

```bash
# Build for current platform
cd apps/desktop
pnpm build
pnpm exec electron-builder --dir

# Build installer
pnpm exec electron-builder --mac  # or --win, --linux
```

## Performance Optimization

### Caching

The workflows use pnpm caching to speed up builds:
- Dependencies are cached based on `pnpm-lock.yaml`
- Subsequent builds reuse the cache

### Parallel Builds

Platform builds run in parallel:
- macOS, Windows, Linux build simultaneously
- Reduces total release time significantly

## Monitoring

### GitHub Actions Dashboard
- View all workflow runs
- Check individual job logs
- Download artifacts

### Release Health
- Monitor download counts in Releases
- Check auto-updater logs for issues
- Monitor GitHub Issues for user reports
