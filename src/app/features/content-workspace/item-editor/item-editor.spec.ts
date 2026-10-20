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
import { DemoContentStore } from '../demo-content-store';
import { ItemEditor } from './item-editor';
import { itemEditorGuard } from './item-editor.guard';

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

function setup(id: string) {
  const events = new Subject<NavigationEnd>();
  const snapshot = {
    paramMap: convertToParamMap({ id }),
    queryParamMap: convertToParamMap({ collection: 'products' }),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: Router, useValue: { events, navigate: vi.fn() } },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot,
        },
      },
    ],
  });
  const editor = TestBed.runInInjectionContext(() => new ItemEditor());
  const store = TestBed.inject(DemoContentStore);
  const navigate = (nextId: string, collection = 'products') => {
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
  return { editor, store, navigate };
}

afterEach(() => {
  TestBed.resetTestingModule();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Editor draft and explicit-save behavior', () => {
  it('debounces valid draft changes while published content waits for explicit save', () => {
    vi.useFakeTimers();
    const { editor, store } = setup('product-3');
    editor.form.controls.name.setValue('Tên bản nháp mới');
    editor.form.markAsDirty();
    vi.advanceTimersByTime(699);
    expect(store.get('product-3')?.name).toBe('Tai nghe Quiet Hours');
    vi.advanceTimersByTime(1);
    expect(store.get('product-3')?.name).toBe('Tên bản nháp mới');
    expect(editor.form.pristine).toBe(true);
  });

  it('requires an explicit save or a decision before leaving a published edit', async () => {
    vi.useFakeTimers();
    const { editor, store } = setup('product-1');
    editor.form.controls.name.setValue('Thay đổi chưa lưu');
    editor.form.markAsDirty();
    vi.advanceTimersByTime(1000);
    expect(store.get('product-1')?.name).toBe('Túi Everyday Tote');
    const leave = editor.confirmLeave();
    expect(editor.leaveOpen()).toBe(true);
    editor.resolveLeave(true, true);
    expect(await leave).toBe(true);
    expect(store.get('product-1')?.name).toBe('Thay đổi chưa lưu');
  });

  it('keeps a manually entered new-item slug after draft autosave', () => {
    vi.useFakeTimers();
    const { editor, store } = setup('new');
    editor.form.controls.name.setValue('Đèn mới');
    expect(editor.form.controls.slug.value).toBe('den-moi');
    editor.form.controls.slug.setValue('custom-slug');
    editor.form.markAsDirty();
    vi.advanceTimersByTime(700);
    editor.form.controls.name.setValue('Đèn phiên bản mới');
    expect(editor.form.controls.slug.value).toBe('custom-slug');
    const id = editor.item()?.id ?? '';
    expect(store.get(id)?.slug).toBe('custom-slug');
  });

  it('does not save invalid changes and reloads a reused editor for a new route id', () => {
    vi.useFakeTimers();
    const { editor, store, navigate } = setup('product-3');
    editor.form.controls.name.setValue('');
    editor.form.markAsDirty();
    vi.advanceTimersByTime(1000);
    expect(editor.save()).toBe(false);
    expect(store.get('product-3')?.name).toBe('Tai nghe Quiet Hours');
    navigate('product-2');
    expect(editor.form.controls.name.value).toBe('Đèn bàn Studio');
    expect(editor.form.pristine).toBe(true);
  });

  it('rejects whitespace-only names before autosave or manual save can reach the store', () => {
    vi.useFakeTimers();
    const { editor, store } = setup('product-3');
    const save = vi.spyOn(store, 'save');
    editor.form.controls.name.setValue(' \t\n ');
    editor.form.controls.name.markAsDirty();
    expect(editor.form.controls.name.hasError('required')).toBe(true);
    expect(editor.invalid('name')).toBe(true);
    expect(editor.saveState()).toBe('invalid');
    expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
    expect(editor.save()).toBe(false);
    expect(save).not.toHaveBeenCalled();
    expect(store.get('product-3')?.name).toBe('Tai nghe Quiet Hours');
  });

  it('loads a new collection on a completed query-only navigation, without resetting for unrelated events', () => {
    const { editor, navigate } = setup('new');
    const originalId = editor.item()?.id;
    navigate('new', 'products');
    expect(editor.item()?.id).toBe(originalId);
    navigate('new', 'categories');
    expect(editor.definition().key).toBe('categories');
    expect(editor.item()?.id).not.toBe(originalId);
    expect(editor.form.pristine).toBe(true);
    expect(editor.saveState()).toBe('new');
  });

  it('runs the dirty guard for a query-only change before replacing a new editor', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'admin/items/:id',
            component: ItemEditor,
            canDeactivate: [itemEditorGuard],
            runGuardsAndResolvers: 'paramsOrQueryParamsChange',
          },
        ]),
      ],
    });
    TestBed.overrideComponent(ItemEditor, { set: { template: '', imports: [] } });
    const harness = await RouterTestingHarness.create();
    const editor = await harness.navigateByUrl('/admin/items/new?collection=products', ItemEditor);
    editor.form.controls.name.setValue('   ');
    editor.form.markAsDirty();
    const router = TestBed.inject(Router);
    const navigation = router.navigateByUrl('/admin/items/new?collection=categories');
    await vi.waitFor(() => expect(editor.leaveOpen()).toBe(true));
    expect(editor.definition().key).toBe('products');
    editor.resolveLeave(false);
    expect(await navigation).toBe(false);
    expect(router.url).toBe('/admin/items/new?collection=products');
    const retry = router.navigateByUrl('/admin/items/new?collection=categories');
    await vi.waitFor(() => expect(editor.leaveOpen()).toBe(true));
    editor.resolveLeave(true);
    expect(await retry).toBe(true);
    expect(editor.definition().key).toBe('categories');
    expect(editor.form.controls.name.value).toBe('');
    expect(editor.form.pristine).toBe(true);
  });

  it('focuses the narrow inspector, makes the form inert and returns focus after Escape or backdrop', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'admin/items/:id', component: ItemEditor }])],
    });
    const harness = await RouterTestingHarness.create();
    const editor = await harness.navigateByUrl('/admin/items/product-1', ItemEditor);
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
    expect(editor.inspectorModal()).toBe(true);
    expect(inspector.getAttribute('role')).toBe('dialog');
    expect(inspector.getAttribute('aria-modal')).toBe('true');
    expect(host.querySelector('.editor-main')?.hasAttribute('inert')).toBe(true);
    expect(host.querySelector('.editor-toolbar')?.hasAttribute('inert')).toBe(true);
    await vi.waitFor(() => expect(document.activeElement).toBe(close));
    close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(editor.inspectorModal()).toBe(false);
    expect(host.querySelector('.editor-main')?.hasAttribute('inert')).toBe(false);
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger));
    trigger.click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    await vi.waitFor(() => expect(document.activeElement).toBe(close));
    host.querySelector<HTMLButtonElement>('.inspector-backdrop')?.click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(editor.inspectorModal()).toBe(false);
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
