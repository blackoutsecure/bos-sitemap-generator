/**
 * Blackout Secure Sitemap Generator
 * Copyright © 2025-2026 Blackout Secure
 * SPDX-License-Identifier: Apache-2.0
 */

const core = require('@actions/core');
const path = require('path');
const fs = require('fs');

let artifactClient = null;
try {
  if (process.env.GITHUB_ACTIONS === 'true') {
    const artifact = require('@actions/artifact');
    if (artifact?.DefaultArtifactClient) {
      artifactClient = new artifact.DefaultArtifactClient();
    } else if (
      artifact?.default &&
      typeof artifact.default.uploadArtifact === 'function'
    ) {
      // Fallback for default export shape
      artifactClient = artifact.default;
    }
  }
} catch {
  // Artifact client not available (likely local/dev environment)
}

// Library imports
const {
  normalizeUrl,
  formatFileSize,
  findPublicDir,
  inferSiteUrl,
} = require('./lib/utils');
const { buildUrls } = require('./lib/url-builder');
const {
  writeSitemapXml,
  writeSitemapTxt,
  writeGzip,
  writeSitemapIndex,
} = require('./lib/sitemap-writer');
const {
  printHeader,
  printFooter,
  printConfigHeader,
  printConfigSection,
} = require('./lib/output-formatter');
const {
  validateXmlSitemap,
  validateTxtSitemap,
  validateSitemapIndex,
  validateSitemaps,
} = require('./lib/sitemap-validator');

// Limits with optional test overrides via environment variables for controlled testing.
// These are evaluated at runtime (not build time) to honor per-test overrides.
function getMaxUrlsPerSitemap() {
  return parseInt(process.env.TEST_MAX_URLS_PER_SITEMAP || '50000', 10);
} // Google limit default

function getXmlMaxSizeMb() {
  return parseInt(process.env.TEST_XML_MAX_SIZE_MB || '50', 10);
}

function getTxtMaxSizeMb() {
  return parseInt(process.env.TEST_TXT_MAX_SIZE_MB || '50', 10);
}
const DEFAULT_SITEMAP_FILENAME = 'sitemap.xml';

async function run() {
  try {
    // Print application header
    printHeader(core);

    // Resolve runtime limits (allows per-run test overrides)
    const MAX_URLS_PER_SITEMAP = getMaxUrlsPerSitemap();
    const XML_MAX_SIZE_MB = getXmlMaxSizeMb();
    const TXT_MAX_SIZE_MB = getTxtMaxSizeMb();

    const allowAutodetect = /^true$/i.test(
      core.getInput('allow_autodetect') || 'true',
    );
    const sponsorName = core.getInput('prefer_company_name') || '';

    const siteUrlInputRaw = core.getInput('site_url');
    let siteUrl = siteUrlInputRaw;
    let publicDir = core.getInput('public_dir');

    if (allowAutodetect) {
      core.info('🔧 Auto-detection enabled');
      if (!publicDir) {
        publicDir = findPublicDir(publicDir);
        if (publicDir) core.info(`   ✓ Auto-detected public_dir: ${publicDir}`);
      }
      if (!siteUrl) {
        siteUrl = inferSiteUrl(publicDir);
        if (siteUrl) core.info(`   ✓ Auto-inferred site_url: ${siteUrl}`);
      }
    }

    // Warn when using the default example URL without explicit specification
    if (
      !siteUrlInputRaw &&
      siteUrl &&
      /^https:\/\/example\.com\/?$/i.test(siteUrl)
    ) {
      core.warning(
        '⚠️  Using default site_url https://example.com/. For real sites, set the `site_url` input to your domain to generate correct URLs.',
      );
    }

    if (!siteUrl) {
      core.setFailed(
        '❌ site_url is missing and could not be inferred. Provide `site_url` or add a CNAME file or enable GitHub Pages.',
      );
      return;
    }
    if (!publicDir) {
      core.setFailed(
        '❌ public_dir is missing and could not be auto-detected. Provide `public_dir` explicitly.',
      );
      return;
    }

    const sitemapOutputDir = core.getInput('sitemap_output_dir') || publicDir;

    const includePatterns = (
      core.getInput('include_patterns') || '**/*.html,**/*.htm'
    )
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const excludePatterns = (core.getInput('exclude_patterns') || '**/*.map')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const excludeUrls = (
      core.getInput('exclude_urls') ||
      '*/sitemap*.xml,*/sitemap*.txt,*/sitemap*.xml.gz'
    )
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const excludeExtensions = (
      core.getInput('exclude_extensions') ||
      '.zip,.exe,.dmg,.pkg,.deb,.rpm,.tar,.gz,.7z,.rar,.iso'
    )
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .map((ext) => (ext.startsWith('.') ? ext : '.' + ext)); // Ensure extensions start with .
    const additionalUrls = (core.getInput('additional_urls') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const debugListFiles = /^true$/i.test(
      core.getInput('debug_list_files') || 'false',
    );
    const debugListCanonical = /^true$/i.test(
      core.getInput('debug_list_canonical') || 'false',
    );
    const debugShowSitemap = /^true$/i.test(
      core.getInput('debug_show_sitemap') || 'false',
    );
    const debugShowTxtSitemap = /^true$/i.test(
      core.getInput('debug_show_sitemap_txt') || 'false',
    );
    const debugShowExclusions = /^true$/i.test(
      core.getInput('debug_show_exclusions') || 'false',
    );
    const debugListUrls = /^true$/i.test(
      core.getInput('debug_list_urls') || 'false',
    );

    const gzip = /^true$/i.test(core.getInput('gzip') || 'true');
    const lastmodStrategy = core.getInput('lastmod_strategy') || 'git';

    // Validate lastmod_strategy
    const validLastmodStrategies = ['git', 'filemtime', 'current', 'none'];
    if (!validLastmodStrategies.includes(lastmodStrategy)) {
      core.error(
        `Invalid lastmod_strategy: "${lastmodStrategy}". Valid values: ${validLastmodStrategies.join(', ')}`,
      );
    } else if (lastmodStrategy === 'current') {
      core.warning(
        `⚠️  lastmod_strategy "current" is rarely recommended. It sets all pages to the same build time, which doesn't help search engines identify updated content. Consider using "git" (recommended) or "filemtime" instead.`,
      );
    } else if (lastmodStrategy === 'none') {
      core.warning(
        `⚠️  lastmod_strategy "none" omits the <lastmod> tag entirely, which is not recommended. The <lastmod> tag helps search engines prioritize crawling updated content. Consider using "git" (recommended) or "filemtime" instead.`,
      );
    }

    const changefreq = core.getInput('changefreq') || undefined;
    const priorityInput = core.getInput('priority') || undefined;
    let priority = undefined;

    // Validate priority input (Google recommends omitting - they ignore it)
    if (priorityInput) {
      const pr = parseFloat(priorityInput);
      if (isNaN(pr) || pr < 0.0 || pr > 1.0) {
        core.setFailed(
          `Invalid priority value "${priorityInput}". Must be between 0.0 and 1.0.`,
        );
        return;
      }
      priority = priorityInput;
      core.warning(
        '⚠️ Priority specified. Note: Google ignores <priority> values. Consider omitting for cleaner sitemaps.',
      );
    }

    const parseCanonical = /^true$/i.test(
      core.getInput('parse_canonical') || 'true',
    );
    const discoverLinks = /^true$/i.test(
      core.getInput('discover_links') || 'true',
    );
    // Support legacy alternative input names (generate_xml_sitemap, generate_txt_sitemap, generate_gzip)
    function resolveBooleanInput(primary, legacy, def) {
      const rawPrimary = core.getInput(primary);
      const rawLegacy = core.getInput(legacy);
      const chosen = rawPrimary || rawLegacy || def;
      return /^true$/i.test(chosen);
    }
    const generateXmlSitemap = resolveBooleanInput(
      'generate_sitemap_xml',
      'generate_xml_sitemap',
      'true',
    );
    const generateTxtSitemap = resolveBooleanInput(
      'generate_sitemap_txt',
      'generate_txt_sitemap',
      'true',
    );
    const generateGzip = resolveBooleanInput(
      'generate_sitemap_gzip',
      'generate_gzip',
      'true',
    );

    // Artifact upload inputs
    const uploadArtifacts = /^true$/i.test(
      core.getInput('upload_artifacts') || 'true',
    );
    const artifactName = core.getInput('artifact_name') || 'sitemap-files';
    const artifactRetentionDays =
      core.getInput('artifact_retention_days')?.trim() || '';

    // Sitemap validator inputs
    const validateSitemapPaths = (core.getInput('validate_sitemaps') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Configuration Summary
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    printConfigHeader(core);

    // Early strict validation of additional_urls (before buildUrls merges them)
    // Ensures we surface invalid entries even if later filtering or errors prevent TXT sitemap validation
    const earlyStrictValidation = /^true$/i.test(
      core.getInput('strict_validation') || 'false',
    );
    if (earlyStrictValidation && additionalUrls.length) {
      const invalidAdditional = additionalUrls.filter(
        (u) => !/^https?:\/\//i.test(u),
      );
      if (invalidAdditional.length) {
        core.setFailed(
          `      ✗ Contains ${invalidAdditional.length} invalid URL(s) in additional_urls (must start with http/https)`,
        );
      }
    }

    printConfigSection(core, '📍', 'Site & Directory Settings', {
      'Base URL:': siteUrl,
      'Public Directory:': publicDir,
      'Sitemap Output Dir:': sitemapOutputDir,
    });

    printConfigSection(core, '📋', 'File Processing', {
      'Include Patterns:': includePatterns.length
        ? includePatterns.join(', ')
        : '(default: **/*)',
      'Exclude Patterns:': excludePatterns.length
        ? excludePatterns.join(', ')
        : '(none)',
      'Exclude URLs:': excludeUrls.length ? excludeUrls.join(', ') : '(none)',
      'Exclude Extensions:': excludeExtensions.length
        ? excludeExtensions.join(', ')
        : '(none)',
    });

    printConfigSection(core, '🔗', 'URL Discovery', {
      'Parse Canonical:': parseCanonical ? 'Yes' : 'No',
      'Discover Links:': discoverLinks ? 'Yes' : 'No',
      'Additional URLs:': additionalUrls.length
        ? additionalUrls.join(', ')
        : '(none)',
    });

    printConfigSection(core, '📈', 'SEO', {
      'Last Modified:': lastmodStrategy,
      'Change Frequency:': changefreq || '(not set)',
      'Priority:': priority || '(not set)',
    });

    printConfigSection(core, '📄', 'Output Formats', {
      'XML Sitemap:': generateXmlSitemap ? 'Enabled' : 'Disabled',
      'TXT Sitemap:': generateTxtSitemap ? 'Enabled' : 'Disabled',
      'Gzip Compression:': generateGzip ? 'Enabled (XML only)' : 'Disabled',
    });

    printConfigSection(core, '📦', 'GitHub Artifacts', {
      'Upload Artifacts:': uploadArtifacts ? 'Enabled' : 'Disabled',
      'Artifact Name:': artifactName,
      'Retention Days:': artifactRetentionDays || '(repo default)',
    });

    if (validateSitemapPaths.length > 0) {
      printConfigSection(core, '✅', 'Sitemap Validation (External)', {
        'Sitemaps to Validate:': validateSitemapPaths.join(', '),
      });
    }

    core.info('\n Debug Options:');
    core.info(
      `   List Files:          ${debugListFiles ? 'Enabled' : 'Disabled'}`,
    );
    core.info(
      `   List Canonical URLs: ${debugListCanonical ? 'Enabled' : 'Disabled'}`,
    );
    core.info(
      `   List URLs:           ${debugListUrls ? 'Enabled' : 'Disabled'}`,
    );
    core.info(
      `   Show sitemap.xml:    ${debugShowSitemap ? 'Enabled' : 'Disabled'}`,
    );
    core.info(
      `   Show sitemap.txt:    ${debugShowTxtSitemap ? 'Enabled' : 'Disabled'}`,
    );
    core.info(
      `   Show Exclusions:     ${debugShowExclusions ? 'Enabled' : 'Disabled'}`,
    );

    core.info('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const sitemapFilename =
      core.getInput('sitemap_filename') || DEFAULT_SITEMAP_FILENAME;

    if (!/^https?:\/\//i.test(siteUrl)) {
      core.setFailed('❌ site_url must start with http:// or https://');
      return;
    }

    if (!fs.existsSync(publicDir)) {
      core.setFailed(`❌ public_dir not found: ${publicDir}`);
      return;
    }

    core.info('');
    let urls = await buildUrls(
      {
        baseUrl: siteUrl,
        publicDir,
        includePatterns,
        excludePatterns,
        excludeExtensions,
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
      },
      core,
    );

    if (!urls.length) {
      core.warning('⚠️  No URLs discovered for sitemap');
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Validation: Ensure no excluded items leaked through
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const invalidUrls = [];
    const sitemapPatterns = ['sitemap.xml', 'sitemap.txt', 'sitemap-index.xml'];

    for (const item of urls) {
      const urlPath = new URL(item.url).pathname;
      const filename = path.basename(urlPath);

      // Check if it's a sitemap file that shouldn't be included
      if (sitemapPatterns.some((pattern) => filename.includes(pattern))) {
        invalidUrls.push({ url: item.url, reason: 'sitemap file' });
      }

      // Check if it matches exclude_urls patterns
      for (const pattern of excludeUrls) {
        const regex = new RegExp(
          '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
        );
        if (regex.test(item.url)) {
          invalidUrls.push({
            url: item.url,
            reason: `matches exclude_urls pattern: ${pattern}`,
          });
        }
      }

      // Check if extension matches exclude_extensions
      for (const ext of excludeExtensions) {
        if (filename.toLowerCase().endsWith(ext)) {
          invalidUrls.push({
            url: item.url,
            reason: `has excluded extension: ${ext}`,
          });
        }
      }
    }

    if (invalidUrls.length > 0) {
      core.warning(
        `\n⚠️  Pre-write validation found ${invalidUrls.length} URL(s) that should have been excluded:`,
      );
      for (const invalid of invalidUrls.slice(0, 10)) {
        core.warning(`   - ${invalid.url} (${invalid.reason})`);
      }
      if (invalidUrls.length > 10) {
        core.warning(`   ... and ${invalidUrls.length - 10} more`);
      }
      // Filter them out before writing
      urls = urls.filter(
        (item) => !invalidUrls.some((inv) => inv.url === item.url),
      );
      core.info(
        `✓ Filtered out ${invalidUrls.length} invalid URL(s) before writing`,
      );
    }

    // Split into chunks if needed
    const chunks = [];
    for (let i = 0; i < urls.length; i += MAX_URLS_PER_SITEMAP) {
      chunks.push(urls.slice(i, i + MAX_URLS_PER_SITEMAP));
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Sitemap Generation
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    core.info('\n📝 Sitemap Generation:');
    core.info('   🚀 Starting sitemap generation...');

    let outMain = '';
    let sitemapIndexPath = '';

    if (generateXmlSitemap) {
      outMain = path.join(sitemapOutputDir, sitemapFilename);

      if (chunks.length <= 1) {
        const xml = await writeSitemapXml(urls, outMain);
        core.info(`   ✓ ${outMain} (${urls.length} URLs)`);
        if (debugShowSitemap) {
          core.info('[DEBUG] Generated sitemap.xml content:');
          core.info(xml.toString());
        }
        if (generateGzip) {
          const gzPath = path.join(
            sitemapOutputDir,
            path.basename(outMain) + '.gz',
          );
          await writeGzip(xml, gzPath);
          const gzSize = formatFileSize(fs.statSync(gzPath).size);
          core.info(`   ✓ ${gzPath} (${gzSize})`);
        }
      } else {
        core.info(`   Splitting into ${chunks.length} sitemap file(s)`);
        // Write multiple sitemaps and an index
        const indexItems = [];
        for (let i = 0; i < chunks.length; i++) {
          const partName = sitemapFilename.replace(/\.xml$/i, `-${i + 1}.xml`);
          const outPart = path.join(sitemapOutputDir, partName);
          const xml = await writeSitemapXml(chunks[i], outPart);
          core.info(`   ✓ ${outPart} (${chunks[i].length} URLs)`);
          indexItems.push({
            url: normalizeUrl(
              siteUrl,
              `/${path.relative(publicDir, outPart).replace(/\\/g, '/')}`,
            ),
            lastmod: new Date().toISOString(),
          });
          if (generateGzip) {
            const gzPath = path.join(
              sitemapOutputDir,
              path.basename(outPart) + '.gz',
            );
            await writeGzip(xml, gzPath);
            const gzSize = formatFileSize(fs.statSync(gzPath).size);
            core.info(`   ✓ ${gzPath} (${gzSize})`);
          }
        }

        // Build sitemap index
        sitemapIndexPath = path.join(sitemapOutputDir, 'sitemap-index.xml');
        const xmlIndexContent = writeSitemapIndex(indexItems, sitemapIndexPath);
        core.info(`   ✓ ${sitemapIndexPath} (index)`);
        if (process.env.TEST_CORRUPT_SITEMAP_INDEX === 'true') {
          // Remove closing tag to simulate corruption for testing
          const corrupted = xmlIndexContent.replace(/<\/sitemapindex>/i, '');
          fs.writeFileSync(sitemapIndexPath, corrupted, 'utf8');
        }
        if (generateGzip) {
          const gzPath = path.join(
            sitemapOutputDir,
            path.basename(sitemapIndexPath) + '.gz',
          );
          await writeGzip(xmlIndexContent, gzPath);
          const gzSize = formatFileSize(fs.statSync(gzPath).size);
          core.info(`   ✓ ${gzPath} (${gzSize})`);
        }
      }
    }

    // Generate TXT sitemap if enabled
    let txtSitemapPath = '';
    if (generateTxtSitemap) {
      const txtFilename = sitemapFilename.replace(/\.xml$/i, '.txt');
      txtSitemapPath = path.join(sitemapOutputDir, txtFilename);

      if (chunks.length <= 1) {
        await writeSitemapTxt(urls, txtSitemapPath);
        core.info(`   ✓ ${txtSitemapPath} (${urls.length} URLs)`);
        if (debugShowTxtSitemap) {
          const txtContent = fs.readFileSync(txtSitemapPath, 'utf8');
          core.info('[DEBUG] Generated sitemap.txt content:');
          core.info(txtContent);
        }
      } else {
        // Write multiple TXT sitemaps
        for (let i = 0; i < chunks.length; i++) {
          const partName = txtFilename.replace(/\.txt$/i, `-${i + 1}.txt`);
          const outPart = path.join(sitemapOutputDir, partName);
          await writeSitemapTxt(chunks[i], outPart);
          core.info(`   ✓ ${outPart} (${chunks[i].length} URLs)`);
        }
      }
    }

    core.info('   ✅ Sitemap generation completed successfully!');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Validation
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    core.info('');
    core.info('🔍 Validation:');
    const strictValidation = /^true$/i.test(
      core.getInput('strict_validation') || 'false',
    );

    if (strictValidation) {
      core.info('   Mode: Strict (will fail on errors)');
    } else {
      core.info('   Mode: Standard (warnings only)');
    }

    try {
      // ─────────────────────────────────────────
      // XML Sitemap Validation
      // ─────────────────────────────────────────
      if (generateXmlSitemap && fs.existsSync(outMain)) {
        core.info('\n   📄 XML Sitemap:');
        const xmlContent = fs.readFileSync(outMain, 'utf8');
        const xmlResults = validateXmlSitemap(xmlContent, {
          strict: strictValidation,
          maxUrls: MAX_URLS_PER_SITEMAP,
        });
        for (const r of xmlResults) {
          if (r.type === 'error') core.setFailed(r.message);
          else if (r.type === 'warning') core.warning(r.message);
          else core.info(r.message);
        }
      }

      // Validate sitemap.xml size (show before format validation)
      if (outMain && fs.existsSync(outMain)) {
        const mainSize = fs.statSync(outMain).size;
        const sizeStr = formatFileSize(mainSize);
        const mainSizeMB = mainSize / (1024 * 1024);
        if (mainSizeMB > XML_MAX_SIZE_MB) {
          const msg = `      ✗ Exceeds ${XML_MAX_SIZE_MB} MB (${sizeStr}). Consider splitting or relying on gzip.`;
          strictValidation ? core.setFailed(msg) : core.warning(msg);
        } else {
          core.info(`      ✓ Size OK (${sizeStr})`);
        }
      } else {
        core.info(
          '      ℹ️ No XML sitemap generated; skipping size validation',
        );
      }

      // Show format validation result after size (if XML validation passed)
      // Final format message already emitted by helper if valid

      // Validate sitemap.xml.gz size if gzip is enabled
      if (gzip && outMain && fs.existsSync(outMain)) {
        const gzPath = outMain + '.gz';
        if (fs.existsSync(gzPath)) {
          const gzSize = fs.statSync(gzPath).size;
          const gzSizeStr = formatFileSize(gzSize);
          const gzSizeMB = gzSize / (1024 * 1024);
          if (gzSizeMB > XML_MAX_SIZE_MB) {
            const msg = `      ✗ Gzip exceeds ${XML_MAX_SIZE_MB} MB (${gzSizeStr}). Consider splitting.`;
            strictValidation ? core.setFailed(msg) : core.warning(msg);
          } else {
            core.info(`      ✓ Gzip size OK (${gzSizeStr})`);
          }
        }
      }

      // ─────────────────────────────────────────
      // TXT Sitemap Validation
      // ─────────────────────────────────────────
      if (
        generateTxtSitemap &&
        txtSitemapPath &&
        fs.existsSync(txtSitemapPath)
      ) {
        core.info('\n   📄 TXT Sitemap:');
        try {
          const txtContent = fs.readFileSync(txtSitemapPath, 'utf8');
          const txtSize = fs.statSync(txtSitemapPath).size;
          const txtSizeStr = formatFileSize(txtSize);
          const txtSizeMB = txtSize / (1024 * 1024);
          if (txtSizeMB > TXT_MAX_SIZE_MB) {
            const msg = `      ✗ Exceeds ${TXT_MAX_SIZE_MB} MB (${txtSizeStr})`;
            strictValidation ? core.setFailed(msg) : core.warning(msg);
          } else {
            core.info(`      ✓ Size OK (${txtSizeStr})`);
          }
          // Additional strict invalid protocol check before generic validation helper
          const rawLines = txtContent.split(/\r?\n/).filter(Boolean);
          const invalidProtocolLines = rawLines.filter(
            (l) => !/^https?:\/\//i.test(l),
          );
          if (strictValidation && invalidProtocolLines.length > 0) {
            core.setFailed(
              `      ✗ Contains ${invalidProtocolLines.length} invalid URL(s) (strict mode)`,
            );
          }
          const txtResults = validateTxtSitemap(txtContent, {
            strict: strictValidation,
            maxUrls: MAX_URLS_PER_SITEMAP,
          });
          for (const r of txtResults) {
            if (r.type === 'error') core.setFailed(r.message);
            else if (r.type === 'warning') core.warning(r.message);
            else core.info(r.message);
          }
        } catch (txtError) {
          const msg = `      ✗ Validation error: ${txtError.message}`;
          strictValidation ? core.setFailed(msg) : core.warning(msg);
        }
      }

      // Sitemap Index Validation
      const sitemapIndexExists = fs.existsSync(
        path.join(sitemapOutputDir, 'sitemap-index.xml'),
      );
      if (sitemapIndexExists) {
        core.info('\n   📄 Sitemap Index:');
        try {
          const indexPathLocal = path.join(
            sitemapOutputDir,
            'sitemap-index.xml',
          );
          const indexContent = fs.readFileSync(indexPathLocal, 'utf8');
          const indexResults = validateSitemapIndex(indexContent, {
            strict: strictValidation,
            maxSitemaps: MAX_URLS_PER_SITEMAP,
          });
          for (const r of indexResults) {
            if (r.type === 'error') core.setFailed(r.message);
            else if (r.type === 'warning') core.warning(r.message);
            else core.info(r.message);
          }
        } catch (e) {
          const msg = `      ✗ Index validation error: ${e.message}`;
          strictValidation ? core.setFailed(msg) : core.warning(msg);
        }
      }
    } catch (e) {
      core.warning(`   ⚠️  Validation skipped: ${e.message}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Upload Artifacts (if enabled)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (uploadArtifacts) {
      try {
        core.info('');
        core.info('📦 Uploading artifacts...');

        const filesToUpload = [];

        // Collect all generated files
        if (generateXmlSitemap && fs.existsSync(outMain)) {
          filesToUpload.push(outMain);
        }

        if (sitemapIndexPath && fs.existsSync(sitemapIndexPath)) {
          filesToUpload.push(sitemapIndexPath);
        }

        if (generateTxtSitemap && fs.existsSync(txtSitemapPath)) {
          filesToUpload.push(txtSitemapPath);
        }

        if (generateGzip && fs.existsSync(outMain)) {
          const gzipPath = outMain + '.gz';
          if (fs.existsSync(gzipPath)) {
            filesToUpload.push(gzipPath);
          }
        }

        if (filesToUpload.length > 0) {
          if (artifactClient?.uploadArtifact) {
            const uploadOptions = {
              compressionLevel: 6,
            };

            if (artifactRetentionDays) {
              uploadOptions.retentionDays = parseInt(artifactRetentionDays, 10);
            }

            const uploadResponse = await artifactClient.uploadArtifact(
              artifactName,
              filesToUpload,
              sitemapOutputDir,
              uploadOptions,
            );

            const uploadedId = uploadResponse?.id;
            const uploadedSize = uploadResponse?.size;
            const uploadedDigest = uploadResponse?.digest;

            core.info(`   ✓ Files uploaded: ${filesToUpload.length}`);
            if (uploadedId !== undefined) {
              core.info(`   ✓ Artifact ID: ${uploadedId}`);
            }
            if (uploadedSize !== undefined) {
              core.info(`   ✓ Artifact size: ${formatFileSize(uploadedSize)}`);
            }
            if (uploadedDigest) {
              core.info(`   ✓ Artifact digest (SHA256): ${uploadedDigest}`);
            }
            if (artifactRetentionDays) {
              core.info(`   ℹ️  Retention: ${artifactRetentionDays} days`);
            }

            core.info('   ✅ Artifact upload completed successfully!');
          } else {
            core.info(
              '   ℹ️  Artifact upload skipped (not in GitHub Actions environment)',
            );
          }
        } else {
          core.info('   ℹ️  No files to upload');
        }
      } catch (err) {
        core.warning(`   ⚠️  Failed to upload artifacts: ${err.message}`);
      }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // External Sitemap Validation (Optional)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (validateSitemapPaths.length > 0) {
      core.info('');
      core.info('🔍 External Sitemap Validation:');

      try {
        const validationResults = await validateSitemaps(validateSitemapPaths, {
          strict: strictValidation,
          maxUrls: MAX_URLS_PER_SITEMAP,
          maxSizeMb: XML_MAX_SIZE_MB,
        });

        for (const fileResult of validationResults.files) {
          core.info(`\n   📄 ${path.basename(fileResult.path)}`);
          core.info(`      Path: ${fileResult.path}`);

          if (!fileResult.exists) {
            core.warning(`      ✗ File not found`);
            continue;
          }

          core.info(`      Type: ${fileResult.type || 'unknown'}`);
          core.info(`      Size: ${fileResult.sizeFormatted}`);

          // Display info messages
          for (const info of fileResult.info) {
            core.info(`      ✓ ${info}`);
          }

          // Display warnings
          for (const warning of fileResult.warnings) {
            core.warning(`      ⚠️  ${warning}`);
          }

          // Display errors
          for (const error of fileResult.errors) {
            core.setFailed(`      ✗ ${error}`);
          }
        }

        // Summary
        core.info('');
        if (validationResults.valid) {
          core.info('   ✅ All external sitemaps are valid!');
        } else {
          const errorCount = validationResults.errors.length;
          const warningCount = validationResults.warnings.length;
          core.warning(
            `   ⚠️  Validation completed with issues: ${errorCount} error(s), ${warningCount} warning(s)`,
          );
        }
      } catch (err) {
        core.warning(
          `   ⚠️  External sitemap validation failed: ${err.message}`,
        );
      }
    }

    // Print application footer after optional uploads
    printFooter(core, sponsorName);

    core.setOutput('sitemap_path', outMain);
    core.setOutput('sitemap_index_path', sitemapIndexPath);
    core.setOutput('sitemap_txt_path', txtSitemapPath);
  } catch (err) {
    core.setFailed(err instanceof Error ? err.message : String(err));
  }
}

run();
