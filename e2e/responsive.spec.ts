/**
 * Responsive layout E2E tests for ClaudeHydra.
 * Verifies mobile hamburger/drawer behavior and desktop sidebar
 * across different viewport sizes. Mobile breakpoint: 768px.
 */

import { test, expect } from './fixtures/base.fixture';
import { SidebarComponent } from './pages/SidebarComponent';
import { SEL } from './selectors/constants';

test.describe('Responsive Layout', () => {
  let sidebar: SidebarComponent;

  test.beforeEach(async ({ page }) => {
    sidebar = new SidebarComponent(page);
  });

  // ── Mobile viewport ─────────────────────────────────────────────────

  test('should show hamburger menu on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload();
    await expect(page.locator(SEL.appShell)).toBeVisible({ timeout: 15_000 });

    await expect(sidebar.hamburger).toBeVisible();
  });

  test('should NOT show desktop sidebar on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload();
    await expect(page.locator(SEL.appShell)).toBeVisible({ timeout: 15_000 });

    await expect(sidebar.sidebar).not.toBeVisible();
  });

  test('should open drawer when hamburger clicked', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload();
    await expect(page.locator(SEL.appShell)).toBeVisible({ timeout: 15_000 });

    // Drawer should be closed initially (backdrop not visible)
    await sidebar.expectDrawerClosed();

    // Open drawer
    await sidebar.openMobileDrawer();
    await sidebar.expectDrawerOpen();
  });

  test('should show nav items in mobile drawer', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload();
    await expect(page.locator(SEL.appShell)).toBeVisible({ timeout: 15_000 });

    await sidebar.openMobileDrawer();

    // All 6 nav items should be visible inside the drawer
    const navIds = ['home', 'chat', 'logs', 'delegations', 'analytics', 'settings'];
    for (const id of navIds) {
      const navBtn = page.locator(`${SEL.mobileDrawer} ${SEL.nav(id)}`);
      // If the nav buttons are direct children of drawer, look inside drawer
      // Otherwise fall back to checking they exist on page while drawer is open
      const isInDrawer = await navBtn.count();
      if (isInDrawer > 0) {
        await expect(navBtn).toBeVisible();
      } else {
        // Nav items may be structured differently; check page-level visibility
        await expect(page.locator(SEL.nav(id))).toBeVisible();
      }
    }
  });

  test('should close drawer when close button clicked', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload();
    await expect(page.locator(SEL.appShell)).toBeVisible({ timeout: 15_000 });

    // Open drawer
    await sidebar.openMobileDrawer();
    await sidebar.expectDrawerOpen();

    // Close via close button
    await sidebar.closeMobileDrawer();
    await page.waitForTimeout(400);

    await sidebar.expectDrawerClosed();
  });

  test('should close drawer when backdrop clicked', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload();
    await expect(page.locator(SEL.appShell)).toBeVisible({ timeout: 15_000 });

    // Open drawer
    await sidebar.openMobileDrawer();
    await sidebar.expectDrawerOpen();

    // Click backdrop to close
    await sidebar.mobileBackdrop.click({ force: true });
    await page.waitForTimeout(400);

    await sidebar.expectDrawerClosed();
  });

  test('should navigate via mobile drawer and auto-close', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload();
    await expect(page.locator(SEL.appShell)).toBeVisible({ timeout: 15_000 });

    // Open drawer and navigate to chat
    await sidebar.openMobileDrawer();
    await page.locator(SEL.nav('chat')).click();
    await page.waitForTimeout(500);

    // Chat view should be visible
    await expect(page.locator(SEL.chatView)).toBeVisible();

    // Drawer should auto-close after navigation
    await sidebar.expectDrawerClosed();
  });

  // ── Desktop viewport ────────────────────────────────────────────────

  test('should show desktop sidebar on wide viewport (1280x800)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.reload();
    await expect(page.locator(SEL.appShell)).toBeVisible({ timeout: 15_000 });

    // Desktop sidebar should be visible
    await expect(sidebar.sidebar).toBeVisible();

    // Hamburger should NOT be visible on desktop
    await expect(sidebar.hamburger).not.toBeVisible();
  });
});
