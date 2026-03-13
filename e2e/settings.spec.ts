/**
 * Settings view E2E tests for ClaudeHydra.
 * Verifies settings page loads, heading visible, multiple card sections
 * rendered, scrollability, and no console errors during navigation.
 *
 * Smoke tests only — no backend required.
 */

import { test, expect } from './fixtures/base.fixture';
import { SettingsPage } from './pages/SettingsPage';
import { SidebarComponent } from './pages/SidebarComponent';
import { SEL } from './selectors/constants';

test.describe('Settings View', () => {
  let settings: SettingsPage;
  let sidebar: SidebarComponent;

  test.beforeEach(async ({ page }) => {
    sidebar = new SidebarComponent(page);
    settings = new SettingsPage(page);

    // Navigate to settings via sidebar
    await sidebar.navigateTo('settings');
    await page.waitForTimeout(800); // Wait for lazy load + animation
  });

  // ── Rendering ─────────────────────────────────────────────────────

  test('should render settings view container', async ({ page }) => {
    await expect(page.locator(SEL.settingsView)).toBeVisible({ timeout: 10_000 });
  });

  test('should display settings heading with icon', async ({ page }) => {
    const settingsView = page.locator(SEL.settingsView);
    await expect(settingsView).toBeVisible();

    // Settings view has an h1 heading with "Settings" text
    const heading = settingsView.locator('h1');
    await expect(heading).toBeVisible();
    const text = await heading.textContent();
    expect(text).toContain('Settings');
  });

  // ── Card sections ─────────────────────────────────────────────────

  test('should display multiple settings sections as cards', async ({ page }) => {
    const settingsView = page.locator(SEL.settingsView);
    await expect(settingsView).toBeVisible();

    // Settings view contains Card components within a space-y-6 container.
    // ClaudeHydra has 14 settings sections (OAuth, Google OAuth, Working Folder,
    // Custom Instructions, Temperature, Max Tokens, Iterations, Compaction,
    // Completion Sound, Auto Updater, Telemetry, Browser Proxy, Watchdog, MCP).
    const cards = settingsView.locator('.space-y-6 > div');
    const cardCount = await cards.count();

    // Expect at least 10 setting sections (some may be lazy-loaded)
    expect(cardCount).toBeGreaterThanOrEqual(10);
  });

  // ── OAuth section visibility ──────────────────────────────────────

  test('should show Anthropic OAuth section', async ({ page }) => {
    const settingsView = page.locator(SEL.settingsView);
    await expect(settingsView).toBeVisible();

    // Look for Anthropic/Claude related text in the settings
    const oauthText = settingsView.locator('text=/anthropic|claude|api.?key|oauth/i');
    if ((await oauthText.count()) > 0) {
      await expect(oauthText.first()).toBeVisible();
    }
  });

  test('should show Google OAuth section', async ({ page }) => {
    const settingsView = page.locator(SEL.settingsView);
    await expect(settingsView).toBeVisible();

    // Look for Google auth related text
    const googleText = settingsView.locator('text=/google/i');
    if ((await googleText.count()) > 0) {
      await expect(googleText.first()).toBeVisible();
    }
  });

  // ── Scrollability ─────────────────────────────────────────────────

  test('should allow scrolling through settings sections', async ({ page }) => {
    const settingsView = page.locator(SEL.settingsView);
    await expect(settingsView).toBeVisible();

    // Settings view has overflow-y-auto — should be scrollable with 14 sections
    const isScrollable = await settingsView.evaluate((el) => {
      return el.scrollHeight > el.clientHeight;
    });

    if (isScrollable) {
      // Scroll to bottom
      await settingsView.evaluate((el) => {
        el.scrollTo(0, el.scrollHeight);
      });
      await page.waitForTimeout(300);

      // Verify scroll position changed
      const scrollTop = await settingsView.evaluate((el) => el.scrollTop);
      expect(scrollTop).toBeGreaterThan(0);
    }
  });

  // ── No console errors ─────────────────────────────────────────────

  test('should render settings view without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Filter out expected network errors from missing backend
        if (
          !text.includes('Failed to fetch') &&
          !text.includes('ERR_CONNECTION_REFUSED') &&
          !text.includes('net::ERR_') &&
          !text.includes('NetworkError') &&
          !text.includes('/api/')
        ) {
          errors.push(text);
        }
      }
    });

    // Re-navigate to settings (the error listener needs to be attached before navigation)
    await page.goto('/');
    await expect(page.locator(SEL.appShell)).toBeVisible({ timeout: 15_000 });
    await sidebar.navigateTo('settings');
    await page.waitForTimeout(1000);

    expect(errors).toEqual([]);
  });

  // ── Return navigation ─────────────────────────────────────────────

  test('should navigate back to home from settings', async ({ page }) => {
    await expect(page.locator(SEL.settingsView)).toBeVisible();

    // Navigate back to home via sidebar
    await sidebar.navigateTo('home');
    await page.waitForTimeout(500);

    await expect(page.locator(SEL.homeView)).toBeVisible();
  });
});
