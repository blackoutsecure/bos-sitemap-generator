# Blackout Secure Sitemap Generator

**Copyright © 2025-2026 Blackout Secure | Apache License 2.0**

[![Marketplace](https://img.shields.io/badge/GitHub%20Marketplace-blue?logo=github)](https://github.com/marketplace/actions/blackout-secure-sitemap-generator)
[![GitHub release](https://img.shields.io/github/v/release/blackoutsecure/bos-sitemap-generator?sort=semver)](https://github.com/blackoutsecure/bos-sitemap-generator/releases)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)
[![Made by BlackoutSecure](https://img.shields.io/badge/made%20by-BlackoutSecure-1f1f1f)](https://github.com/blackoutsecure)

Enterprise-grade automated sitemap generation (XML/TXT/GZIP) for static sites, SSG frameworks (Next.js, Gatsby, Hugo, Jekyll), and dynamic applications. Built for reliability, performance, and SEO best practices.

## ✨ Features

- **Multiple Formats**: XML, TXT, and GZIP compressed sitemaps
- **Smart Discovery**: Auto-detect site URLs and directories
- **Framework Support**: Works with Next.js, Gatsby, Hugo, Jekyll, Vite, and more
- **SEO Optimized**: Canonical URL parsing, link discovery, lastmod timestamps
- **Layered Configuration**: Bundled marketplace baseline → org global config → repo config → action inputs
- **Sitemap & SEO Audit**: 19 evidence-based controls with per-rule `fail`/`warn`/`skip` severities
- **Enterprise Reporting**: Markdown step summary, SARIF 2.1.0 for code scanning, JSON report, and recommendations sidecar
- **AI Findings Summary**: Optional GitHub Models summary with a deterministic local fallback
- **Local CLI**: `bos-sitemap validate|audit|sarif` reproduces CI output on your machine
- **Validation**: Built-in validation against sitemaps.org protocol
- **Large Sites**: Auto-splitting for sites with 50,000+ URLs
- **Flexible**: Customizable patterns, exclusions, and priorities
- **Git Integration**: Last modified dates from git history
- **No Build Required**: Can validate existing sitemaps without generation

## 📋 Prerequisites

- GitHub Actions environment (Ubuntu, macOS, or Windows)
- Built site files (HTML, CSS, JS, etc.)
- For git-based lastmod: `fetch-depth: 0` in checkout step

## 🚀 Quick Start

### Basic Usage

```yaml
name: Generate Sitemap

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  sitemap:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Required for git-based lastmod

      - name: Build your site
        run: npm run build # or your build command

      - name: Generate sitemap
        uses: blackoutsecure/bos-sitemap-generator@v1
        with:
          site_url: 'https://example.com'
          public_dir: 'dist'
```

## 📖 Examples

### Next.js Static Export

```yaml
- name: Build Next.js site
  run: npm run build

- name: Generate sitemap
  uses: blackoutsecure/bos-sitemap-generator@v1
  with:
    site_url: 'https://example.com'
    public_dir: 'out'
    lastmod_strategy: 'git'
```

### Gatsby

```yaml
- name: Build Gatsby site
  run: npm run build

- name: Generate sitemap
  uses: blackoutsecure/bos-sitemap-generator@v1
  with:
    site_url: 'https://example.com'
    public_dir: 'public'
```

### Hugo

```yaml
- name: Build Hugo site
  run: hugo --minify

- name: Generate sitemap
  uses: blackoutsecure/bos-sitemap-generator@v1
  with:
    site_url: 'https://example.com'
    public_dir: 'public'
```

### Jekyll

```yaml
- name: Build Jekyll site
  run: bundle exec jekyll build

- name: Generate sitemap
  uses: blackoutsecure/bos-sitemap-generator@v1
  with:
    site_url: 'https://example.com'
    public_dir: '_site'
```

### Vite

```yaml
- name: Build Vite project
  run: npm run build

- name: Generate sitemap
  uses: blackoutsecure/bos-sitemap-generator@v1
  with:
    site_url: 'https://example.com'
    public_dir: 'dist'
```

### Advanced: Custom Patterns and Exclusions

```yaml
- name: Generate sitemap with custom rules
  uses: blackoutsecure/bos-sitemap-generator@v1
  with:
    site_url: 'https://example.com'
    public_dir: 'dist'
    include_patterns: '**/*.html,**/*.htm,**/*.php'
    exclude_patterns: '**/*.map,**/drafts/**,**/private/**'
    exclude_urls: '*/admin/*,*/test/*'
    changefreq: 'weekly'
    priority: '0.8'
```

### Additional URLs

Include non-HTML pages or external resources:

```yaml
- name: Generate sitemap with additional URLs
  uses: blackoutsecure/bos-sitemap-generator@v1
  with:
    site_url: 'https://example.com'
    public_dir: 'dist'
    additional_urls: 'https://example.com/api,https://example.com/app'
```

### Disable TXT Format

```yaml
- name: Generate XML sitemap only
  uses: blackoutsecure/bos-sitemap-generator@v1
  with:
    site_url: 'https://example.com'
    public_dir: 'dist'
    generate_sitemap_txt: 'false'
```

## ⚙️ Configuration

### Required Inputs

| Input      | Description                  | Example               |
| ---------- | ---------------------------- | --------------------- |
| `site_url` | Public base URL of your site | `https://example.com` |

### Common Inputs

| Input                   | Description                           | Default              |
| ----------------------- | ------------------------------------- | -------------------- |
| `public_dir`            | Directory containing built site files | `dist`               |
| `sitemap_output_dir`    | Where to write sitemap files          | Same as `public_dir` |
| `include_patterns`      | Glob patterns to include              | `**/*.html,**/*.htm` |
| `exclude_patterns`      | Glob patterns to exclude              | `**/*.map`           |
| `lastmod_strategy`      | Source for lastmod dates              | `git`                |
| `generate_sitemap_gzip` | Create gzipped version                | `true`               |
| `generate_sitemap_txt`  | Create TXT format                     | `true`               |

### SEO Inputs

| Input             | Description                    | Valid Values                                                        |
| ----------------- | ------------------------------ | ------------------------------------------------------------------- |
| `changefreq`      | How often pages change         | `always`, `hourly`, `daily`, `weekly`, `monthly`, `yearly`, `never` |
| `priority`        | Relative priority on your site | `0.0` to `1.0`                                                      |
| `parse_canonical` | Use canonical URLs from HTML   | `true` (default)                                                    |
| `discover_links`  | Auto-discover internal links   | `true` (default)                                                    |

### Advanced Inputs

| Input                | Description                | Default                                                |
| -------------------- | -------------------------- | ------------------------------------------------------ |
| `additional_urls`    | Extra URLs to include      | -                                                      |
| `exclude_urls`       | URL patterns to exclude    | `*/sitemap*.xml,*/sitemap*.txt,*/sitemap*.xml.gz`      |
| `exclude_extensions` | File extensions to exclude | `.zip,.exe,.dmg,.pkg,.deb,.rpm,.tar,.gz,.7z,.rar,.iso` |
| `sitemap_filename`   | Main sitemap filename      | `sitemap.xml`                                          |
| `validate_sitemaps`  | Validate existing sitemaps | -                                                      |
| `strict_validation`  | Fail on validation issues  | `true`                                                 |

### Audit & Reporting Inputs

| Input                    | Description                                              | Default                                                       |
| ------------------------ | -------------------------------------------------------- | ------------------------------------------------------------- |
| `config_path`            | Explicit repository config file                          | auto-discover                                                 |
| `global_config_path`     | Organization-level global config                         | `.github/blackout-secure-sitemap-generator-global-config.yml` |
| `use_global_config`      | Global tier: `auto`, `true` (require), `false` (disable) | `auto`                                                        |
| `use_marketplace_config` | Apply the bundled marketplace baseline                   | `true`                                                        |
| `enable_audit`           | Run the sitemap/SEO posture audit                        | `true`                                                        |
| `audit_fail_on`          | `fail` or `never`; empty uses `sitemap.audit.fail_on`    | from config                                                   |
| `sarif_output`           | Write SARIF 2.1.0 for GitHub code scanning               | disabled                                                      |
| `report_json`            | Write the machine-readable JSON audit report             | disabled                                                      |
| `redact_sensitive`       | Redact credential-shaped values from report surfaces     | true                                                          |
| `redaction_placeholder`  | Replacement text for redacted values                     | `***`                                                         |
| `recommendations_json`   | Write structured remediation recommendations             | disabled                                                      |
| `skips_json`             | Write the skipped-controls sidecar                       | disabled                                                      |
| `step_summary`           | Append the Markdown report to `$GITHUB_STEP_SUMMARY`     | `true`                                                        |
| `enable_ai_summary`      | Generate a natural-language findings summary             | `true`                                                        |
| `ai_provider`            | `auto`, `none`, or a named provider                      | `auto`                                                        |

### lastmod Strategy Options

- `git` - Use git commit timestamp (requires `fetch-depth: 0`)
- `filemtime` - Use file modification time
- `current` - Use build/generation time
- `none` - Omit lastmod tag

## 🗂️ Layered Configuration

Configuration is deep-merged, then validated. Precedence, lowest to highest:

1. **Bundled marketplace baseline** — `src/marketplace-config.json`, shipped with the action
2. **Organization global config** — `.github/blackout-secure-sitemap-generator-global-config.yml`
3. **Repository config** — first match of `.github/bos-universal-config.json|yml|yaml`, `bos-universal-config.*`, or `.bos-sitemap.yml|yaml`
4. **Action inputs** — any input you explicitly set wins over every config tier

Unknown top-level keys are ignored so the same `bos-universal-config.json` can be
shared with other Blackout Secure kits. Unknown keys **inside** `sitemap.audit.rules`
are rejected, so a typo in a rule name fails fast instead of silently disabling a control.

```yaml
# .github/bos-universal-config.json (YAML shown for readability)
sitemap:
  owner: blackoutsecure
  project_name: example-site

  generate:
    xml: true
    txt: true
    gzip: true
    sitemap_filename: sitemap.xml

  discovery:
    parse_canonical: true
    discover_links: true
    include_patterns: ['**/*.html', '**/*.htm']
    exclude_patterns: ['**/*.map']

  seo:
    lastmod_strategy: git
    changefreq: weekly

  audit:
    enable: true
    fail_on: fail # or `never` to keep the audit advisory
    max_url_length: 2048
    min_url_count: 1
    rules:
      require_https: fail
      require_robots_sitemap_reference: fail
      require_canonical_coverage: warn

  reporting:
    step_summary: true
    sarif: true
    json_report: true
    recommendations: true

  remediation:
    enable_ai_findings_summary: true
    ai_findings_summary_provider: auto
    local_heuristic_fallback: true
```

## 🧭 Sitemap & SEO Audit

Every control is evidence-based and configurable through `sitemap.audit.rules.<name>`.
A rule set to `skip` still emits a finding, so the report records that the control was
deliberately not assessed rather than silently dropping it.

| Rule    | Config key                         | Checks                                              | Default |
| ------- | ---------------------------------- | --------------------------------------------------- | ------- |
| `SM001` | `require_robots_txt`               | robots.txt is published                             | `warn`  |
| `SM002` | `require_robots_sitemap_reference` | robots.txt declares a `Sitemap:` directive          | `warn`  |
| `SM003` | `require_404_page`                 | A custom 404 page exists                            | `skip`  |
| `SM004` | `require_security_txt`             | RFC 9116 security.txt is published                  | `skip`  |
| `SM005` | `require_humans_txt`               | humans.txt is published                             | `skip`  |
| `SM010` | `require_https`                    | Every sitemap URL uses HTTPS                        | `warn`  |
| `SM011` | `require_same_origin`              | Every URL matches the declared `site_url` origin    | `warn`  |
| `SM012` | `forbid_duplicate_urls`            | No URL appears twice                                | `warn`  |
| `SM013` | `forbid_query_strings`             | No URL carries a query string                       | `warn`  |
| `SM014` | `forbid_fragments`                 | No URL carries a fragment                           | `warn`  |
| `SM015` | `consistent_trailing_slash`        | One trailing-slash convention across the sitemap    | `warn`  |
| `SM016` | `max_url_length`                   | URLs stay within `audit.max_url_length`             | `warn`  |
| `SM017` | `forbid_noindex_urls`              | No `meta robots noindex` page is advertised         | `warn`  |
| `SM020` | `url_count_limit`                  | 50,000 URL ceiling per sitemap                      | `warn`  |
| `SM021` | `file_size_limit`                  | 50 MB uncompressed ceiling per file                 | `warn`  |
| `SM022` | `require_sitemap_index_when_split` | A sitemap index exists once the set is split        | `warn`  |
| `SM023` | `min_url_count`                    | At least `audit.min_url_count` URLs were discovered | `warn`  |
| `SM030` | `require_lastmod`                  | Every URL carries a `<lastmod>` value               | `skip`  |
| `SM031` | `require_canonical_coverage`       | Every HTML page declares a canonical URL            | `skip`  |

No rule defaults to `fail`, so adopting the audit never breaks an existing pipeline on
day one. Opt individual rules up to `fail` once your site is clean.

### Reporting example

```yaml
- name: Generate sitemap and audit SEO posture
  id: sitemap
  uses: blackoutsecure/bos-sitemap-generator@v1
  with:
    site_url: 'https://example.com'
    public_dir: 'dist'
    sarif_output: 'sitemap-audit.sarif'
    report_json: 'sitemap-audit.json'
    recommendations_json: 'sitemap-recommendations.json'
    audit_fail_on: 'fail'

- name: Upload audit findings to code scanning
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: sitemap-audit.sarif

- run: echo "Verdict: ${{ steps.sitemap.outputs.audit_verdict }}"
```

`skip` findings are intentionally omitted from SARIF — they would clutter the Security
tab with controls that were never assessed. Use `skips_json` when you need that record.

## 🤖 AI Findings Summary

When `enable_ai_summary` is on, the action asks a model for a three-bullet triage summary
of the non-passing findings and appends it to the step summary and JSON report.

- `ai_provider: auto` (default) uses **GitHub Models** whenever `GITHUB_MODELS_TOKEN` or
  `GITHUB_TOKEN` is exposed to the job. Grant `models: read` in the job permissions.
- `ai_provider: none` disables the model call.
- Any other name uses `<NAME>_API_KEY` plus `<NAME>_API_ENDPOINT` from the environment.

AI is never on the critical path: any missing credential, authorization failure, timeout,
or transport error falls back to a deterministic local summary, and the run continues.

```yaml
jobs:
  sitemap:
    permissions:
      contents: read
      models: read
      security-events: write
    steps:
      - uses: blackoutsecure/bos-sitemap-generator@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          site_url: 'https://example.com'
```

## 🖥️ Local CLI

The CLI shares every module with the Action, so a local dry-run produces the same report
as CI.

```bash
npm install

# Resolve and print the merged configuration cascade
npx bos-sitemap validate

# Audit a built site and write every report artefact
npx bos-sitemap audit \
  --site-url https://example.com \
  --public-dir dist \
  --sarif sitemap-audit.sarif \
  --json sitemap-audit.json \
  --recommendations sitemap-recommendations.json \
  --fail-on never

# Merge SARIF logs before a single code-scanning upload
npx bos-sitemap sarif --input a.sarif --input b.sarif --output merged.sarif
```

Exit codes: `0` success, `1` audit failed under the `fail` policy, `2` usage or
configuration error.

## 📤 Outputs

| Output                      | Description                                                                        |
| --------------------------- | ---------------------------------------------------------------------------------- |
| `sitemap_path`              | Path to main sitemap.xml                                                           |
| `sitemap_index_path`        | Path to sitemap index (if split)                                                   |
| `sitemap_txt_path`          | Path to TXT sitemap (if enabled)                                                   |
| `url_count`                 | Number of URLs written to the sitemap set                                          |
| `config_sources`            | Applied config tiers, in precedence order                                          |
| `audit_verdict`             | `Pass`, `Review recommended`, `Action required`, `Inconclusive`, or `Not assessed` |
| `audit_pass_count`          | Controls that passed                                                               |
| `audit_warn_count`          | Controls that warned                                                               |
| `audit_fail_count`          | Controls that failed                                                               |
| `audit_error_count`         | Controls that could not be evaluated                                               |
| `audit_skip_count`          | Controls that were not assessed                                                    |
| `sarif_path`                | Written SARIF file, when `sarif_output` is set                                     |
| `report_json_path`          | Written JSON report, when `report_json` is set                                     |
| `recommendations_json_path` | Written recommendations sidecar, when `recommendations_json` is set                |
| `ai_summary`                | Short natural-language summary of the audit findings                               |

## 🔍 Validation

The action automatically validates:

- Sitemap size limits (50MB uncompressed per sitemaps.org)
- URL count limits (50,000 URLs per file)
- XML format validity
- URL format compliance

Set `strict_validation: false` to allow warnings without failing the workflow.

### Validating Existing Sitemaps

You can use this action to validate existing sitemaps without generating new ones. This is useful for:

- Validating sitemaps from external sources
- Pre-deployment validation checks
- CI/CD quality gates

```yaml
- name: Validate existing sitemaps
  uses: blackoutsecure/bos-sitemap-generator@v1
  with:
    site_url: 'https://example.com'
    public_dir: 'dist'
    validate_sitemaps: 'dist/sitemap.xml,dist/sitemap-index.xml'
    strict_validation: 'true'
```

You can validate multiple sitemaps by providing comma-separated paths. The validator checks:

- **XML Sitemaps**: Structure, namespace, URL count, URL format, priorities, and change frequencies
- **TXT Sitemaps**: URL format, line endings, encoding
- **Sitemap Indexes**: Structure, sitemap entries, and referenced sitemap URLs
- **Size Compliance**: Uncompressed file size limits
- **Format Compliance**: sitemaps.org protocol adherence

## 📊 Large Sites

For sites with more than 50,000 URLs, the action automatically:

1. Splits URLs into multiple sitemap files
2. Creates a sitemap index file
3. Ensures each file meets protocol limits

## 🐛 Debugging

Enable debug outputs to troubleshoot:

```yaml
- name: Generate sitemap with debugging
  uses: blackoutsecure/bos-sitemap-generator@v1
  with:
    site_url: 'https://example.com'
    public_dir: 'dist'
    debug_list_files: 'true'
    debug_list_urls: 'true'
    debug_show_sitemap: 'true'
```

Available debug flags:

- `debug_list_files` - Show all discovered files
- `debug_list_canonical` - Show parsed canonical URLs
- `debug_list_urls` - Show all sitemap URLs
- `debug_show_sitemap` - Display XML content
- `debug_show_sitemap_txt` - Display TXT content
- `debug_show_exclusions` - Show excluded files/URLs

## ❓ Troubleshooting

### Issue: "No files found"

**Cause**: Build step may have failed or public_dir is incorrect.

**Solution**:

- Verify build completes successfully
- Check `public_dir` matches your build output location
- Enable `debug_list_files: 'true'` to see what's being scanned
- Verify files exist: `ls -la dist/`

### Issue: "Empty sitemap generated"

**Cause**: Include patterns don't match files, or all files are excluded.

**Solution**:

- Check `include_patterns` - default is `**/*.html,**/*.htm`
- Verify files match the pattern
- Check `exclude_patterns` and `exclude_urls` for overlaps
- Use `debug_show_exclusions: 'true'` to see what's excluded

### Issue: "Lastmod dates are all current date"

**Cause**: Git history not available or wrong strategy selected.

**Solution**:

- For `lastmod_strategy: 'git'`, ensure `fetch-depth: 0` in checkout:
  ```yaml
  - uses: actions/checkout@v4
    with:
      fetch-depth: 0
  ```
- Switch to `lastmod_strategy: 'filemtime'` if git not available
- Use `lastmod_strategy: 'none'` to omit lastmod tag

### Issue: "Validation fails - XML is invalid"

**Cause**: Generated XML doesn't match sitemaps.org protocol.

**Solution**:

- Check for invalid characters in URLs
- Ensure `priority` is between 0.0 and 1.0
- Validate `changefreq` values
- Use `debug_show_sitemap: 'true'` to inspect output
- Set `strict_validation: 'false'` temporarily to see warnings

### Issue: "Site URL is wrong in sitemap"

**Cause**: `parse_canonical` or auto-detection is overriding site_url.

**Solution**:

- Set `parse_canonical: 'false'` to disable canonical parsing
- Ensure `site_url` input is provided explicitly
- Check if HTML files contain incorrect canonical tags

### Issue: "Workflow fails - permission denied"

**Cause**: Missing permissions or git configuration.

**Solution**:

- Ensure proper git configuration:
  ```yaml
  git config user.name "github-actions[bot]"
  git config user.email "github-actions[bot]@users.noreply.github.com"
  ```
- Check GitHub token permissions if using custom tokens
- Verify branch protection rules allow commits

## ❓ FAQ

### How often should I generate sitemaps?

**Answer**: Run on every build or deployment. The example workflow above triggers on push to main and allows manual trigger via `workflow_dispatch`.

### Can I use this with dynamic sites?

**Answer**: Yes, build your site first (which pre-renders dynamic pages), then run the action. Works with SSG frameworks that pre-render to static files.

### Does this support non-HTML files?

**Answer**: By default, it indexes HTML/HTM files. Use `include_patterns` to add other types:

```yaml
include_patterns: '**/*.html,**/*.htm,**/*.pdf,**/*.json'
```

### Can I exclude certain URLs?

**Answer**: Yes, use either:

- `exclude_urls`: URL patterns (e.g., `*/admin/*,*/test/*`)
- `exclude_patterns`: File patterns (e.g., `**/*.draft.html`)

### What's the maximum sitemap size?

**Answer**: Per sitemaps.org protocol:

- 50MB uncompressed per file
- 50,000 URLs per file
- Action auto-splits large sitemaps into index + multiple sitemaps

### Does this detect dynamically added content?

**Answer**: It discovers links from HTML `<a href>` tags if `discover_links: 'true'` (default). For API endpoints or content not in HTML, use `additional_urls`.

### Can I validate sitemaps without generating new ones?

**Answer**: Yes, use the `validate_sitemaps` input:

```yaml
- uses: blackoutsecure/bos-sitemap-generator@v1
  with:
    site_url: 'https://example.com'
    public_dir: 'dist'
    validate_sitemaps: 'dist/sitemap.xml'
```

### How do I handle multisite/multi-domain?

**Answer**: Run the action multiple times with different `site_url` and `public_dir`:

```yaml
- name: Generate sitemap for site 1
  uses: blackoutsecure/bos-sitemap-generator@v1
  with:
    site_url: 'https://example.com'
    public_dir: 'dist/site1'
    sitemap_output_dir: 'dist/site1'

- name: Generate sitemap for site 2
  uses: blackoutsecure/bos-sitemap-generator@v1
  with:
    site_url: 'https://example.org'
    public_dir: 'dist/site2'
    sitemap_output_dir: 'dist/site2'
```

### Does this support robots.txt Disallow rules?

**Answer**: Not automatically. Use `exclude_urls` or `exclude_patterns` to manually exclude paths that should be disallowed.

### How do I submit the sitemap to search engines?

**Answer**: Once deployed:

1. **Google**: Use [Google Search Console](https://search.google.com/search-console)
2. **Bing**: Use [Bing Webmaster Tools](https://www.bing.com/webmasters)
3. **Others**: Most support sitemap.xml at the root or via robots.txt

```robotstxt
Sitemap: https://example.com/sitemap.xml
Sitemap: https://example.com/sitemap.xml.gz
```

## 🤝 Contributing

General contribution guidelines (issue triage, PR style, test
expectations, security review) come from the organisation default at
[`blackoutsecure/.github/CONTRIBUTING.md`](https://github.com/blackoutsecure/.github/blob/main/CONTRIBUTING.md),
which applies to every repo in the org. The repo-specific bits are
below.

All PRs target the **`dev`** branch. The `main` branch is built by
the Marketplace release pipeline (the launchpad reusable in
[bos-automation-hub](https://github.com/blackoutsecure/bos-automation-hub))
and is read-only to humans — PRs opened against `main` will be
closed.

### Local development

```bash
# Install dev deps (Node 20+)
npm ci

# Build the action bundle (mocha pretest also runs this)
npm run build

# Run the test suite (this is what CI runs)
npm test

# Lint + format + test in one shot
npm run check

# Coverage report (HTML + text)
npm run coverage
```

### Style

- **JavaScript**: ESLint flat config (`eslint.config.js`) + Prettier
  (`.prettierrc.yaml`) — both are managed; CI runs `npm run check`.
- **Bundle**: `dist/index.js` is committed (ncc bundle) — Marketplace
  consumers fetch the tag, not `npm install`, so the bundle MUST be
  in sync with `src/` on every release. CI checks for drift.
- **Action contract**: `action.yml` `inputs:` / `outputs:` are the
  published contract; changes are SemVer-significant.
- **YAML (workflows)**: `actionlint` clean, pin third-party actions
  by SHA (not tag), minimise `permissions:` per job.

### Release flow

Releases promote `dev` → `main` through the Marketplace kicker's
`workflow_dispatch` mode = `release`. See the [Marketplace workflow](https://github.com/blackoutsecure/bos-automation-hub/blob/main/sync-files/workflows/bos-universal-marketplace-kicker.yml)
for the full event-routing and allowlist model.

## 📄 License

Copyright © 2025-2026 Blackout Secure

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for details.

## 💬 Support

- **Issues**: [GitHub Issues](https://github.com/blackoutsecure/bos-sitemap-generator/issues)
- **Security**: see the organization-wide [Security Policy](https://github.com/blackoutsecure/.github/blob/main/SECURITY.md) and report via [GitHub Security Advisories](https://github.com/blackoutsecure/bos-sitemap-generator/security/advisories/new)
- **Sponsor**: Support this project via [GitHub Sponsors](https://github.com/sponsors/blackoutsecure)

## 🔗 Resources

- [Sitemaps.org Protocol](https://www.sitemaps.org/protocol.html)
- [Google Search Central - Sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview)
- [Bing Webmaster Tools](https://www.bing.com/webmasters)

---

**Made with ❤️ by [Blackout Secure](https://github.com/blackoutsecure)**

<!-- >>> managed-file-sync:security_readme_pointer >>> -->

## Security & secrets

This repository is built with Blackout Secure's reusable GitHub Actions
workflows. If you fork or self-host these workflows and need to provision
your own credentials (GitHub App vs. PAT guidance, secret tiers, Docker
Hub/Cloudflare/Balena setup walkthroughs), see the
["Secrets pipelining strategy"](https://github.com/blackoutsecure/bos-automation-hub#secrets-pipelining-strategy)
section of `bos-automation-hub`. To report a vulnerability, see
[SECURITY.md](https://github.com/blackoutsecure/.github/blob/main/SECURITY.md).

<!-- <<< managed-file-sync:security_readme_pointer <<< -->
