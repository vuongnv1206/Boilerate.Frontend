import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminShell } from './admin-shell';
import { ItemEditor } from '../../features/content-workspace/item-editor/item-editor';
import { itemEditorGuard } from '../../features/content-workspace/item-editor/item-editor.guard';

describe('Workspace navigation accessibility', () => {
  let mobile = true;

  beforeEach(() => {
    localStorage.clear();
    mobile = true;
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: mobile,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    );
    TestBed.configureTestingModule({ imports: [AdminShell], providers: [provideRouter([])] });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('announces a closed mobile panel and confines modal navigation until Escape', async () => {
    const fixture = TestBed.createComponent(AdminShell);
    fixture.detectChanges();
    await fixture.whenStable();
    const host: HTMLElement = fixture.nativeElement;
    const toggle = host.querySelector<HTMLButtonElement>('.show-panel');
    if (!toggle) throw new Error('Panel toggle was not rendered');
    const panelClose = host.querySelector<HTMLButtonElement>('.context-panel button');
    if (!panelClose) throw new Error('Panel close button was not rendered');
    const focusPanelClose = vi.spyOn(panelClose, 'focus');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const panel = host.querySelector<HTMLElement>('.context-panel');
    if (!panel) throw new Error('Context panel was not rendered');
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.getAttribute('aria-modal')).toBe('true');
    await vi.waitFor(() => {
      expect(focusPanelClose).toHaveBeenCalledOnce();
      expect(document.activeElement).toBe(panel.querySelector('button'));
    });
    expect(host.querySelector('main')?.hasAttribute('inert')).toBe(true);
    expect(host.querySelector('header')?.hasAttribute('inert')).toBe(true);
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.mobileOpen()).toBe(false);
    expect(host.querySelector('main')?.hasAttribute('inert')).toBe(false);
    await vi.waitFor(() => expect(document.activeElement).toBe(toggle));
  });

  it('focuses the current workspace through the skip link without navigating away', () => {
    const fixture = TestBed.createComponent(AdminShell);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    const link = host.querySelector<HTMLAnchorElement>('.skip-link');
    if (!link) throw new Error('Skip link was not rendered');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(host.querySelector('main'));
  });

  it('clamps keyboard resizing and restores layout preferences after recreation', () => {
    mobile = false;
    const fixture = TestBed.createComponent(AdminShell);
    const shell = fixture.componentInstance;
    shell.resizeWithKey(new KeyboardEvent('keydown', { key: 'End' }));
    shell.resizeWithKey(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(shell.sidebarWidth()).toBe(320);
    shell.resizeWithKey(new KeyboardEvent('keydown', { key: 'Home' }));
    shell.resizeWithKey(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(shell.sidebarWidth()).toBe(200);
    shell.toggleSidebar();
    fixture.destroy();
    const restored = TestBed.createComponent(AdminShell).componentInstance;
    expect(restored.sidebarWidth()).toBe(200);
    expect(restored.collapsed()).toBe(true);
  });

  it('releases mobile navigation before a dirty guard opens and keeps the editor usable after cancellation', async () => {
    TestBed.overrideComponent(ItemEditor, {
      set: {
        imports: [],
        template:
          '@if (leaveOpen()) { <div role="dialog" tabindex="0">Bạn có thay đổi chưa lưu</div> }',
      },
    });
    const router = TestBed.inject(Router);
    router.resetConfig([
      {
        path: 'admin/items/:id',
        component: ItemEditor,
        canDeactivate: [itemEditorGuard],
        runGuardsAndResolvers: 'paramsOrQueryParamsChange',
      },
    ]);
    const fixture = TestBed.createComponent(AdminShell);
    fixture.detectChanges();
    await router.navigateByUrl('/admin/items/new?collection=products');
    fixture.detectChanges();
    await fixture.whenStable();
    const host: HTMLElement = fixture.nativeElement;
    const editor = fixture.debugElement.query(
      (element) => element.componentInstance instanceof ItemEditor,
    )?.componentInstance as ItemEditor | undefined;
    if (!editor) throw new Error('Editor route did not render.');
    editor.form.controls.name.setValue('   ');
    editor.form.markAsDirty();
    fixture.componentInstance.toggleSidebar();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.querySelector('main')?.hasAttribute('inert')).toBe(true);
    const navigation = router.navigateByUrl('/admin/items/new?collection=categories');
    await vi.waitFor(() => expect(editor.leaveOpen()).toBe(true));
    fixture.detectChanges();
    expect(fixture.componentInstance.mobileOpen()).toBe(false);
    expect(host.querySelector('.context-panel')?.getAttribute('aria-modal')).toBeNull();
    expect(host.querySelector('main')?.hasAttribute('inert')).toBe(false);
    const dialog = host.querySelector<HTMLElement>('main [role="dialog"]');
    if (!dialog) throw new Error('Dirty guard dialog did not render.');
    expect(dialog.closest('[inert]')).toBeNull();
    dialog.focus();
    expect(document.activeElement).toBe(dialog);
    editor.resolveLeave(false);
    expect(await navigation).toBe(false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(router.url).toBe('/admin/items/new?collection=products');
    expect(editor.form.controls.name.value).toBe('   ');
    expect(host.querySelector('main')?.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(host.querySelector('main'));
  });
});
