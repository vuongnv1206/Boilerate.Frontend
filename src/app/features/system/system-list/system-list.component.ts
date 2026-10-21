import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { SystemListStore } from '@stores/system-list.store';
import { FunctionGroupDto } from '@models/system.dto';
import { SystemKind, SystemRow } from '@models/system.model';
import { createFunctionGroupForm } from '@forms/system.form';
import { listQueryParams, readListQuery } from '@utils/list-query.util';
import { Icon } from '@shared/ui/icon/icon.component';
import { ContentState } from '@shared/ui/content-state/content-state.component';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog.component';
import { LeaveConfirmation } from '@shared/ui/confirm-dialog/leave-confirmation';

@Component({
  selector: 'app-system-list',
  host: { class: 'collection-screen system-screen' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Dialog, InputText, ReactiveFormsModule, Icon, ContentState, ConfirmDialog],
  providers: [SystemListStore, LeaveConfirmation],
  templateUrl: './system-list.component.html',
})
export class SystemList implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly store = inject(SystemListStore);
  readonly confirmation = inject(LeaveConfirmation);
  readonly deleteTarget = signal<SystemRow | null>(null);
  readonly deleteGroupTarget = signal<FunctionGroupDto | null>(null);
  readonly groupOpen = signal(false);
  readonly groupTarget = signal<FunctionGroupDto | null>(null);
  readonly groupForm = createFunctionGroupForm();
  readonly searchTerm = signal('');
  ngOnInit(): void {
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const query = readListQuery(params);
      this.searchTerm.set(query.q);
      this.store.load(this.route.snapshot.data['kind'] as SystemKind, query.q, query.page);
    });
  }
  search(value: string): void {
    this.navigate(value, 1);
  }
  setPage(page: number): void {
    this.navigate(this.searchTerm(), page);
  }
  openGroups(): void {
    this.editGroup(null);
    this.groupOpen.set(true);
  }
  editGroup(group: FunctionGroupDto | null): void {
    this.groupTarget.set(group);
    this.groupForm.reset({
      code: group?.code ?? '',
      name: group?.name ?? '',
      sortOrder: group?.sortOrder ?? 0,
    });
    this.groupForm.enable();
    if (group) this.groupForm.controls.code.disable();
  }
  async chooseGroup(group: FunctionGroupDto | null): Promise<void> {
    if (await this.confirmation.request(this.groupForm.dirty, this.store.saving()))
      this.editGroup(group);
  }
  async closeGroups(): Promise<void> {
    if (await this.confirmLeave()) this.groupOpen.set(false);
  }
  saveGroup(): void {
    this.groupForm.markAllAsTouched();
    if (this.groupForm.invalid) return;
    const value = this.groupForm.getRawValue();
    this.store
      .saveGroup(this.groupTarget()?.id ?? null, {
        ...value,
        name: value.name.trim(),
        version: this.groupTarget()?.version,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((saved) => this.editGroup(saved));
  }
  delete(): void {
    const group = this.deleteGroupTarget();
    const row = this.deleteTarget();
    const request = group ? this.store.deleteGroup(group) : row ? this.store.delete(row) : null;
    request?.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.deleteTarget.set(null);
      this.deleteGroupTarget.set(null);
      if (group?.id === this.groupTarget()?.id) this.editGroup(null);
    });
  }
  closeDelete(): void {
    if (!this.store.saving()) {
      this.deleteTarget.set(null);
      this.deleteGroupTarget.set(null);
    }
  }
  confirmLeave(): boolean | Promise<boolean> {
    return this.confirmation.request(this.groupOpen() && this.groupForm.dirty, this.store.saving());
  }
  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if ((this.groupOpen() && this.groupForm.dirty) || this.store.saving()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
  private navigate(q: string, page: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: listQueryParams({ q, page }),
      replaceUrl: true,
    });
  }
}
