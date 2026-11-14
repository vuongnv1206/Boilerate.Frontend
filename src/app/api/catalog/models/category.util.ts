import { FormControl, FormGroup, Validators } from '@angular/forms';
import {
  CATEGORY_LIMITS,
  CATEGORY_SLUG_PATTERN,
  CategoryDto,
  SaveCategoryRequest,
} from './category.dto';

type CategoryForm = ReturnType<typeof createCategoryForm>;

export function createCategoryForm() {
  return new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.pattern(/\S/u),
        Validators.maxLength(CATEGORY_LIMITS.name),
      ],
    }),
    slug: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.pattern(CATEGORY_SLUG_PATTERN),
        Validators.maxLength(CATEGORY_LIMITS.slug),
      ],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(CATEGORY_LIMITS.description)],
    }),
    parentId: new FormControl('', { nonNullable: true }),
    sortOrder: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.pattern(/^\d+$/u)],
    }),
    isActive: new FormControl(true, { nonNullable: true }),
  });
}

export function categoryFormValue(record?: CategoryDto): ReturnType<CategoryForm['getRawValue']> {
  return {
    name: record?.name ?? '',
    slug: record?.slug ?? '',
    description: record?.description ?? '',
    parentId: record?.parentId ?? '',
    sortOrder: record?.sortOrder ?? 0,
    isActive: record?.isActive ?? true,
  };
}

export function categoryRequest(
  form: CategoryForm,
  record?: CategoryDto | null,
): SaveCategoryRequest {
  const value = form.getRawValue();
  return {
    id: record?.id ?? null,
    version: record?.version ?? null,
    name: value.name.trim(),
    slug: value.slug.trim(),
    description: value.description.trim() || null,
    parentId: value.parentId || null,
    sortOrder: value.sortOrder,
    isActive: value.isActive,
  };
}
