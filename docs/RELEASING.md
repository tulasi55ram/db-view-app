# Releasing DBView Desktop

This guide explains how to release new versions of DBView Desktop.

## Quick Release

```bash
# 1. Update version in package.json
cd apps/desktop
npm version 1.0.0 --no-git-tag-version

# 2. Commit and tag
git add apps/desktop/package.json
git commit -m "chore: release v1.0.0"
git tag v1.0.0

# 3. Push (triggers automated release)
git push origin main
git push origin v1.0.0
```

That's it! GitHub Actions will build and publish automatically.

---

## Detailed Release Process

### Step 1: Prepare the Release

#### Update Version Number

Edit `apps/desktop/package.json`:

```json
{
  "name": "@dbview/desktop",
  "version": "1.0.0",  // ← Update this
  ...
}
```

Or use npm:

```bash
cd apps/desktop
npm version 1.0.0 --no-git-tag-version
```

#### Version Numbering

Follow [Semantic Versioning](https://semver.org/):

| Version | When to Use |
|---------|-------------|
| `1.0.0` → `1.0.1` | Bug fixes, patches |
| `1.0.0` → `1.1.0` | New features, backwards compatible |
| `1.0.0` → `2.0.0` | Breaking changes |
| `1.0.0-beta.1` | Pre-release beta |
| `1.0.0-alpha.1` | Pre-release alpha |

### Step 2: Update Changelog (Optional)

Create or update `CHANGELOG.md`:

```markdown
## [1.0.0] - 2024-01-15

### Added
- New feature X
- New feature Y

### Fixed
- Bug fix A
- Bug fix B

### Changed
- Improved performance of Z
```

### Step 3: Commit Changes

```bash
git add apps/desktop/package.json
git add CHANGELOG.md  # if updated
git commit -m "chore: release v1.0.0"
```

### Step 4: Create Git Tag

```bash
# Standard release
git tag v1.0.0

# With annotation (recommended)
git tag -a v1.0.0 -m "Release version 1.0.0"

# Pre-release
git tag v1.0.0-beta.1
```

### Step 5: Push to GitHub

```bash
# Push commits
git push origin main

# Push tag (triggers release workflow)
git push origin v1.0.0
```

### Step 6: Monitor the Release

1. Go to **GitHub → Actions** tab
2. Watch the "Release Desktop App" workflow
3. Wait for all jobs to complete (usually 10-15 minutes)

### Step 7: Verify the Release

1. Go to **GitHub → Releases**
2. Find the new release
3. Verify all assets are present:
   - `DBView-1.0.0-universal.dmg` (macOS)
   - `DBView-1.0.0-universal.zip` (macOS)
   - `DBView-1.0.0-Setup.exe` (Windows)
   - `DBView-1.0.0.AppImage` (Linux)
   - `DBView-1.0.0.deb` (Linux)
   - `latest-mac.yml`
   - `latest.yml`
   - `latest-linux.yml`

4. Edit release notes if needed
5. Download and test on each platform

---

## Release Types

### Standard Release

```bash
git tag v1.0.0
git push origin v1.0.0
```

- Marked as "Latest Release"
- Auto-updater notifies users
- Visible on releases page

### Pre-Release (Beta/Alpha)

```bash
git tag v1.0.0-beta.1
git push origin v1.0.0-beta.1
```

- Marked as "Pre-release"
- Auto-updater ignores by default
- For testing with early adopters

### Hotfix Release

```bash
# Create hotfix branch from last release
git checkout -b hotfix/1.0.1 v1.0.0

# Make fixes
git commit -m "fix: critical bug"

# Tag and push
git tag v1.0.1
git push origin hotfix/1.0.1
git push origin v1.0.1

# Merge back to main
git checkout main
git merge hotfix/1.0.1
git push origin main
```

---

## Manual Release (Alternative)

If you need to trigger a release without a tag:

1. Go to **GitHub → Actions**
2. Select **"Release Desktop App"**
3. Click **"Run workflow"**
4. Enter version (e.g., `1.0.0`)
5. Check "prerelease" if applicable
6. Click **"Run workflow"**

---

## Troubleshooting

### Release workflow failed

1. Check the Actions tab for error logs
2. Common issues:
   - Missing dependencies
   - Build errors
   - Signing certificate issues

### Assets missing from release

1. Check individual build jobs
2. The platform may have failed to build
3. Re-run failed jobs or create a new release

### Auto-updater not detecting new version

1. Verify `latest*.yml` files are in the release
2. Check version is higher than current
3. Clear updater cache on client:
   - macOS: `~/Library/Caches/dbview-updater`
   - Windows: `%LOCALAPPDATA%\dbview-updater`

### Build fails on specific platform

**macOS:**
```bash
# Test locally
cd apps/desktop
pnpm exec electron-builder --mac --publish never
```

**Windows:**
```bash
pnpm exec electron-builder --win --publish never
```

**Linux:**
```bash
pnpm exec electron-builder --linux --publish never
```

---

## Code Signing (Production)

For production releases, set up code signing to avoid security warnings.

### macOS

Add these secrets to GitHub:

| Secret | Description |
|--------|-------------|
| `MAC_CERTIFICATE` | Base64-encoded .p12 certificate |
| `MAC_CERTIFICATE_PASSWORD` | Certificate password |
| `APPLE_ID` | Apple ID email |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password |
| `APPLE_TEAM_ID` | Developer Team ID |

### Windows

| Secret | Description |
|--------|-------------|
| `WIN_CERTIFICATE` | Base64-encoded .pfx certificate |
| `WIN_CERTIFICATE_PASSWORD` | Certificate password |

---

## Release Checklist

Before releasing:

- [ ] All tests pass
- [ ] Version updated in `package.json`
- [ ] Changelog updated (if applicable)
- [ ] Tested on at least one platform locally
- [ ] No uncommitted changes

After releasing:

- [ ] All platform builds succeeded
- [ ] All assets present in GitHub Release
- [ ] Downloaded and tested installers
- [ ] Auto-updater working (test from previous version)
- [ ] Release notes are accurate

---

## Rollback

If a release has critical issues:

### Option 1: Delete and Re-release

```bash
# Delete the tag locally and remotely
git tag -d v1.0.0
git push origin :refs/tags/v1.0.0

# Delete the GitHub release manually

# Fix issues, then re-release
git tag v1.0.0
git push origin v1.0.0
```

### Option 2: Quick Hotfix

```bash
# Release a patch immediately
git tag v1.0.1
git push origin v1.0.1
```

The auto-updater will prompt users to update to the fixed version.
