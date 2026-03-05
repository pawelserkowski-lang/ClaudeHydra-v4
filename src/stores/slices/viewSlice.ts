import type { StateCreator } from 'zustand';
import type { ViewId } from '../types';
import type { ViewStoreState } from '../viewStore';

export interface ViewSlice {
  currentView: ViewId;
  sidebarCollapsed: boolean;
  mobileDrawerOpen: boolean;
  activeArtifact: import('../types').Artifact | null;

  setView: (view: ViewId) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setMobileDrawerOpen: (open: boolean) => void;
  setActiveArtifact: (artifact: import('../types').Artifact | null) => void;
}

export const createViewSlice: StateCreator<ViewStoreState, [], [], ViewSlice> = (set) => ({
  currentView: 'home',
  sidebarCollapsed: false,
  mobileDrawerOpen: false,
  activeArtifact: null,

  setView: (view) => set({ currentView: view }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setMobileDrawerOpen: (open) => set({ mobileDrawerOpen: open }),
  setActiveArtifact: (artifact) => set({ activeArtifact: artifact }),
});

