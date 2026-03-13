/**
 * Auth-mocking test fixture for ClaudeHydra E2E tests.
 * Built on top of the shared @jaskier/testing/fixtures base.
 *
 * The shared fixture intercepts all standard auth endpoints (auth/status,
 * auth/google/status, auth/github/status, auth/vercel/status) and injects
 * localStorage state to bypass login walls. See packages/testing/src/fixtures.ts.
 */
import { test as mockAuthTest, expect } from '@jaskier/testing/fixtures';

export { expect };

export const test = mockAuthTest.extend({
  storageKey: 'claude-hydra-v4-view' as never,
});
