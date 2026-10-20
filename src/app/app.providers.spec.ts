import { EnvironmentInjector, createEnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { WORKSPACE_NAVIGATION } from './core/navigation/workspace-navigation';
import { provideWorkspaceNavigation } from './app.providers';

describe('Admin route composition', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('creates an admin-scoped navigation session rather than a root feature singleton', () => {
    const parent = TestBed.inject(EnvironmentInjector);
    const firstAdmin = createEnvironmentInjector(provideWorkspaceNavigation(), parent);
    const secondAdmin = createEnvironmentInjector(provideWorkspaceNavigation(), parent);
    try {
      const first = firstAdmin.get(WORKSPACE_NAVIGATION);
      expect(firstAdmin.get(WORKSPACE_NAVIGATION)).toBe(first);
      expect(secondAdmin.get(WORKSPACE_NAVIGATION)).not.toBe(first);
      expect(first.collections().map((link) => link.count)).toEqual([14, 6, 3]);
      expect(() => parent.get(WORKSPACE_NAVIGATION)).toThrow();
    } finally {
      firstAdmin.destroy();
      secondAdmin.destroy();
    }
  });
});
