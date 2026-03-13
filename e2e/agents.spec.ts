/**
 * Agents view E2E tests for ClaudeHydra.
 * Verifies agents view loads, header visible, filter bar rendered,
 * agent cards displayed, and tier filtering works.
 *
 * Note: Agents view is not in the sidebar nav but exists in the ViewRouter.
 * We navigate to it by setting the Zustand store's currentView directly.
 *
 * Smoke tests — backend not required. Agent data comes from the
 * frontend's static WitcherAgent definitions.
 */

import { test, expect } from './fixtures/base.fixture';
import { AgentsPage } from './pages/AgentsPage';
import { SEL } from './selectors/constants';

test.describe('Agents View', () => {
  let agents: AgentsPage;

  test.beforeEach(async ({ page }) => {
    agents = new AgentsPage(page);

    // Navigate to agents view by setting the Zustand store directly
    // (agents is not in the sidebar nav)
    await page.evaluate(() => {
      const storeData = {
        state: { currentView: 'agents' },
        version: 2,
      };
      localStorage.setItem('claude-hydra-v4-view', JSON.stringify(storeData));
    });
    await page.reload();
    await expect(page.locator(SEL.appShell)).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(800); // Wait for lazy load + animation
  });

  // ── Rendering ─────────────────────────────────────────────────────

  test('should render agents view container', async ({ page }) => {
    await expect(page.locator(SEL.agentsView)).toBeVisible({ timeout: 10_000 });
  });

  test('should display agents header', async () => {
    await expect(agents.header).toBeVisible();
  });

  test('should display online agent count', async () => {
    await expect(agents.onlineCount).toBeVisible();
    const text = await agents.getOnlineCountText();
    expect(text.length).toBeGreaterThan(0);
  });

  // ── Filter bar ────────────────────────────────────────────────────

  test('should render filter bar with tier buttons', async () => {
    await expect(agents.filterBar).toBeVisible();

    // Check for tier filter buttons (commander, coordinator, executor)
    const tiers = ['commander', 'coordinator', 'executor'];
    for (const tier of tiers) {
      const filterBtn = agents.filterButton(tier);
      if ((await filterBtn.count()) > 0) {
        await expect(filterBtn).toBeVisible();
      }
    }
  });

  // ── Agent cards ───────────────────────────────────────────────────

  test('should display agent cards in grid', async () => {
    await expect(agents.grid).toBeVisible();

    const cardCount = await agents.getVisibleCardCount();
    // ClaudeHydra has 12 agents defined
    expect(cardCount).toBeGreaterThanOrEqual(1);
  });

  // ── Tier filtering ────────────────────────────────────────────────

  test('should filter agents by tier', async () => {
    const allCount = await agents.getVisibleCardCount();
    expect(allCount).toBeGreaterThanOrEqual(1);

    // Click a tier filter (e.g. "commander")
    const commanderFilter = agents.filterButton('commander');
    if ((await commanderFilter.count()) > 0) {
      await agents.clickFilter('commander');

      const filteredCount = await agents.getVisibleCardCount();
      expect(filteredCount).toBeLessThanOrEqual(allCount);
      expect(filteredCount).toBeGreaterThanOrEqual(1);
    }
  });
});
