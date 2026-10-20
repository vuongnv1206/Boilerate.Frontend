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
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { Dialog } from 'primeng/dialog';
import { distinctUntilChanged, filter, map, startWith } from 'rxjs';
import { ContentState } from '@shared/ui/content-state/content-state';
import { Icon } from '@shared/ui/icon/icon';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';
import { ContentForm } from '../../components/content-form/content-form';
import { ContentInspector } from '../../components/content-inspector/content-inspector';
import { CONTENT_INSPECTOR_MEDIA_QUERY } from '../../constants/content-editor.constants';
import { ContentSaveState, ContentStatus } from '../../enums/content.enum';
import { collectionDefinition } from '../../models/content-item';
import { ContentIoStore } from '../../state/content-io.store';

@Component({
  selector: 'app-content-io',
  imports: [RouterLink, Dialog, ContentForm, ContentInspector, ContentState, Icon, StatusBadge],
  providers: [ContentIoStore],
  templateUrl: './content-io.html',
  styleUrl: './content-io.scss',
})
export class ContentIo {
  readonly store = inject(ContentIoStore);
  readonly contentSaveState = ContentSaveState;
  readonly contentStatus = ContentStatus;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly inspectorToggle = viewChild<ElementRef<HTMLButtonElement>>('inspectorToggle');
  private readonly inspector = viewChild(ContentInspector);
  private readonly inspectorQuery = window.matchMedia(CONTENT_INSPECTOR_MEDIA_QUERY);
  readonly narrowInspector = signal(this.inspectorQuery.matches);
  readonly inspectorOpen = signal(false);
  readonly inspectorModal = computed(() => this.inspectorOpen() && this.narrowInspector());
  readonly confirmPublish = signal(false);
  readonly leaveOpen = signal(false);
  private leaveResolver?: (leave: boolean) => void;

  constructor() {
    const onViewportChange = (event: MediaQueryListEvent) => {
      this.narrowInspector.set(event.matches);
      if (!event.matches) this.inspectorOpen.set(false);
    };
    this.inspectorQuery.addEventListener('change', onViewportChange);
    this.destroyRef.onDestroy(() => {
      this.inspectorQuery.removeEventListener('change', onViewportChange);
      this.leaveResolver?.(false);
    });
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        startWith(null),
        map(() => ({
          id: this.route.snapshot.paramMap.get('id') ?? '',
          collection: collectionDefinition(this.route.snapshot.queryParamMap.get('collection')).key,
        })),
        distinctUntilChanged(
          (previous, current) =>
            previous.id === current.id && previous.collection === current.collection,
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ id, collection }) => this.store.load(id, collection));
  }

  retryLoad(): void {
    this.store.load(
      this.route.snapshot.paramMap.get('id') ?? '',
      collectionDefinition(this.route.snapshot.queryParamMap.get('collection')).key,
    );
  }

  toggleInspector(): void {
    if (this.inspectorOpen()) this.closeInspector();
    else {
      this.inspectorOpen.set(true);
      afterNextRender(() => this.inspector()?.focusClose(), { injector: this.injector });
    }
  }

  @HostListener('document:keydown.escape')
  closeInspector(restoreFocus = true): void {
    if (!this.inspectorOpen()) return;
    this.inspectorOpen.set(false);
    if (restoreFocus)
      afterNextRender(() => this.inspectorToggle()?.nativeElement.focus(), {
        injector: this.injector,
      });
  }

  async publish(): Promise<void> {
    if (await this.store.publish()) this.confirmPublish.set(false);
    else if (this.store.form.invalid) this.confirmPublish.set(false);
  }

  confirmLeave(): boolean | Promise<boolean> {
    this.closeInspector(false);
    if (!this.store.form.dirty && !this.store.busy()) return true;
    if (this.store.item()?.status === ContentStatus.Draft && this.store.form.valid) {
      return this.store.save(false).then((saved) => saved && !this.store.form.dirty);
    }
    this.leaveOpen.set(true);
    return new Promise<boolean>((resolve) => {
      this.leaveResolver = resolve;
    });
  }

  async resolveLeave(leave: boolean, save = false): Promise<void> {
    if (save && !(await this.store.save())) return;
    this.leaveOpen.set(false);
    this.leaveResolver?.(leave);
    this.leaveResolver = undefined;
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.store.form.dirty || this.store.busy()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
}
