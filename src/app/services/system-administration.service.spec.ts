import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideRuntimeConfig } from '@core/config/runtime-config.token';
import { SystemAdministrationService } from './system-administration.service';

describe('User administration transport', () => {
  let service: SystemAdministrationService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SystemAdministrationService,
        provideRuntimeConfig({ apiBaseUrl: '/api' }),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(SystemAdministrationService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('negotiates JSON string responses so success and validation use the same transport', () => {
    let created = '';
    service
      .createUser({
        firstName: 'Nhân viên',
        lastName: 'Mới',
        email: 'new@example.test',
        userName: 'new-worker',
        password: 'InitialPassword!234',
        confirmPassword: 'InitialPassword!234',
        phoneNumber: null,
      })
      .subscribe((message) => {
        created = message;
      });
    const create = http.expectOne('/api/users/create');
    expect(create.request.method).toBe('POST');
    expect(create.request.responseType).toBe('json');
    expect(create.request.headers.get('Accept')).toBe('application/json');
    create.flush('User new-worker Registered.');
    expect(created).toBe('User new-worker Registered.');
    let reset = '';
    service.requestUserPasswordReset('worker').subscribe((message) => {
      reset = message;
    });
    const request = http.expectOne('/api/users/worker/password-reset');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    expect(request.request.responseType).toBe('json');
    expect(request.request.headers.get('Accept')).toBe('application/json');
    request.flush('Request accepted.');
    expect(reset).toBe('Request accepted.');
  });

  it('sends profile version, empty-phone removal and image intent as multipart fields', () => {
    const image = new File(['image'], 'avatar.png', { type: 'image/png' });
    service
      .updateUser('worker', {
        version: 'v1',
        firstName: 'Nhân viên',
        lastName: 'Mới',
        email: 'worker@example.test',
        phoneNumber: null,
        image,
        deleteCurrentImage: true,
      })
      .subscribe();
    const request = http.expectOne('/api/users/worker');
    const form = request.request.body as FormData;
    expect(request.request.method).toBe('PUT');
    expect(form.get('Id')).toBe('worker');
    expect(form.get('Version')).toBe('v1');
    expect(form.get('Email')).toBe('worker@example.test');
    expect(form.has('PhoneNumber')).toBe(false);
    expect((form.get('Image') as File).name).toBe('avatar.png');
    expect(form.get('DeleteCurrentImage')).toBe('true');
    expect(request.request.headers.has('Content-Type')).toBe(false);
    request.flush({ message: 'User profile updated successfully' });
  });

  it('uses the current account version and matching route ID for status changes', () => {
    service.toggleUserStatus('worker', 'v2', false).subscribe();
    const request = http.expectOne('/api/users/worker/toggle-status');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ userId: 'worker', version: 'v2', activateUser: false });
    request.flush({ message: 'User status updated successfully' });
  });
});
