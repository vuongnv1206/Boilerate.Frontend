import { FormBuilder, ValidatorFn, Validators } from '@angular/forms';
import {
  CONTENT_DEFAULTS,
  CONTENT_LIMITS,
  CONTENT_SLUG_PATTERN,
} from '../constants/content.constants';
import type { ContentForm } from '../models/content-form.model';

const trimmedRequired: ValidatorFn = (control) =>
  typeof control.value === 'string' && control.value.trim().length > 0 ? null : { required: true };

const finiteNonNegative: ValidatorFn = (control) =>
  typeof control.value === 'number' && Number.isFinite(control.value) && control.value >= 0
    ? null
    : { min: { min: 0, actual: control.value as unknown } };

const nonNegativeInteger: ValidatorFn = (control) =>
  typeof control.value === 'number' && Number.isInteger(control.value) && control.value >= 0
    ? null
    : {
        pattern: { requiredPattern: 'non-negative integer', actualValue: control.value as unknown },
      };

/** One typed form factory shared by the content editor and its store tests. */
export function createContentForm(): ContentForm {
  const builder = new FormBuilder().nonNullable;
  return builder.group({
    name: ['', [trimmedRequired, Validators.maxLength(CONTENT_LIMITS.name)]],
    slug: ['', [Validators.required, Validators.pattern(CONTENT_SLUG_PATTERN)]],
    description: ['', Validators.maxLength(CONTENT_LIMITS.description)],
    category: builder.control<string>(CONTENT_DEFAULTS.category),
    price: [0, [Validators.required, finiteNonNegative]],
    sku: ['', Validators.maxLength(CONTENT_LIMITS.sku)],
    stock: [0, [Validators.required, nonNegativeInteger]],
    featured: [false],
    seoTitle: ['', Validators.maxLength(CONTENT_LIMITS.seoTitle)],
    seoDescription: ['', Validators.maxLength(CONTENT_LIMITS.seoDescription)],
  });
}
