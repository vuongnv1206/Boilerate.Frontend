import { registerLocaleData } from '@angular/common';
import localeVi from '@angular/common/locales/vi';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideContentFeature } from '../../index';
import { contentIoGuard } from '../../guards/content-io.guard';
import { CollectionKey, ContentSaveState } from '../../enums/content.enum';
import { ContentIoStore } from '../../state/content-io.store';
import { ContentIo } from './content-io';

registerLocaleData(localeVi);

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );
});

afterEach(() => {
  TestBed.resetTestingModule();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function setup(id: string) {
  const events = new Subject<NavigationEnd>();
  const snapshot = {
    paramMap: convertToParamMap({ id }),
    queryParamMap: convertToParamMap({ collection: CollectionKey.Products }),
  };
  TestBed.configureTestingModule({
    providers: [
      provideContentFeature(),
      ContentIoStore,
      { provide: Router, useValue: { events, navigate: vi.fn() } },
      { provide: ActivatedRoute, useValue: { snapshot } },
    ],
  });
  const page = TestBed.runInInjectionContext(() => new ContentIo());
  const navigate = (nextId: string, collection = CollectionKey.Products) => {
    snapshot.paramMap = convertToParamMap({ id: nextId });
    snapshot.queryParamMap = convertToParamMap({ collection });
    events.next(
      new NavigationEnd(
        1,
        `/admin/items/${nextId}?collection=${collection}`,
        `/admin/items/${nextId}?collection=${collection}`,
      ),
    );
  };
  return { page, store: page.store, navigate };
}

describe('ContentIo route and leave coordination', () => {
  it('requires an explicit decision before leaving a published edit and awaits saving', async () => {
    vi.useFakeTimers();
    const { page, store } = setup('product-1');
    store.form.controls.name.setValue('Thay đổi chưa lưu');
    store.form.markAsDirty();
    vi.advanceTimersByTime(1000);
    expect(store.form.dirty).toBe(true);
    const leave = page.confirmLeave();
    expect(page.leaveOpen()).toBe(true);
    await page.resolveLeave(true, true);
    expect(await leave).toBe(true);
    expect(store.item()?.name).toBe('Thay đổi chưa lưu');
    expect(store.form.pristine).toBe(true);
  });

  it('autosaves a valid draft before leaving and keeps invalid content in the confirmation dialog', async () => {
    const { page, store } = setup('product-3');
    store.form.controls.name.setValue('Bản nháp đã chỉnh');
    store.form.markAsDirty();
    expect(await page.confirmLeave()).toBe(true);
    expect(page.leaveOpen()).toBe(false);
    expect(store.item()?.name).toBe('Bản nháp đã chỉnh');
    store.form.controls.name.setValue('   ');
    store.form.markAsDirty();
    const leave = page.confirmLeave();
    expect(page.leaveOpen()).toBe(true);
    await page.resolveLeave(true, true);
    expect(page.leaveOpen()).toBe(true);
    await page.resolveLeave(false);
    expect(await leave).toBe(false);
  });

  it('resets a reused page only after a completed navigation with changed record identity', () => {
    const { store, navigate } = setup('new');
    const originalId = store.item()?.id;
    navigate('new', CollectionKey.Products);
    expect(store.item()?.id).toBe(originalId);
    navigate('new', CollectionKey.Categories);
    expect(store.definition().key).toBe(CollectionKey.Categories);
    expect(store.item()?.id).not.toBe(originalId);
    expect(store.form.pristine).toBe(true);
    expect(store.saveState()).toBe(ContentSaveState.New);
    navigate('product-2');
    expect(store.form.controls.name.value).toBe('Đèn bàn Studio');
  });

  it('runs the dirty guard before a query-only navigation replaces the new-item form', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideContentFeature(),
        provideRouter([
          {
            path: 'admin/items/:id',
            component: ContentIo,
            canDeactivate: [contentIoGuard],
            runGuardsAndResolvers: 'paramsOrQueryParamsChange',
          },
        ]),
      ],
    });
    TestBed.overrideComponent(ContentIo, { set: { template: '', imports: [] } });
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/admin/items/new?collection=products', ContentIo);
    page.store.form.controls.name.setValue('   ');
    page.store.form.markAsDirty();
    const router = TestBed.inject(Router);
    const navigation = router.navigateByUrl('/admin/items/new?collection=categories');
    await vi.waitFor(() => expect(page.leaveOpen()).toBe(true));
    expect(page.store.definition().key).toBe(CollectionKey.Products);
    await page.resolveLeave(false);
    expect(await navigation).toBe(false);
    expect(router.url).toBe('/admin/items/new?collection=products');
    const retry = router.navigateByUrl('/admin/items/new?collection=categories');
    await vi.waitFor(() => expect(page.leaveOpen()).toBe(true));
    await page.resolveLeave(true);
    expect(await retry).toBe(true);
    expect(page.store.definition().key).toBe(CollectionKey.Categories);
    expect(page.store.form.controls.name.value).toBe('');
    expect(page.store.form.pristine).toBe(true);
  });

  it('focuses the narrow inspector, makes the form inert and returns focus after Escape or backdrop', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideContentFeature(),
        provideRouter([{ path: 'admin/items/:id', component: ContentIo }]),
      ],
    });
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/admin/items/product-1', ContentIo);
    const host = harness.routeNativeElement;
    if (!host) throw new Error('Editor did not render.');
    const trigger = host.querySelector<HTMLButtonElement>('[aria-controls="item-inspector"]');
    const close = host.querySelector<HTMLButtonElement>('.inspector-heading button');
    const inspector = host.querySelector<HTMLElement>('#item-inspector');
    if (!trigger || !close || !inspector) throw new Error('Inspector controls did not render.');
    trigger.focus();
    trigger.click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(page.inspectorModal()).toBe(true);
    expect(inspector.getAttribute('role')).toBe('dialog');
    expect(inspector.getAttribute('aria-modal')).toBe('true');
    expect(host.querySelector('.editor-main')?.hasAttribute('inert')).toBe(true);
    expect(host.querySelector('.editor-toolbar')?.hasAttribute('inert')).toBe(true);
    await vi.waitFor(() => expect(document.activeElement).toBe(close));
    close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(page.inspectorModal()).toBe(false);
    expect(host.querySelector('.editor-main')?.hasAttribute('inert')).toBe(false);
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger));
    trigger.click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    await vi.waitFor(() => expect(document.activeElement).toBe(close));
    host.querySelector<HTMLButtonElement>('.inspector-backdrop')?.click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(page.inspectorModal()).toBe(false);
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
