import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { InputText } from 'primeng/inputtext';
import { Button } from 'primeng/button';
import { createLoginForm } from '@forms/login.form';
import { LoginStore } from '@stores/login.store';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, InputText, Button],
  providers: [LoginStore],
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly store = inject(LoginStore);
  readonly form = createLoginForm();

  signIn(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.store
      .signIn(this.form.getRawValue())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.router.navigateByUrl(this.target()));
  }
  restore(): void {
    this.store
      .restore()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((signedIn) => {
        if (signedIn) void this.router.navigateByUrl(this.target());
      });
  }
  retrySignOut(): void {
    this.store.retrySignOut().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }
  private target(): string {
    const value = this.route.snapshot.queryParamMap.get('returnUrl');
    return value && /^\/admin(?:[/?]|$)/u.test(value) ? value : '/admin';
  }
}
