# Blackout Secure Sitemap Generator

**Copyright © 2025-2026 Blackout Secure | Apache License 2.0**

[![Marketplace](https://img.shields.io/badge/GitHub%20Marketplace-blue?logo=github)](https://github.com/marketplace/actions/blackout-secure-sitemap-generator)
[![GitHub release](https://img.shields.io/github/v/release/blackoutsecure/bos-sitemap-generator?sort=semver)](https://github.com/blackoutsecure/bos-sitemap-generator/releases)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)

Enterprise-grade automated sitemap generation (XML/TXT/GZIP) for static sites, SSG frameworks (Next.js, Gatsby, Hugo, Jekyll), and dynamic applications. Built for reliability, performance, and SEO best practices.

## ✨ Features

- **Multiple Formats**: XML, TXT, and GZIP compressed sitemaps
- **Smart Discovery**: Auto-detect site URLs and directories  
- **Framework Support**: Works with Next.js, Gatsby, Hugo, Jekyll, Vite, and more
- **SEO Optimized**: Canonical URL parsing, link discovery, lastmod timestamps
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

### lastmod Strategy Options

- `git` - Use git commit timestamp (requires `fetch-depth: 0`)
- `filemtime` - Use file modification time
- `current` - Use build/generation time
- `none` - Omit lastmod tag

## 📤 Outputs

| Output               | Description                      |
| -------------------- | -------------------------------- |
| `sitemap_path`       | Path to main sitemap.xml         |
| `sitemap_index_path` | Path to sitemap index (if split) |
| `sitemap_txt_path`   | Path to TXT sitemap (if enabled) |

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

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

Copyright © 2025-2026 Blackout Secure

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for details.

## 💬 Support

- **Issues**: [GitHub Issues](https://github.com/blackoutsecure/bos-sitemap-generator/issues)
- **Security**: See [SECURITY.md](SECURITY.md)
- **Sponsor**: Support this project via [GitHub Sponsors](https://github.com/sponsors/blackoutsecure)

## 🔗 Resources

- [Sitemaps.org Protocol](https://www.sitemaps.org/protocol.html)
- [Google Search Central - Sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview)
- [Bing Webmaster Tools](https://www.bing.com/webmasters)

---

**Made with ❤️ by [Blackout Secure](https://github.com/blackoutsecure)**
