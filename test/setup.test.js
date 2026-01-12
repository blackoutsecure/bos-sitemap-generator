const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { TEST_CONFIG, getAbsolutePath } = require('./test-config');

describe('Test Environment Setup', () => {
  it('should have required directories', () => {
    assert.ok(
      fs.existsSync(path.join(__dirname, '../src')),
      'src directory exists',
    );
    assert.ok(
      fs.existsSync(getAbsolutePath(TEST_CONFIG.PUBLIC_DIR)),
      `${TEST_CONFIG.PUBLIC_DIR} directory exists`,
    );
  });

  it('should have package.json', () => {
    const pkg = require('../package.json');
    assert.ok(pkg.name, 'package.json has name');
    assert.ok(pkg.version, 'package.json has version');
  });

  it('should have all required dependencies', () => {
    const pkg = require('../package.json');
    const requiredDeps = ['@actions/core', 'glob', 'sitemap'];
    requiredDeps.forEach((dep) => {
      assert.ok(pkg.dependencies[dep], `${dep} is listed in dependencies`);
    });
  });
});
