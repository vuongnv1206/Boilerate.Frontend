import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { afterEach, describe, expect, it } from 'vitest';
import { ContentService } from '../data-access/content.service';
import { ContentNavigation } from './content-navigation';

describe('Content navigation adapter', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('reacts to the data contract without knowing the fixture implementation', () => {
    const counts = new BehaviorSubject({ products: 14, categories: 6, types: 3 });
    TestBed.configureTestingModule({
      providers: [
        ContentNavigation,
        { provide: ContentService, useValue: { collectionCounts$: counts.asObservable() } },
      ],
    });
    const navigation = TestBed.inject(ContentNavigation);
    const products = () => navigation.collections().find((link) => link.key === 'products');
    expect(products()).toEqual({
      key: 'products',
      label: 'Sản phẩm',
      icon: 'box',
      path: '/admin/collections/products',
      count: 14,
    });
    counts.next({ products: 15, categories: 6, types: 3 });
    expect(products()?.count).toBe(15);
  });
});
