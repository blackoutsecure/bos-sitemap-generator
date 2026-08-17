/**
 * Blackout Secure Sitemap Generator
 * Copyright © 2025-2026 Blackout Secure
 * SPDX-License-Identifier: Apache-2.0
 *
 * Sitemap Validator Module
 * Unified validation for generated sitemaps and external sitemap files
 * Validates against sitemaps.org protocol compliance
 */

const fs = require('fs');
const path = require('path');
const { formatFileSize } = require('./utils');

// Valid changefreq values per sitemaps.org spec
const VALID_CHANGEFREQ = [
  'always',
  'hourly',
  'daily',
  'weekly',
  'monthly',
  'yearly',
  'never',
];

/**
 * Validates XML sitemap content (for generated sitemaps)
 * @param {string} xmlContent - XML content to validate
 * @param {Object} options - Validation options
 * @param {boolean} options.strict - Strict mode (errors vs warnings)
 * @param {number} options.maxUrls - Maximum URL count
 * @returns {Array} Validation results array
 */
function validateXmlSitemap(xmlContent, { strict = false, maxUrls = 50000 }) {
  const results = [];
  try {
    const trimmed = xmlContent.trim();
    const hasXmlDeclaration = trimmed.startsWith('<?xml');
    const hasUrlsetOpen = /<urlset[\s>]/i.test(xmlContent);
    const hasUrlsetClose = /<\/urlset>/i.test(xmlContent);

    if (!hasXmlDeclaration || !hasUrlsetOpen || !hasUrlsetClose) {
      results.push({
        type: strict ? 'error' : 'warning',
        message:
          '      ✗ Invalid XML structure (missing <?xml>, <urlset>, or </urlset>)',
      });
    } else {
      results.push({ type: 'info', message: '      ✓ Valid XML format' });
    }

    const hasNamespace = xmlContent.includes(
      'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    );
    if (!hasNamespace) {
      results.push({
        type: strict ? 'error' : 'warning',
        message:
          '      ✗ Missing required namespace: xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
      });
    }

    const hasUrlTags =
      xmlContent.includes('<url>') && xmlContent.includes('</url>');
    const hasLocTags =
      xmlContent.includes('<loc>') && xmlContent.includes('</loc>');
    if (!hasUrlTags) {
      results.push({
        type: strict ? 'error' : 'warning',
        message: '      ✗ Missing required <url> tags',
      });
    } else if (!hasLocTags) {
      results.push({
        type: strict ? 'error' : 'warning',
        message: '      ✗ Missing required <loc> tags',
      });
    }

    // URL limit
    const urlCount = (xmlContent.match(/<url>/gi) || []).length;
    if (urlCount > maxUrls) {
      results.push({
        type: strict ? 'error' : 'warning',
        message: `      ✗ Exceeds URL limit: ${urlCount} URLs (max: ${maxUrls})`,
      });
    }

    // Validate loc URLs
    const locMatches = xmlContent.match(/<loc>(.*?)<\/loc>/gi) || [];
    let invalidLocCount = 0;
    for (const locTag of locMatches) {
      const url = locTag.replace(/<\/?loc>/gi, '');
      if (!/^https?:\/\//i.test(url) || url.length >= 2048) invalidLocCount++;
    }
    if (invalidLocCount > 0) {
      results.push({
        type: 'warning',
        message: `      ⚠️  Contains ${invalidLocCount} invalid URL(s) (must start with http/https and be < 2,048 chars)`,
      });
    }

    // Validate changefreq values
    const changefreqMatches =
      xmlContent.match(/<changefreq>(.*?)<\/changefreq>/gi) || [];
    let invalidChangefreq = 0;
    for (const freqTag of changefreqMatches) {
      const freq = freqTag.replace(/<\/?changefreq>/gi, '').trim();
      if (!VALID_CHANGEFREQ.includes(freq)) {
        invalidChangefreq++;
      }
    }
    if (invalidChangefreq > 0) {
      results.push({
        type: 'warning',
        message: `      ⚠️  Invalid <changefreq> value(s) (valid: ${VALID_CHANGEFREQ.join(', ')})`,
      });
    }

    // Validate priority values
    const priorityMatches =
      xmlContent.match(/<priority>(.*?)<\/priority>/gi) || [];
    let invalidPriority = 0;
    for (const prTag of priorityMatches) {
      const pr = parseFloat(prTag.replace(/<\/?priority>/gi, '').trim());
      if (isNaN(pr) || pr < 0.0 || pr > 1.0) {
        invalidPriority++;
      }
    }
    if (invalidPriority > 0) {
      results.push({
        type: 'warning',
        message:
          '      ⚠️  Invalid <priority> value: must be between 0.0 and 1.0',
      });
    }

    if (hasNamespace && hasUrlTags && hasLocTags && locMatches.length > 0) {
      results.push({
        type: 'info',
        message: '      ✓ Valid sitemap format (sitemaps.org compliant)',
      });
    }
  } catch (e) {
    results.push({
      type: strict ? 'error' : 'warning',
      message: `      ✗ Validation error: ${e.message}`,
    });
  }
  return results;
}

/**
 * Validates TXT sitemap content (for generated sitemaps)
 * @param {string} txtContent - TXT content to validate
 * @param {Object} options - Validation options
 * @param {boolean} options.strict - Strict mode
 * @param {number} options.maxUrls - Maximum URL count
 * @returns {Array} Validation results array
 */
function validateTxtSitemap(txtContent, { strict = false, maxUrls = 50000 }) {
  const results = [];
  try {
    const lines = txtContent.split(/\r?\n/).filter(Boolean);
    const urlCount = lines.length;
    if (urlCount > maxUrls) {
      results.push({
        type: strict ? 'error' : 'warning',
        message: `      ✗ Exceeds URL limit: ${urlCount} URLs (max: ${maxUrls})`,
      });
    }
    let invalid = 0;
    for (const line of lines) {
      if (!/^https?:\/\//i.test(line) || /[\r\n]/.test(line)) invalid++;
    }
    if (invalid > 0) {
      results.push({
        type: strict ? 'error' : 'warning',
        message: `      ⚠️  Contains ${invalid} invalid URL(s) (must start with http/https, no embedded newlines)`,
      });
    } else {
      results.push({
        type: 'info',
        message: '      ✓ Valid TXT sitemap format (sitemaps.org compliant)',
      });
    }
  } catch (e) {
    results.push({
      type: strict ? 'error' : 'warning',
      message: `      ✗ Validation error: ${e.message}`,
    });
  }
  return results;
}

/**
 * Validates sitemap index content (for generated sitemap indexes)
 * @param {string} xmlContent - Index XML content
 * @param {Object} options - Validation options
 * @param {boolean} options.strict - Strict mode
 * @param {number} options.maxSitemaps - Maximum sitemap entries
 * @returns {Array} Validation results array
 */
function validateSitemapIndex(
  xmlContent,
  { strict = false, maxSitemaps = 50000 },
) {
  const results = [];
  try {
    const trimmed = xmlContent.trim();
    const hasXmlDeclaration = trimmed.startsWith('<?xml');
    const hasIndexOpen = /<sitemapindex[\s>]/i.test(xmlContent);
    const hasIndexClose = /<\/sitemapindex>/i.test(xmlContent);
    if (!hasIndexOpen || !hasIndexClose) {
      results.push({
        type: strict ? 'error' : 'warning',
        message:
          '      ✗ Invalid sitemap index structure (missing <sitemapindex> or </sitemapindex>)',
      });
    } else {
      if (hasXmlDeclaration) {
        results.push({
          type: 'info',
          message: '      ✓ Valid XML format (index)',
        });
      } else {
        results.push({
          type: 'info',
          message: '      ✓ XML format (index) - no declaration (acceptable)',
        });
      }
    }
    const sitemapEntries =
      xmlContent.match(/<sitemap>\s*<loc>(.*?)<\/loc>[\s\S]*?<\/sitemap>/gi) ||
      [];
    if (sitemapEntries.length === 0) {
      results.push({
        type: strict ? 'error' : 'warning',
        message: '      ✗ Missing <sitemap> entries in index',
      });
    }
    if (sitemapEntries.length > maxSitemaps) {
      results.push({
        type: strict ? 'error' : 'warning',
        message: `      ✗ Exceeds sitemap index entry limit: ${sitemapEntries.length} (max: ${maxSitemaps})`,
      });
    }
    let invalidLocs = 0;
    for (const entry of sitemapEntries) {
      const m = entry.match(/<loc>(.*?)<\/loc>/i);
      if (m) {
        const url = m[1].trim();
        if (!/^https?:\/\//i.test(url) || url.length >= 2048) invalidLocs++;
      }
    }
    if (invalidLocs > 0) {
      results.push({
        type: strict ? 'error' : 'warning',
        message: `      ⚠️  Contains ${invalidLocs} invalid sitemap <loc> URL(s)`,
      });
    }
    if (
      hasIndexOpen &&
      hasIndexClose &&
      sitemapEntries.length > 0 &&
      invalidLocs === 0
    ) {
      results.push({
        type: 'info',
        message: '      ✓ Valid sitemap index format (sitemaps.org compliant)',
      });
    }
  } catch (e) {
    results.push({
      type: strict ? 'error' : 'warning',
      message: `      ✗ Index validation error: ${e.message}`,
    });
  }
  return results;
}

/**
 * Validates one or more existing sitemap files (external file validation)
 * @param {string|string[]} sitemapPaths - Path or array of paths to sitemap files
 * @param {Object} options - Validation options
 * @param {boolean} options.strict - Fail on errors (default: false)
 * @param {number} options.maxUrls - Maximum URLs per sitemap (default: 50000)
 * @param {number} options.maxSizeMb - Maximum size in MB (default: 50)
 * @returns {Object} Validation results
 */
async function validateSitemaps(sitemapPaths, options = {}) {
  const { strict = false, maxUrls = 50000, maxSizeMb = 50 } = options;

  // Normalize to array
  const paths = Array.isArray(sitemapPaths) ? sitemapPaths : [sitemapPaths];
  const results = {
    valid: true,
    errors: [],
    warnings: [],
    files: [],
  };

  for (const sitemapPath of paths) {
    const fileResult = await validateSitemapFile(sitemapPath, {
      strict,
      maxUrls,
      maxSizeMb,
    });

    results.files.push(fileResult);

    if (fileResult.errors.length > 0) {
      results.valid = false;
      results.errors.push(...fileResult.errors);
    }

    if (fileResult.warnings.length > 0) {
      results.warnings.push(...fileResult.warnings);
    }
  }

  return results;
}

/**
 * Validates a single sitemap file (external file validation)
 * @async
 * @private
 */
async function validateSitemapFile(sitemapPath, options) {
  const { strict, maxUrls, maxSizeMb } = options;
  const result = {
    path: sitemapPath,
    exists: false,
    type: null,
    size: 0,
    sizeFormatted: '',
    errors: [],
    warnings: [],
    info: [],
  };

  // Check existence
  if (!fs.existsSync(sitemapPath)) {
    result.errors.push(`File not found: ${sitemapPath}`);
    return result;
  }

  result.exists = true;

  // Check file size
  try {
    const stats = fs.statSync(sitemapPath);
    result.size = stats.size;
    result.sizeFormatted = formatFileSize(result.size);
    const sizeMb = result.size / (1024 * 1024);

    if (sizeMb > maxSizeMb) {
      const msg = `File exceeds ${maxSizeMb} MB limit (${result.sizeFormatted})`;
      if (strict) {
        result.errors.push(msg);
      } else {
        result.warnings.push(msg);
      }
    }
  } catch (err) {
    result.errors.push(`Failed to read file stats: ${err.message}`);
    return result;
  }

  // Read file content
  let content;
  try {
    content = fs.readFileSync(sitemapPath, 'utf8');
  } catch (err) {
    result.errors.push(`Failed to read file: ${err.message}`);
    return result;
  }

  // Determine sitemap type and validate
  const filename = path.basename(sitemapPath).toLowerCase();
  detectAndValidateType(filename, content, result, { strict, maxUrls });

  return result;
}

/**
 * Detects sitemap type and performs appropriate validation
 * @private
 */
function detectAndValidateType(filename, content, result, options) {
  const { strict, maxUrls } = options;

  // Determine type from filename
  if (filename.endsWith('.txt')) {
    result.type = 'txt';
    validateTxtFileContent(content, result, { strict, maxUrls });
  } else if (
    filename.includes('sitemap') &&
    (filename.endsWith('.xml') || filename.endsWith('.gz'))
  ) {
    // Check for index vs regular sitemap
    const isIndex =
      filename.includes('sitemap-index') || filename.includes('sitemapindex');

    if (isIndex) {
      result.type = 'index';
      validateIndexFileContent(content, result, { strict, maxUrls });
    } else {
      result.type = 'xml';
      validateXmlFileContent(content, result, { strict, maxUrls });
    }
  } else {
    // Try to detect from content
    if (content.includes('<?xml') || content.includes('<urlset')) {
      result.type = 'xml';
      validateXmlFileContent(content, result, { strict, maxUrls });
    } else if (
      content
        .split(/\r?\n/)
        .filter(Boolean)
        .every((l) => /^https?:\/\//i.test(l))
    ) {
      result.type = 'txt';
      validateTxtFileContent(content, result, { strict, maxUrls });
    } else {
      result.warnings.push(
        `Unknown sitemap type (expected sitemap.xml, sitemap.txt, or sitemap-index.xml)`,
      );
    }
  }
}

/**
 * Validates XML sitemap file content
 * @private
 */
function validateXmlFileContent(content, result, { strict, maxUrls }) {
  const trimmed = content.trim();

  // Check XML declaration
  const hasXmlDeclaration = trimmed.startsWith('<?xml');
  if (!hasXmlDeclaration) {
    result.warnings.push('Missing XML declaration');
  }

  // Check required structure
  const hasUrlsetOpen = /<urlset[\s>]/i.test(content);
  const hasUrlsetClose = /<\/urlset>/i.test(content);

  if (!hasUrlsetOpen || !hasUrlsetClose) {
    const msg = 'Invalid XML structure (missing <urlset> or </urlset>)';
    if (strict) {
      result.errors.push(msg);
    } else {
      result.warnings.push(msg);
    }
    return;
  }

  // Check required namespace
  const hasNamespace = content.includes(
    'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
  );
  if (!hasNamespace) {
    const msg =
      'Missing required namespace: xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"';
    if (strict) {
      result.errors.push(msg);
    } else {
      result.warnings.push(msg);
    }
  }

  // Count and validate URLs
  const urlCount = (content.match(/<url>/gi) || []).length;
  if (urlCount === 0) {
    result.warnings.push('No URLs found in sitemap');
  } else if (urlCount > maxUrls) {
    const msg = `Exceeds URL limit: ${urlCount} URLs (max: ${maxUrls})`;
    if (strict) {
      result.errors.push(msg);
    } else {
      result.warnings.push(msg);
    }
  } else {
    result.info.push(`Contains ${urlCount} URLs`);
  }

  // Validate URL format
  validateUrlsInXml(content, result, { strict });

  // Validate optional elements
  validateXmlOptionalElements(content, result);

  // Summary
  if (
    hasNamespace &&
    hasUrlsetOpen &&
    hasUrlsetClose &&
    urlCount > 0 &&
    result.errors.length === 0
  ) {
    result.info.push('Valid sitemap format (sitemaps.org compliant)');
  }
}

/**
 * Validates URL format in XML sitemap
 * @private
 */
function validateUrlsInXml(content, result, { _strict }) {
  const locMatches = content.match(/<loc>(.*?)<\/loc>/gi) || [];
  let invalidUrls = 0;
  for (const loc of locMatches) {
    const url = loc.replace(/<\/?loc>/gi, '').trim();
    if (!/^https?:\/\//i.test(url) || url.length >= 2048) {
      invalidUrls++;
    }
  }
  if (invalidUrls > 0) {
    result.warnings.push(
      `Contains ${invalidUrls} invalid URL(s) (must start with http/https and be < 2,048 chars)`,
    );
  }
}

/**
 * Validates optional XML elements (changefreq, priority)
 * @private
 */
function validateXmlOptionalElements(content, result) {
  // Validate changefreq values if present
  const changefreqMatches =
    content.match(/<changefreq>(.*?)<\/changefreq>/gi) || [];
  let invalidChangefreq = 0;
  for (const freq of changefreqMatches) {
    const value = freq.replace(/<\/?changefreq>/gi, '').trim();
    if (!VALID_CHANGEFREQ.includes(value)) {
      invalidChangefreq++;
    }
  }
  if (invalidChangefreq > 0) {
    result.warnings.push(
      `Contains ${invalidChangefreq} invalid <changefreq> value(s)`,
    );
  }

  // Validate priority values if present
  const priorityMatches = content.match(/<priority>(.*?)<\/priority>/gi) || [];
  let invalidPriority = 0;
  for (const pri of priorityMatches) {
    const value = parseFloat(pri.replace(/<\/?priority>/gi, '').trim());
    if (isNaN(value) || value < 0 || value > 1) {
      invalidPriority++;
    }
  }
  if (invalidPriority > 0) {
    result.warnings.push(
      `Contains ${invalidPriority} invalid <priority> value(s) (must be 0.0-1.0)`,
    );
  }
}

/**
 * Validates sitemap index file content
 * @private
 */
function validateIndexFileContent(content, result, { strict, maxUrls }) {
  const hasIndexOpen = /<sitemapindex[\s>]/i.test(content);
  const hasIndexClose = /<\/sitemapindex>/i.test(content);

  if (!hasIndexOpen || !hasIndexClose) {
    const msg =
      'Invalid sitemap index structure (missing <sitemapindex> or </sitemapindex>)';
    if (strict) {
      result.errors.push(msg);
    } else {
      result.warnings.push(msg);
    }
    return;
  }

  // Count sitemap entries
  const entries = content.match(/<sitemap>[\s\S]*?<\/sitemap>/gi) || [];
  if (entries.length === 0) {
    result.warnings.push('No <sitemap> entries found in index');
  } else if (entries.length > maxUrls) {
    const msg = `Exceeds sitemap limit: ${entries.length} sitemaps (max: ${maxUrls})`;
    if (strict) {
      result.errors.push(msg);
    } else {
      result.warnings.push(msg);
    }
  } else {
    result.info.push(`Contains ${entries.length} sitemap(s)`);
  }

  // Validate sitemap URLs
  let invalidLocs = 0;
  for (const entry of entries) {
    const m = entry.match(/<loc>(.*?)<\/loc>/i);
    if (m) {
      const url = m[1].trim();
      if (!/^https?:\/\//i.test(url) || url.length >= 2048) {
        invalidLocs++;
      }
    }
  }
  if (invalidLocs > 0) {
    result.warnings.push(
      `Contains ${invalidLocs} invalid sitemap <loc> URL(s)`,
    );
  }

  // Summary
  if (
    hasIndexOpen &&
    hasIndexClose &&
    entries.length > 0 &&
    invalidLocs === 0
  ) {
    result.info.push('Valid sitemap index format (sitemaps.org compliant)');
  }
}

/**
 * Validates TXT sitemap file content
 * @private
 */
function validateTxtFileContent(content, result, { strict, maxUrls }) {
  const lines = content.split(/\r?\n/).filter(Boolean);
  const urlCount = lines.length;

  if (urlCount === 0) {
    result.warnings.push('No URLs found in sitemap');
    return;
  }

  if (urlCount > maxUrls) {
    const msg = `Exceeds URL limit: ${urlCount} URLs (max: ${maxUrls})`;
    if (strict) {
      result.errors.push(msg);
    } else {
      result.warnings.push(msg);
    }
  } else {
    result.info.push(`Contains ${urlCount} URLs`);
  }

  // Validate each URL
  let invalidUrls = 0;
  for (const line of lines) {
    if (!/^https?:\/\//i.test(line) || /[\r\n]/.test(line)) {
      invalidUrls++;
    }
  }
  if (invalidUrls > 0) {
    const msg = `Contains ${invalidUrls} invalid URL(s) (must start with http/https)`;
    if (strict) {
      result.errors.push(msg);
    } else {
      result.warnings.push(msg);
    }
  } else {
    result.info.push('Valid TXT sitemap format (sitemaps.org compliant)');
  }
}

module.exports = {
  // For generated sitemaps
  validateXmlSitemap,
  validateTxtSitemap,
  validateSitemapIndex,
  // For external sitemaps
  validateSitemaps,
  validateSitemapFile,
};
