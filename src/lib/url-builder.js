/**
 * Blackout Secure Sitemap Generator
 * Copyright © 2025-2026 Blackout Secure
 * SPDX-License-Identifier: Apache-2.0
 *
 * URL discovery and collection utilities
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');
const { parse: parseHtml } = require('node-html-parser');
const {
  normalizeUrl,
  normalizePathToUrl,
  getGitLastCommitISO,
} = require('./utils');

// Limits with optional test overrides (evaluated at call time to honor per-run env changes)
function getMaxDiscoveredLinks() {
  return parseInt(process.env.TEST_MAX_DISCOVERED_LINKS || '10000', 10);
}

function getMaxTotalUrls() {
  return parseInt(process.env.TEST_MAX_TOTAL_URLS || '100000', 10);
}

/**
 * Build URL list from file system and discovery
 * @param {Object} options - Configuration options
 * @returns {Promise<Array>} - Array of URL objects
 */
async function buildUrls(options, core) {
  const MAX_DISCOVERED_LINKS = getMaxDiscoveredLinks();
  const MAX_TOTAL_URLS = getMaxTotalUrls();
  const {
    baseUrl,
    publicDir,
    includePatterns,
    excludePatterns,
    // excludeExtensions - reserved for future use
    excludeUrls,
    lastmodStrategy,
    changefreq,
    priority,
    additionalUrls,
    parseCanonical,
    discoverLinks,
    debugListFiles,
    debugListCanonical,
    debugListUrls,
    debugShowExclusions,
  } = options;

  const patterns = includePatterns.length ? includePatterns : ['**/*'];
  const ignore = excludePatterns;

  // Track exclusions for debug output
  const excludedItems = {
    byExtension: [],
  };

  core.info('🔍 Scanning for files...');
  core.info(`   Patterns: ${patterns.join(', ')}`);
  if (ignore.length) core.info(`   Excluding: ${ignore.join(', ')}`);

  const files = glob.sync(
    patterns.length > 1 ? `{${patterns.join(',')}}` : patterns[0],
    {
      cwd: publicDir,
      ignore,
      nodir: true,
      dot: false,
      follow: false,
    },
  );

  const items = [];
  const discoveredSet = new Set();
  let skippedCount = 0;
  let canonicalCount = 0;
  const canonicalUrls = [];
  let linksDiscoveredCount = 0;

  for (const f of files) {
    const ext = path.extname(f).toLowerCase();
    // Skip typical non-URL files unless directly navigable
    const skipExts = ['.map'];
    if (skipExts.includes(ext)) {
      if (debugListFiles)
        core.info(`[DEBUG] Skipping (excluded by extension): ${f}`);
      skippedCount++;
      continue;
    }

    const urlPath = '/' + f.replace(/\\/g, '/');

    let fullUrl = normalizeUrl(baseUrl, urlPath);
    const item = { url: fullUrl };

    try {
      const fullFsPath = path.join(publicDir, f);
      const stat = fs.statSync(fullFsPath);
      // Canonical parsing for HTML files
      if (parseCanonical && ['.html', '.htm'].includes(ext)) {
        try {
          const html = fs.readFileSync(fullFsPath, 'utf8');
          const root = parseHtml(html);
          const linkCanonical = root.querySelector('link[rel="canonical"]');
          const href = linkCanonical?.getAttribute('href');
          if (href) {
            // Absolute or relative
            const candidate = /^https?:\/\//i.test(href)
              ? href
              : normalizePathToUrl(
                  baseUrl,
                  publicDir,
                  path.join(publicDir, href.replace(/^\//, '')),
                );
            fullUrl = candidate;
            item.url = candidate;
            canonicalCount++;
            if (debugListCanonical) canonicalUrls.push(candidate);
          }
          // Optional link discovery: collect internal anchors
          if (discoverLinks) {
            const anchors = root.querySelectorAll('a[href]') || [];
            for (const a of anchors) {
              // Safety limit: stop discovering if we hit the limit
              if (discoveredSet.size >= MAX_DISCOVERED_LINKS) {
                break;
              }
              const hrefA = a.getAttribute('href');
              if (!hrefA) continue;
              // Only internal relative links
              if (/^https?:\/\//i.test(hrefA)) continue;
              if (hrefA.startsWith('#')) continue;
              // Normalize fs path under publicDir
              const targetFs = path.join(publicDir, hrefA.replace(/^\//, ''));
              if (fs.existsSync(targetFs) && fs.statSync(targetFs).isFile()) {
                const targetUrl = normalizePathToUrl(
                  baseUrl,
                  publicDir,
                  targetFs,
                );
                if (!discoveredSet.has(targetUrl)) {
                  discoveredSet.add(targetUrl);
                  linksDiscoveredCount++;
                }
              }
            }
          }
        } catch {
          // Ignore HTML parsing errors
        }
      }
      if (lastmodStrategy === 'filemtime') {
        item.lastmod = new Date(stat.mtime).toISOString();
      } else if (lastmodStrategy === 'git') {
        const iso = getGitLastCommitISO(fullFsPath);
        if (iso) item.lastmod = iso;
        else item.lastmod = new Date(stat.mtime).toISOString();
      } else if (lastmodStrategy === 'current') {
        item.lastmod = new Date().toISOString();
      }
      // If lastmodStrategy === 'none', don't set lastmod at all
    } catch {
      // Ignore file stat errors
    }

    if (changefreq) item.changefreq = changefreq;
    if (priority) item.priority = Number(priority);

    items.push(item);
  }

  if (skippedCount > 0) {
    core.info(`⏭️  Skipped ${skippedCount} file(s) (excluded or disallowed)`);
  }
  if (parseCanonical && canonicalCount > 0) {
    core.info(`🔗 Found ${canonicalCount} canonical URL(s)`);
    if (debugListCanonical) {
      core.info('[DEBUG] Canonical URLs:');
      for (const u of canonicalUrls) core.info(`[DEBUG] • ${u}`);
    }
  }
  if (discoverLinks && linksDiscoveredCount > 0) {
    core.info(`🔎 Discovered ${linksDiscoveredCount} additional link(s)`);
    if (discoveredSet.size >= MAX_DISCOVERED_LINKS) {
      core.warning(
        `⚠️  Discovered links limit reached (${MAX_DISCOVERED_LINKS}). Some links may not be included.`,
      );
    }
  }

  if (additionalUrls && additionalUrls.length) {
    core.info(`➕ Adding ${additionalUrls.length} manual URL(s)`);
    for (const extra of additionalUrls) {
      items.push({ url: extra, changefreq, priority });
    }
  }

  // Merge discovered links with safety limit
  if (discoverLinks && discoveredSet.size) {
    let addedFromDiscovered = 0;
    for (const u of discoveredSet) {
      // Safety limit: prevent memory issues with extremely large sites
      if (items.length >= MAX_TOTAL_URLS) {
        core.warning(
          `⚠️  Total URLs limit reached (${MAX_TOTAL_URLS}). Stopping URL collection.`,
        );
        break;
      }
      // Also limit the items added from discovered to MAX_DISCOVERED_LINKS
      if (addedFromDiscovered >= MAX_DISCOVERED_LINKS) {
        break;
      }
      if (!items.some((it) => it.url === u)) {
        items.push({ url: u, changefreq, priority });
        addedFromDiscovered++;
      }
    }
  }

  // Remove duplicates by URL
  const seenUrls = new Set();
  const uniqueItems = [];
  for (const item of items) {
    if (!seenUrls.has(item.url)) {
      seenUrls.add(item.url);
      uniqueItems.push(item);
    }
  }

  // Filter out excluded URLs
  const filteredItems =
    excludeUrls.length > 0
      ? uniqueItems.filter((item) => {
          // Check exact match or pattern match
          for (const excludeUrl of excludeUrls) {
            if (item.url === excludeUrl) return false;
            // Support wildcard patterns (* and ?)
            if (excludeUrl.includes('*') || excludeUrl.includes('?')) {
              const regex = new RegExp(
                '^' + excludeUrl.replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
              );
              if (regex.test(item.url)) return false;
            }
          }
          return true;
        })
      : uniqueItems;

  const excludedCount = uniqueItems.length - filteredItems.length;
  if (excludedCount > 0) {
    core.info(`🚫 Excluded ${excludedCount} URL(s) via exclude_urls`);
  }

  // Debug: Show all exclusions if enabled
  if (debugShowExclusions) {
    core.info('\n[DEBUG] Exclusion Summary:');
    if (excludedItems.byExtension.length > 0) {
      core.info(
        `[DEBUG] Excluded by extension (${excludedItems.byExtension.length}):`,
      );
      for (const item of excludedItems.byExtension) {
        core.info(`[DEBUG]   - ${item}`);
      }
    }
    if (excludedCount > 0) {
      const excludedUrls = uniqueItems.filter(
        (item) => !filteredItems.some((fi) => fi.url === item.url),
      );
      core.info(`[DEBUG] Excluded by URL patterns (${excludedCount}):`);
      for (const item of excludedUrls) {
        core.info(`[DEBUG]   - ${item.url}`);
      }
    }
    if (excludedItems.byExtension.length === 0 && excludedCount === 0) {
      core.info('[DEBUG] No items excluded');
    }
  }

  // Sort for stability
  filteredItems.sort((a, b) => a.url.localeCompare(b.url));

  core.info(`📊 Total URLs for sitemap: ${filteredItems.length}`);

  // Debug: List all URLs if enabled
  if (debugListUrls) {
    core.info('\n[DEBUG] List of all URLs:');
    for (const item of filteredItems) {
      core.info(`   - ${item.url}`);
    }
  }

  return filteredItems;
}

module.exports = {
  buildUrls,
};
