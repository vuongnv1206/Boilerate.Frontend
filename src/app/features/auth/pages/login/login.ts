import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { InputText } from 'primeng/inputtext';
import { Button } from 'primeng/button';
import { LoginStore } from '@stores/login.store';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, InputText, Button],
  providers: [LoginStore],
  templateUrl: './login.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly route = inject(ActivatedRoute);
  readonly store = inject(LoginStore);

  signIn(): void {
    this.store.signIn(this.route.snapshot.queryParamMap.get('returnUrl'));
  }

  restore(): void {
    this.store.restore(this.route.snapshot.queryParamMap.get('returnUrl'));
  }
}
