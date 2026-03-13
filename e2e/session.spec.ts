/**
 * Session CRUD E2E tests for ClaudeHydra.
 * Verifies creating, renaming, deleting, and switching chat sessions
 * via the sidebar session manager.
 *
 * These are smoke tests — no backend required. Session state lives
 * in the Zustand store (persisted to localStorage).
 */

import { test, expect } from './fixtures/base.fixture';
import { SidebarComponent } from './pages/SidebarComponent';
import { SEL } from './selectors/constants';

test.describe('Session CRUD', () => {
  let sidebar: SidebarComponent;

  test.beforeEach(async ({ page }) => {
    sidebar = new SidebarComponent(page);
    await sidebar.expand();
  });

  // ── Create ──────────────────────────────────────────────────────────

  test('should create a new session via sidebar + button', async ({ page }) => {
    const initialCount = await sidebar.getSessionCount();

    await sidebar.clickNewChat();
    await page.waitForTimeout(500);

    const newCount = await sidebar.getSessionCount();
    expect(newCount).toBe(initialCount + 1);
  });

  test('should create a new session via Home CTA', async ({ page }) => {
    // Ensure we're on home view
    await expect(page.locator(SEL.homeView)).toBeVisible();

    const initialCount = await sidebar.getSessionCount();

    // Click "Start Chat" CTA on home page
    await page.locator('[data-testid="btn-new-chat"]').click();
    await page.waitForTimeout(500);

    // Should navigate to chat view
    await expect(page.locator(SEL.chatView)).toBeVisible();

    // Session count should increase
    const newCount = await sidebar.getSessionCount();
    expect(newCount).toBe(initialCount + 1);
  });

  test('should create multiple sessions', async ({ page }) => {
    const initialCount = await sidebar.getSessionCount();

    await sidebar.clickNewChat();
    await page.waitForTimeout(300);
    await sidebar.clickNewChat();
    await page.waitForTimeout(300);
    await sidebar.clickNewChat();
    await page.waitForTimeout(300);

    const newCount = await sidebar.getSessionCount();
    expect(newCount).toBe(initialCount + 3);
  });

  // ── Switch ──────────────────────────────────────────────────────────

  test('should switch between sessions', async ({ page }) => {
    // Create two sessions
    await sidebar.clickNewChat();
    await page.waitForTimeout(300);
    await sidebar.clickNewChat();
    await page.waitForTimeout(300);

    const sessionCount = await sidebar.getSessionCount();
    expect(sessionCount).toBeGreaterThanOrEqual(2);

    // Click the second session (index 1)
    await sidebar.clickSession(1);
    await page.waitForTimeout(300);

    // Chat view should still be visible
    await expect(page.locator(SEL.chatView)).toBeVisible();
  });

  // ── Rename ──────────────────────────────────────────────────────────

  test('should rename a session via inline edit', async ({ page }) => {
    // Create a session first
    await sidebar.clickNewChat();
    await page.waitForTimeout(500);

    // Rename it
    const newTitle = 'My Test Session';
    await sidebar.renameSession(0, newTitle);
    await page.waitForTimeout(500);

    // Verify the renamed title appears in the session list
    const titles = await sidebar.getSessionTitles();
    const found = titles.some((t) => t.includes(newTitle));
    expect(found).toBe(true);
  });

  // ── Delete ──────────────────────────────────────────────────────────

  test('should delete a session from the sidebar', async ({ page }) => {
    // Create two sessions so delete is meaningful
    await sidebar.clickNewChat();
    await page.waitForTimeout(300);
    await sidebar.clickNewChat();
    await page.waitForTimeout(300);

    const initialCount = await sidebar.getSessionCount();
    expect(initialCount).toBeGreaterThanOrEqual(2);

    // Delete the first session
    await sidebar.deleteSession(0);
    await page.waitForTimeout(500);

    // Session count should decrease
    const newCount = await sidebar.getSessionCount();
    expect(newCount).toBe(initialCount - 1);
  });

  // ── Empty state after all deleted ───────────────────────────────────

  test('should show empty state when no sessions exist', async ({ page }) => {
    // Ensure expanded sidebar
    await sidebar.expand();
    await page.waitForTimeout(300);

    // With clean localStorage (from fixture), session list should be empty
    const sidebarText = await sidebar.sidebar.textContent();
    expect(sidebarText).toContain('No chats yet');
  });

  // ── Chats toggle hides/shows session list ──────────────────────────

  test('should toggle session list visibility via chats toggle', async ({ page }) => {
    await sidebar.expand();
    await expect(sidebar.chatsToggle).toBeVisible();

    // Create a session to populate the list
    await sidebar.clickNewChat();
    await page.waitForTimeout(300);

    // Toggle to hide sessions
    const initiallyVisible = await sidebar.sessionList.isVisible();
    await sidebar.chatsToggle.click();
    await page.waitForTimeout(400);

    const afterToggle = await sidebar.sessionList.isVisible();
    expect(afterToggle).toBe(!initiallyVisible);

    // Toggle back
    await sidebar.chatsToggle.click();
    await page.waitForTimeout(400);

    const afterSecondToggle = await sidebar.sessionList.isVisible();
    expect(afterSecondToggle).toBe(initiallyVisible);
  });
});
