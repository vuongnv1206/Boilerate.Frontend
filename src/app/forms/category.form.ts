import { FormControl, FormGroup, Validators } from '@angular/forms';
import { CATEGORY_LIMITS, CATEGORY_SLUG_PATTERN } from '@constants/category.constants';
import { CategoryDto, SaveCategoryRequest } from '@models/category.dto';

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
export type CategoryForm = ReturnType<typeof createCategoryForm>;

export function categoryFormValue(category?: CategoryDto): ReturnType<CategoryForm['getRawValue']> {
  return {
    name: category?.name ?? '',
    slug: category?.slug ?? '',
    description: category?.description ?? '',
    parentId: category?.parentId ?? '',
    sortOrder: category?.sortOrder ?? 0,
    isActive: category?.isActive ?? true,
  };
}
export function categoryRequest(
  form: CategoryForm,
  original: CategoryDto | null,
): SaveCategoryRequest {
  const value = form.getRawValue();
  return {
    id: original?.id ?? null,
    version: original?.version ?? null,
    ...value,
    name: value.name.trim(),
    slug: value.slug.trim().toLowerCase(),
    description: value.description.trim() || null,
    parentId: value.parentId || null,
  };
}
