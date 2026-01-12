const fs = require('fs');
const path = require('path');
const { TEST_CONFIG } = require('./test-config');
/**
 * Set GitHub Actions input environment variable
 */
function setActionInput(key, value) {
  const envName = `INPUT_${key.replace(/[^A-Za-z0-9_]/g, '_').toUpperCase()}`;
  process.env[envName] = String(value);
}

/**
 * Load event.json and set up environment for local action execution
 */
function setupActionEnvironment(eventJsonPath) {
  if (!fs.existsSync(eventJsonPath)) {
    throw new Error(`event.json not found at ${eventJsonPath}`);
  }

  const raw = fs.readFileSync(eventJsonPath, 'utf8');
  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Failed to parse event.json: ${e.message}`);
  }

  const inputs = (parsed && parsed.inputs) || {};

  // Set all inputs as environment variables
  Object.entries(inputs).forEach(([k, v]) => setActionInput(k, v));

  // Set sensible defaults
  if (!inputs.public_dir) setActionInput('public_dir', TEST_CONFIG.PUBLIC_DIR);
  if (!inputs.output_dir) setActionInput('output_dir', TEST_CONFIG.OUTPUT_DIR);
  if (!inputs.site_url) setActionInput('site_url', TEST_CONFIG.SITE_URL);

  return inputs;
}

/**
 * Clean test artifacts (generated sitemaps)
 */
function cleanTestArtifacts(publicDir = TEST_CONFIG.PUBLIC_DIR) {
  const artifactsToRemove = [
    path.join(publicDir, TEST_CONFIG.SITEMAP_GENERATION.XML),
    path.join(publicDir, TEST_CONFIG.SITEMAP_GENERATION.GZ),
    path.join(publicDir, TEST_CONFIG.SITEMAP_GENERATION.INDEX),
    path.join(publicDir, TEST_CONFIG.SITEMAP_GENERATION.INDEX_GZ),
    path.join(publicDir, TEST_CONFIG.SITEMAP_GENERATION.TXT),
  ];

  const removed = [];
  artifactsToRemove.forEach((file) => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      removed.push(file);
    }
  });

  return removed;
}

/**
 * Verify sitemap output files exist and are valid
 */
function verifySitemapOutput(publicDir = 'dist') {
  const checks = [
    { file: TEST_CONFIG.SITEMAP_GENERATION.XML, required: true },
    { file: TEST_CONFIG.SITEMAP_GENERATION.GZ, required: false },
  ];

  const results = [];
  let allPassed = true;

  checks.forEach(({ file, required }) => {
    const fullPath = path.join(publicDir, file);
    const exists = fs.existsSync(fullPath);
    const result = { file, exists, required, valid: true, errors: [] };

    if (exists) {
      const stats = fs.statSync(fullPath);
      result.size = stats.size;

      // Validate XML files
      if (file.endsWith('.xml')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (!content.includes('<?xml') || !content.includes('<urlset')) {
          result.valid = false;
          result.errors.push('Invalid XML structure');
          allPassed = false;
        }
      }
    } else if (required) {
      result.valid = false;
      result.errors.push('Required file missing');
      allPassed = false;
    }

    results.push(result);
  });

  return { allPassed, results };
}

/**
 * Run the GitHub Action locally
 */
function runActionLocally(distPath = 'dist/index.js') {
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Action entry point not found: ${distPath}. Run 'npm run build' first.`,
    );
  }

  // Clear require cache to ensure fresh execution
  delete require.cache[require.resolve(path.resolve(distPath))];

  // Execute the action
  require(path.resolve(distPath));
}

module.exports = {
  setActionInput,
  setupActionEnvironment,
  cleanTestArtifacts,
  verifySitemapOutput,
  runActionLocally,
  executeActionWithOverrides,
};

/**
 * Convenience wrapper to run the built action with provided overrides.
 * @param {string} publicDir - Directory containing site files
 * @param {Object} overrides - key/value pairs for action inputs
 * @param {number} waitMs - time to wait for async writes
 */
function executeActionWithOverrides(publicDir, overrides = {}, waitMs = 200) {
  const eventPath = require('path').join(__dirname, 'event.json');
  setupActionEnvironment(eventPath);
  Object.entries(overrides).forEach(([k, v]) => setActionInput(k, v));
  setActionInput('public_dir', publicDir);
  if (!('sitemap_output_dir' in overrides)) {
    setActionInput('sitemap_output_dir', publicDir);
  }
  // Ensure sitemap generation inputs default to true unless explicitly overridden.
  if (!('generate_sitemap_xml' in overrides)) {
    setActionInput('generate_sitemap_xml', 'true');
  }
  if (!('generate_sitemap_txt' in overrides)) {
    setActionInput('generate_sitemap_txt', 'true');
  }
  runActionLocally(require('path').join(__dirname, '..', 'dist', 'index.js'));
  return new Promise((resolve) => setTimeout(resolve, waitMs));
}
