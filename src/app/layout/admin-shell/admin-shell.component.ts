import { CdkTrapFocus } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
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
import { Dialog } from 'primeng/dialog';
import { ThemeController } from '@core/theme/theme-controller';
import { WORKSPACE_NAVIGATION } from '@core/navigation/workspace-navigation';
import { Icon } from '@shared/ui/icon/icon.component';
import { focusWhenVisible } from '@shared/ui/focus-when-visible';
import { ADMIN_LAYOUT, ADMIN_THEME_OPTIONS } from './admin-shell.constants';
import { AuthSession } from '@core/auth/auth-session';

function preference(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-shell',
  imports: [CdkTrapFocus, RouterOutlet, RouterLink, RouterLinkActive, Icon, Dialog],
  templateUrl: './admin-shell.component.html',
  styleUrl: '../../../styles/admin/_shell.scss',
})
export class AdminShell {
  readonly theme = inject(ThemeController);
  readonly navigation = inject(WORKSPACE_NAVIGATION);
  private readonly router = inject(Router);
  private readonly session = inject(AuthSession);
  readonly canCreateProduct = computed(() => this.session.can('Product', 'Create'));
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly panelToggle = viewChild<ElementRef<HTMLButtonElement>>('panelToggle');
  private readonly contextPanel = viewChild<ElementRef<HTMLElement>>('contextPanel');
  private focusAfterNavigation = false;
  private readonly mobileQuery = window.matchMedia(ADMIN_LAYOUT.mobileQuery);
  readonly isMobile = signal(this.mobileQuery.matches);
  readonly currentUrl = signal(this.router.url);
  readonly isGallery = computed(() => this.currentUrl().includes('/controls'));
  readonly isSystem = computed(() => this.currentUrl().includes('/system'));
  readonly sidebarWidth = signal(
    Math.min(
      ADMIN_LAYOUT.panelMax,
      Math.max(
        ADMIN_LAYOUT.panelMin,
        Number(preference(ADMIN_LAYOUT.widthStorageKey, String(ADMIN_LAYOUT.panelDefault))) ||
          ADMIN_LAYOUT.panelDefault,
      ),
    ),
  );
  readonly collapsed = signal(preference(ADMIN_LAYOUT.collapsedStorageKey, 'false') === 'true');
  readonly mobileOpen = signal(false);
  readonly helpOpen = signal(false);
  readonly resizing = signal(false);
  private helpOpenedFromMobile = false;
  readonly themeModes = ADMIN_THEME_OPTIONS;
  readonly layout = ADMIN_LAYOUT;

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

  async signOut(): Promise<void> {
    // Let the editor ask about unsaved changes before ending the session.
    if (await this.router.navigate(['/login'])) {
      this.session.signOut().subscribe();
    }
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
    if (this.resizing())
      this.sidebarWidth.set(
        Math.min(
          ADMIN_LAYOUT.panelMax,
          Math.max(ADMIN_LAYOUT.panelMin, event.clientX - ADMIN_LAYOUT.railWidth),
        ),
      );
  }

  endResize(): void {
    this.resizing.set(false);
    this.persist();
  }

  resizeWithKey(event: KeyboardEvent): void {
    const widths: Record<string, number> = {
      ArrowLeft: this.sidebarWidth() - ADMIN_LAYOUT.resizeStep,
      ArrowRight: this.sidebarWidth() + ADMIN_LAYOUT.resizeStep,
      Home: ADMIN_LAYOUT.panelMin,
      End: ADMIN_LAYOUT.panelMax,
    };
    const width = widths[event.key];
    if (width === undefined) return;
    event.preventDefault();
    this.sidebarWidth.set(Math.max(ADMIN_LAYOUT.panelMin, Math.min(ADMIN_LAYOUT.panelMax, width)));
    this.persist();
  }

  private persist(): void {
    try {
      localStorage.setItem(ADMIN_LAYOUT.widthStorageKey, String(this.sidebarWidth()));
      localStorage.setItem(ADMIN_LAYOUT.collapsedStorageKey, String(this.collapsed()));
    } catch {
      /* Preferences are optional when storage is unavailable. */
    }
  }
}
