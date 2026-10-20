import { A11yModule } from '@angular/cdk/a11y';
import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { ThemeController } from '../../core/theme/theme-controller';
import { WORKSPACE_NAVIGATION } from '../../core/navigation/workspace-navigation';
import { Icon } from '../../shared/ui/icon/icon';
import { focusWhenVisible } from '../../shared/ui/focus-when-visible';

function preference(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

@Component({
  selector: 'app-admin-shell',
  imports: [A11yModule, RouterOutlet, RouterLink, RouterLinkActive, Icon, DialogModule],
  templateUrl: './admin-shell.html',
  styleUrl: './admin-shell.scss',
})
export class AdminShell {
  readonly theme = inject(ThemeController);
  readonly navigation = inject(WORKSPACE_NAVIGATION);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly panelToggle = viewChild<ElementRef<HTMLButtonElement>>('panelToggle');
  private readonly contextPanel = viewChild<ElementRef<HTMLElement>>('contextPanel');
  private focusAfterNavigation = false;
  private readonly mobileQuery = window.matchMedia('(max-width: 760px)');
  readonly isMobile = signal(this.mobileQuery.matches);
  readonly currentUrl = signal(this.router.url);
  readonly isGallery = computed(() => this.currentUrl().includes('/controls'));
  readonly sidebarWidth = signal(
    Math.min(320, Math.max(200, Number(preference('boilerate.context-width', '240')) || 240)),
  );
  readonly collapsed = signal(preference('boilerate.context-collapsed', 'false') === 'true');
  readonly mobileOpen = signal(false);
  readonly helpOpen = signal(false);
  readonly resizing = signal(false);
  private helpOpenedFromMobile = false;
  readonly themeModes = [
    { mode: 'light', label: 'Sáng', icon: 'sun' },
    { mode: 'dark', label: 'Tối', icon: 'moon' },
    { mode: 'system', label: 'Hệ thống', icon: 'monitor' },
  ] as const;

  constructor() {
    const onViewportChange = (event: MediaQueryListEvent) => {
      this.isMobile.set(event.matches);
      if (!event.matches) this.mobileOpen.set(false);
    };
    this.mobileQuery.addEventListener('change', onViewportChange);
    this.destroyRef.onDestroy(() =>
      this.mobileQuery.removeEventListener('change', onViewportChange),
    );
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationStart && this.mobileOpen()) {
        this.focusAfterNavigation = true;
        this.mobileOpen.set(false);
      }
      if (event instanceof NavigationEnd) {
        this.currentUrl.set(event.urlAfterRedirects);
        this.mobileOpen.set(false);
      }
      if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        if (this.focusAfterNavigation) {
          this.focusAfterNavigation = false;
          afterNextRender(() => document.getElementById('workspace-main')?.focus(), {
            injector: this.injector,
          });
        }
      }
    });
  }

  toggleSidebar(): void {
    if (this.isMobile()) {
      if (this.mobileOpen()) this.closeMobilePanel();
      else {
        this.mobileOpen.set(true);
        afterNextRender(
          () => {
            const panel = this.contextPanel()?.nativeElement;
            focusWhenVisible(panel, panel?.querySelector<HTMLButtonElement>('button'), () =>
              this.mobileOpen(),
            );
          },
          { injector: this.injector },
        );
      }
      return;
    }
    this.collapsed.update((value) => !value);
    this.persist();
  }

  @HostListener('document:keydown.escape')
  closeMobilePanel(): void {
    if (!this.mobileOpen()) return;
    this.mobileOpen.set(false);
    afterNextRender(() => this.panelToggle()?.nativeElement.focus(), { injector: this.injector });
  }

  skipNavigation(event: Event): void {
    event.preventDefault();
    document.getElementById('workspace-main')?.focus();
  }

  openHelp(): void {
    this.helpOpenedFromMobile = this.mobileOpen();
    this.mobileOpen.set(false);
    this.helpOpen.set(true);
  }

  restoreHelpFocus(): void {
    if (this.helpOpenedFromMobile) this.panelToggle()?.nativeElement.focus();
    this.helpOpenedFromMobile = false;
  }

  beginResize(event: PointerEvent): void {
    if (!(event.currentTarget instanceof HTMLElement)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    this.resizing.set(true);
    event.preventDefault();
  }

  resize(event: PointerEvent): void {
    if (this.resizing()) this.sidebarWidth.set(Math.min(320, Math.max(200, event.clientX - 44)));
  }

  endResize(): void {
    this.resizing.set(false);
    this.persist();
  }

  resizeWithKey(event: KeyboardEvent): void {
    const widths: Record<string, number> = {
      ArrowLeft: this.sidebarWidth() - 8,
      ArrowRight: this.sidebarWidth() + 8,
      Home: 200,
      End: 320,
    };
    const width = widths[event.key];
    if (width === undefined) return;
    event.preventDefault();
    this.sidebarWidth.set(Math.max(200, Math.min(320, width)));
    this.persist();
  }

  private persist(): void {
    try {
      localStorage.setItem('boilerate.context-width', String(this.sidebarWidth()));
      localStorage.setItem('boilerate.context-collapsed', String(this.collapsed()));
    } catch {
      /* Preferences are optional when storage is unavailable. */
    }
  }
}
