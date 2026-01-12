#!/usr/bin/env node

/**
 * CLI tool for local testing and verification
 * Usage: node test/cli.js <command>
 */

const path = require('path');
const { execSync } = require('child_process');
const {
  setupActionEnvironment,
  cleanTestArtifacts,
  verifySitemapOutput,
  runActionLocally,
} = require('./test-helpers');

const PROJECT_ROOT = path.join(__dirname, '..');

const commands = {
  clean() {
    console.log('🧹 Cleaning test artifacts...');
    const removed = cleanTestArtifacts(path.join(PROJECT_ROOT, 'public'));
    removed.forEach((file) =>
      console.log(`  ✓ Removed ${path.relative(PROJECT_ROOT, file)}`),
    );
    console.log('✅ Clean complete\n');
  },

  build() {
    console.log('🔨 Building project...');
    try {
      execSync('npm run build', { stdio: 'inherit', cwd: PROJECT_ROOT });
      console.log('✅ Build complete\n');
    } catch {
      console.error('❌ Build failed');
      process.exit(1);
    }
  },

  run() {
    console.log('🚀 Running local action...');
    try {
      const eventPath = path.join(__dirname, 'event.json');
      setupActionEnvironment(eventPath);
      runActionLocally(path.join(PROJECT_ROOT, 'dist/index.js'));
      console.log('✅ Action executed\n');
    } catch (error) {
      console.error(`❌ ${error.message}`);
      process.exit(1);
    }
  },

  verify() {
    console.log('🔍 Verifying output...');
    const { allPassed, results } = verifySitemapOutput(
      path.join(PROJECT_ROOT, 'public'),
    );

    results.forEach(({ file, exists, required, size, valid, errors }) => {
      if (exists) {
        console.log(`  ✓ ${file} (${size} bytes)`);
        if (valid) {
          if (file.endsWith('.xml')) console.log('    ✓ Valid XML structure');
        } else {
          errors.forEach((err) => console.log(`    ✗ ${err}`));
        }
      } else {
        if (required) {
          console.log(`  ✗ ${file} (missing - required)`);
        } else {
          console.log(`  ⊘ ${file} (missing - optional)`);
        }
      }
    });

    if (allPassed) {
      console.log('\n✅ All verifications passed\n');
    } else {
      console.log('\n❌ Some verifications failed\n');
      process.exit(1);
    }
  },

  coverage() {
    console.log('📊 Running tests with coverage...');
    try {
      execSync('npm run test:coverage', {
        stdio: 'inherit',
        cwd: PROJECT_ROOT,
      });
      console.log('\n✅ Coverage report generated in coverage/index.html\n');
    } catch {
      console.error('❌ Coverage failed');
      process.exit(1);
    }
  },

  help() {
    console.log(`
🧪 Test CLI for Sitemap Builder

Usage: node test/cli.js <command>

Commands:
  clean      - Remove test artifacts (generated sitemaps)
  build      - Build the project (dist/index.js)
  run        - Run the local action with event.json
  verify     - Verify generated output files
  coverage   - Run tests with coverage report
  help       - Show this help message

Examples:
  node test/cli.js clean
  node test/cli.js build
  node test/cli.js run
  node test/cli.js verify
  node test/cli.js coverage

Full workflow:
  node test/cli.js clean && \\
  node test/cli.js build && \\
  node test/cli.js run && \\
  node test/cli.js verify

With coverage:
  npm run test:coverage
`);
  },
};

// Main execution
const command = process.argv[2] || 'help';

if (commands[command]) {
  commands[command]();
} else {
  console.error(`❌ Unknown command: ${command}\n`);
  commands.help();
  process.exit(1);
}
