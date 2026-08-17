/**
 * Blackout Secure Sitemap Generator
 * Copyright © 2025-2026 Blackout Secure
 * SPDX-License-Identifier: Apache-2.0
 *
 * HTML parsing utilities for canonical URL and link discovery
 */

const fs = require('fs');
const { parse: parseHtml } = require('node-html-parser');

/**
 * Extract canonical URL from HTML file
 * @param {string} htmlPath - Path to HTML file
 * @returns {string|null} - Canonical URL or null
 */
function extractCanonicalUrl(htmlPath) {
  try {
    const html = fs.readFileSync(htmlPath, 'utf8');
    const root = parseHtml(html);
    const linkCanonical = root.querySelector('link[rel="canonical"]');
    return linkCanonical?.getAttribute('href') || null;
  } catch {
    return null;
  }
}

/**
 * Discover internal links from HTML file
 * @param {string} htmlPath - Path to HTML file
 * @returns {string[]} - Array of internal link hrefs
 */
function discoverInternalLinks(htmlPath) {
  try {
    const html = fs.readFileSync(htmlPath, 'utf8');
    const root = parseHtml(html);
    const anchors = root.querySelectorAll('a[href]') || [];
    const links = [];

    for (const a of anchors) {
      const href = a.getAttribute('href');
      if (!href) continue;
      // Skip external links
      if (/^https?:\/\//i.test(href)) continue;
      // Skip anchor links
      if (href.startsWith('#')) continue;
      links.push(href);
    }

    return links;
  } catch {
    return [];
  }
}

/**
 * Extract the `<meta name="robots">` content value from an HTML file
 * @param {string} htmlPath - Path to HTML file
 * @returns {string|null} - Directive list (e.g. 'noindex, nofollow') or null
 */
function extractRobotsMeta(htmlPath) {
  try {
    const html = fs.readFileSync(htmlPath, 'utf8');
    const root = parseHtml(html);
    const meta =
      root.querySelector('meta[name="robots"]') || root.querySelector('meta[name="ROBOTS"]');
    return meta?.getAttribute('content') || null;
  } catch {
    return null;
  }
}

module.exports = {
  extractCanonicalUrl,
  discoverInternalLinks,
  extractRobotsMeta,
};
