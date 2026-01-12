# Blackout Secure Sitemap Generator

**Copyright © 2025-2026 Blackout Secure | Apache License 2.0**

[![Build Status](https://img.shields.io/github/actions/workflow/status/blackoutmode/bos-sitemap-generator/test.yml?branch=main)](https://github.com/blackoutmode/bos-sitemap-generator/actions)
[![GitHub release](https://img.shields.io/github/v/release/blackoutmode/bos-sitemap-generator?sort=semver)](https://github.com/blackoutmode/bos-sitemap-generator/releases)
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
        uses: blackoutmode/bos-sitemap-generator@v1
        with:
          site_url: 'https://example.com'
          public_dir: 'dist'

      - name: Commit sitemap
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add dist/sitemap*.xml dist/sitemap*.xml.gz dist/sitemap*.txt
          git diff --quiet && git diff --staged --quiet || git commit -m "Update sitemap"
          git push
```

## 📖 Examples

### Next.js Static Export

```yaml
- name: Build Next.js site
  run: npm run build

- name: Generate sitemap
  uses: blackoutmode/bos-sitemap-generator@v1
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
  uses: blackoutmode/bos-sitemap-generator@v1
  with:
    site_url: 'https://example.com'
    public_dir: 'public'
```

### Hugo

```yaml
- name: Build Hugo site
  run: hugo --minify

- name: Generate sitemap
  uses: blackoutmode/bos-sitemap-generator@v1
  with:
    site_url: 'https://example.com'
    public_dir: 'public'
```

### Jekyll

```yaml
- name: Build Jekyll site
  run: bundle exec jekyll build

- name: Generate sitemap
  uses: blackoutmode/bos-sitemap-generator@v1
  with:
    site_url: 'https://example.com'
    public_dir: '_site'
```

### Vite

```yaml
- name: Build Vite project
  run: npm run build

- name: Generate sitemap
  uses: blackoutmode/bos-sitemap-generator@v1
  with:
    site_url: 'https://example.com'
    public_dir: 'dist'
```

### Advanced: Custom Patterns and Exclusions

```yaml
- name: Generate sitemap with custom rules
  uses: blackoutmode/bos-sitemap-generator@v1
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
  uses: blackoutmode/bos-sitemap-generator@v1
  with:
    site_url: 'https://example.com'
    public_dir: 'dist'
    additional_urls: 'https://example.com/api,https://example.com/app'
```

### Disable TXT Format

```yaml
- name: Generate XML sitemap only
  uses: blackoutmode/bos-sitemap-generator@v1
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
  uses: blackoutmode/bos-sitemap-generator@v1
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
  uses: blackoutmode/bos-sitemap-generator@v1
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

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

Copyright © 2025-2026 Blackout Secure

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for details.

## 💬 Support

- **Issues**: [GitHub Issues](https://github.com/blackoutmode/bos-sitemap-generator/issues)
- **Security**: See [SECURITY.md](SECURITY.md)
- **Sponsor**: Support this project via [GitHub Sponsors](https://github.com/sponsors/blackoutmode)

## 🔗 Resources

- [Sitemaps.org Protocol](https://www.sitemaps.org/protocol.html)
- [Google Search Central - Sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview)
- [Bing Webmaster Tools](https://www.bing.com/webmasters)

---

**Made with ❤️ by [Blackout Secure](https://github.com/blackoutmode)**
