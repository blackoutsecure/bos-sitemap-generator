/**
 * Blackout Secure Sitemap Generator
 * Copyright © 2025-2026 Blackout Secure
 * SPDX-License-Identifier: Apache-2.0
 *
 * Sitemap file writing utilities
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const zlib = require('zlib');
const { SitemapStream } = require('sitemap');
const { getXmlGenerationHeader } = require('./project-config');

const gzipPromise = promisify(zlib.gzip);

/**
 * Write URLs to XML sitemap file
 * @param {Array} urls - Array of URL objects with url, lastmod, changefreq, priority
 * @param {string} outPath - Output file path
 * @returns {Promise<Buffer>} - XML content as buffer
 */
async function writeSitemapXml(urls, outPath) {
  // Configure SitemapStream per sitemaps.org protocol
  const stream = new SitemapStream({
    hostname: undefined,
    xmlns: {
      // Required namespace per sitemaps.org protocol
      '': 'http://www.sitemaps.org/schemas/sitemap/0.9',
      // Remove extra namespaces to keep sitemap cleaner and more compliant
      news: false,
      xhtml: false,
      image: false,
      video: false,
    },
  });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const out = fs.createWriteStream(outPath);
  const done = new Promise((resolve, reject) => {
    out.on('finish', resolve);
    out.on('error', reject);
    stream.on('error', reject);
  });
  stream.pipe(out);
  for (const u of urls) {
    // Ensure URL data matches sitemaps.org protocol requirements
    const urlEntry = {
      url: u.url, // Required: must be < 2,048 chars, start with http/https
    };
    if (u.lastmod) {
      // Optional: W3C Datetime format (YYYY-MM-DD or full ISO8601)
      urlEntry.lastmod = u.lastmod;
    }
    if (u.changefreq) {
      // Optional: always|hourly|daily|weekly|monthly|yearly|never
      urlEntry.changefreq = u.changefreq;
    }
    if (u.priority !== undefined) {
      // Optional: 0.0 to 1.0
      urlEntry.priority = u.priority;
    }
    stream.write(urlEntry);
  }
  stream.end();
  await done;

  // Read and format the XML for readability
  let xml = fs.readFileSync(outPath, 'utf8');

  // Add generation comment header
  const header = getXmlGenerationHeader();

  // Pretty print the XML
  xml = xml
    .replace(/></g, '>\n<') // Add newlines between tags
    .replace(/<url>/g, '\n  <url>') // Indent url tags
    .replace(/<\/url>/g, '\n  </url>') // Indent closing url tag
    .replace(/<(loc|lastmod|changefreq|priority)>/g, '\n    <$1>') // Indent child tags
    .replace(/<\/(loc|lastmod|changefreq|priority)>/g, '</$1>') // Keep closing tags on same line
    .replace(/^\s+$/gm, '') // Remove empty lines with whitespace
    .replace(/\n{2,}/g, '\n') // Remove all extra blank lines
    .trim();

  // Insert header after XML declaration
  xml = xml.replace(/(<\?xml[^?]+\?>)/, `$1\n${header}`) + '\n'; // Ensure file ends with newline

  // Write the formatted XML back
  fs.writeFileSync(outPath, xml, 'utf8');

  return Buffer.from(xml, 'utf8');
}

/**
 * Write URLs to TXT sitemap file
 * @param {Array} urls - Array of URL objects
 * @param {string} outPath - Output file path
 * @returns {Promise<Buffer>} - TXT content as buffer
 */
async function writeSitemapTxt(urls, outPath) {
  // TXT sitemap format per sitemaps.org protocol:
  // - One URL per line
  // - URLs must be fully specified with protocol (http/https)
  // - Maximum 50,000 URLs per file
  // - Maximum 50MB file size
  // - UTF-8 encoding
  // - No header or footer
  // - Only the list of URLs (no other information)

  const lines = urls.map((u) => u.url);
  const content = lines.join('\n') + '\n';

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, content, 'utf8');

  return Buffer.from(content, 'utf8');
}

/**
 * Write gzip compressed file
 * @param {Buffer|string} inputXml - Content to compress
 * @param {string} outGzPath - Output gzip file path
 * @returns {Promise<void>}
 */
async function writeGzip(inputXml, outGzPath) {
  const gz = await gzipPromise(
    Buffer.isBuffer(inputXml) ? inputXml : Buffer.from(inputXml),
  );
  fs.writeFileSync(outGzPath, gz);
}

/**
 * Write sitemap index file
 * @param {Array} sitemapUrls - Array of {url, lastmod} for each sitemap
 * @param {string} outPath - Output file path
 * @returns {string} - Generated XML content
 */
function writeSitemapIndex(sitemapUrls, outPath) {
  const header = getXmlGenerationHeader();
  const indexParts = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    header,
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];
  for (const it of sitemapUrls) {
    indexParts.push('  <sitemap>');
    indexParts.push(`    <loc>${it.url}</loc>`);
    if (it.lastmod) indexParts.push(`    <lastmod>${it.lastmod}</lastmod>`);
    indexParts.push('  </sitemap>');
  }
  indexParts.push('</sitemapindex>');
  const xmlIndexContent = indexParts.join('\n') + '\n';
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, xmlIndexContent, 'utf8');
  return xmlIndexContent;
}

module.exports = {
  writeSitemapXml,
  writeSitemapTxt,
  writeGzip,
  writeSitemapIndex,
};
