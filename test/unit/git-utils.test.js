const assert = require('assert');
const { getGitLastCommitISO } = require('../../src/lib/utils');

describe('Git Utils', () => {
  describe('getGitLastCommitISO', () => {
    it('should return ISO date string for tracked file', () => {
      // Test with a file we know exists in the repo
      const result = getGitLastCommitISO('README.md');

      if (result) {
        // Should be a valid ISO date string
        assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(result));
      } else {
        // In non-git environment, should return null
        assert.strictEqual(result, null);
      }
    });

    it('should return null for non-existent file', () => {
      const result = getGitLastCommitISO('nonexistent-file.txt');

      assert.strictEqual(result, null);
    });

    it('should handle paths with spaces', () => {
      // Should not throw for paths with special characters
      const result = getGitLastCommitISO('file with spaces.txt');

      assert.strictEqual(result, null);
    });
  });
});
