import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { ContentWorkspaceNavigation } from './content-navigation';
import { DemoContentStore } from './demo-content-store';

describe('Content navigation adapter', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('updates shell presentation counts when demo records are created or removed', () => {
    const navigation = TestBed.inject(ContentWorkspaceNavigation);
    const store = TestBed.inject(DemoContentStore);
    const products = () => navigation.collections().find((link) => link.key === 'products');
    const initialCount = products()?.count;
    expect(initialCount).toBe(14);
    const item = store.draft('products');
    const saved = store.save({ ...item, name: 'Thử adapter', slug: 'thu-adapter' });
    expect(products()?.count).toBe(15);
    expect(products()?.path).toBe('/admin/collections/products');
    store.remove(new Set([saved.id]));
    expect(products()?.count).toBe(initialCount);
  });
});
