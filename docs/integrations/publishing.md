# NPM Publishing & CI/CD

Automated release workflow for publishing claudekit to NPM via GitHub Actions.

## Prerequisites

- NPM account at [npmjs.com](https://www.npmjs.com)
- GitHub repository with Actions enabled
- Node.js 20+

## NPM Token Setup

### 1. Generate NPM Access Token

1. Log in to [npmjs.com](https://www.npmjs.com)
2. Go to profile settings → "Access Tokens"
3. Click "Generate New Token" → select "Automation" type
4. Copy the generated token

### 2. Add to GitHub Secrets

1. Go to repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `NPM_TOKEN`, Value: paste the token

## Release Workflows

### Version Workflow (`.github/workflows/version.yml`)
- **Trigger**: Manual dispatch from GitHub Actions tab
- **Options**: patch, minor, or major version bump
- **Process**: Run tests → bump version → create git tag → push

### Release Workflow (`.github/workflows/release.yml`)
- **Trigger**: Automatically when version tags (v*) are pushed
- **Process**: Run tests → build → publish to NPM → create GitHub release

### Usage

1. Go to GitHub Actions → "Version" workflow → "Run workflow"
2. Choose version bump type (patch/minor/major)
3. Release workflow triggers automatically after tag push

## Manual Release

```bash
# Using release script
./scripts/release.sh --dry-run     # Preview
./scripts/release.sh               # Patch release
./scripts/release.sh --type minor  # Minor release

# Manual steps
git checkout main && git pull
npm run test:ci && npm run build
npm version patch
npm publish --access public
git push origin main --tags
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 403 Forbidden | Check NPM token permissions and expiry |
| Version exists | Bump version number first |
| Build failures | Run `npm run test:ci` and `npm run build` locally |
| Token auth failed | Regenerate token and update GitHub secret |

## Security

- Use "Automation" tokens for CI/CD only
- Never commit tokens to git
- Rotate tokens regularly
