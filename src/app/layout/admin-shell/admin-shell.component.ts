import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  Inject,
  Injector,
  Optional,
  afterNextRender,
  computed,
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
} from '@angular/router';
import { AuthSession } from '@core/auth/auth-session';
import { WORKSPACE_NAVIGATION, WorkspaceNavigation } from '@core/navigation/workspace-navigation';
import {
  NOTIFICATION_BADGE,
  NotificationBadgeState,
} from '@core/realtime/notification-badge.token';
import { ThemeController } from '@core/theme/theme-controller';
import { SHARED_IMPORTS } from '@shared/shared-imports';
import { focusWhenVisible } from '@shared/ui/focus-when-visible';
import { ADMIN_LAYOUT, ADMIN_THEME_OPTIONS } from './admin-shell.constants';
import { AdminStyles } from './admin-styles.component';

function preference(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

@Component({
  selector: 'app-admin-shell',
  imports: [SHARED_IMPORTS, AdminStyles],
  templateUrl: './admin-shell.component.html',
  styleUrl: '../../../styles/admin/_shell.scss',
})
export class AdminShell {
  // System variables
  private readonly panelToggle = viewChild<ElementRef<HTMLButtonElement>>('panelToggle');
  private readonly contextPanel = viewChild<ElementRef<HTMLElement>>('contextPanel');
  private focusAfterNavigation = false;
  private readonly mobileQuery = window.matchMedia(ADMIN_LAYOUT.mobileQuery);
  private helpOpenedFromMobile = false;

  // Business variables
  readonly themeModes = ADMIN_THEME_OPTIONS;
  readonly layout = ADMIN_LAYOUT;
  readonly isMobile = signal(this.mobileQuery.matches);
  readonly currentUrl = signal('');
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

  readonly unreadCount = computed(() => this.notificationBadge?.unreadCount() ?? 0);
  readonly canCreateProduct = computed(() => this.session.can('Product', 'Create'));
  readonly operationLinks = computed(() =>
    this.navigation
      .collections()
      .filter((link) => ['overview', 'orders', 'renewals', 'discounts'].includes(link.key)),
  );
  readonly catalogLinks = computed(() =>
    this.navigation
      .collections()
      .filter(
        (link) =>
          ![
            'overview',
            'orders',
            'renewals',
            'discounts',
            'storefront-settings',
            'outbox',
          ].includes(link.key),
      ),
  );
  readonly settingsLinks = computed(() =>
    this.navigation
      .collections()
      .filter((link) => ['storefront-settings', 'outbox'].includes(link.key)),
  );

  constructor(
    public readonly theme: ThemeController,
    @Inject(WORKSPACE_NAVIGATION) public readonly navigation: WorkspaceNavigation,
    @Optional()
    @Inject(NOTIFICATION_BADGE)
    public readonly notificationBadge: NotificationBadgeState | null,
    private readonly router: Router,
    private readonly session: AuthSession,
    private readonly destroyRef: DestroyRef,
    private readonly injector: Injector,
  ) {
    this.currentUrl.set(this.router.url);
    this.notificationBadge?.refresh();
    const onViewportChange = (event: MediaQueryListEvent) => {
      this.isMobile.set(event.matches);
      if (!event.matches) this.mobileOpen.set(false);
    };
    this.mobileQuery.addEventListener('change', onViewportChange);
    this.destroyRef.onDestroy(() =>
      this.mobileQuery.removeEventListener('change', onViewportChange),
    );
    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
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
