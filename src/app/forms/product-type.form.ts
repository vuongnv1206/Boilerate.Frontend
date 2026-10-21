import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { PRODUCT_TYPE_CODE_PATTERN, PRODUCT_TYPE_LIMITS } from '@constants/product-type.constants';
import { ProductFieldType } from '@enums/product-field-type.enum';
import {
  CreateProductTypeRequest,
  EditProductTypeRequest,
  FieldDefinitionInput,
  ProductFieldChoiceDto,
  ProductFieldDefinitionDto,
  ProductTypeDto,
} from '@models/product-type.dto';

export function createChoiceForm(choice?: ProductFieldChoiceDto, index = 0) {
  return new FormGroup({
    id: new FormControl(choice?.id ?? '', { nonNullable: true }),
    code: new FormControl(choice?.code ?? '', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.pattern(PRODUCT_TYPE_CODE_PATTERN),
        Validators.maxLength(PRODUCT_TYPE_LIMITS.code),
      ],
    }),
    label: new FormControl(choice?.label ?? '', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.pattern(/\S/u),
        Validators.maxLength(PRODUCT_TYPE_LIMITS.label),
      ],
    }),
    isActive: new FormControl(choice?.isActive ?? true, { nonNullable: true }),
    sortOrder: new FormControl(choice?.sortOrder ?? index, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.pattern(/^\d+$/u)],
    }),
  });
}
export function createFieldForm(field?: ProductFieldDefinitionDto, index = 0) {
  return new FormGroup({
    id: new FormControl(field?.id ?? '', { nonNullable: true }),
    code: new FormControl(field?.code ?? '', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.pattern(PRODUCT_TYPE_CODE_PATTERN),
        Validators.maxLength(PRODUCT_TYPE_LIMITS.code),
      ],
    }),
    dataType: new FormControl(field?.dataType ?? ProductFieldType.Text, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    label: new FormControl(field?.label ?? '', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.pattern(/\S/u),
        Validators.maxLength(PRODUCT_TYPE_LIMITS.label),
      ],
    }),
    helpText: new FormControl(field?.helpText ?? '', {
      nonNullable: true,
      validators: [Validators.maxLength(PRODUCT_TYPE_LIMITS.help)],
    }),
    isRequired: new FormControl(field?.isRequired ?? false, { nonNullable: true }),
    isFilterable: new FormControl(field?.isFilterable ?? false, { nonNullable: true }),
    isActive: new FormControl(field?.isActive ?? true, { nonNullable: true }),
    sortOrder: new FormControl(field?.sortOrder ?? index, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.pattern(/^\d+$/u)],
    }),
    choices: new FormArray(
      (field?.choices ?? []).map((choice, choiceIndex) => createChoiceForm(choice, choiceIndex)),
      { validators: [uniqueCodes, Validators.maxLength(PRODUCT_TYPE_LIMITS.choices)] },
    ),
  });
}
export function createProductTypeForm() {
  return new FormGroup({
    code: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.pattern(PRODUCT_TYPE_CODE_PATTERN),
        Validators.maxLength(PRODUCT_TYPE_LIMITS.code),
      ],
    }),
    name: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.pattern(/\S/u),
        Validators.maxLength(PRODUCT_TYPE_LIMITS.name),
      ],
    }),
    isActive: new FormControl(true, { nonNullable: true }),
    fields: new FormArray<ReturnType<typeof createFieldForm>>([], {
      validators: [uniqueCodes, Validators.maxLength(PRODUCT_TYPE_LIMITS.fields)],
    }),
  });
}
export type ProductTypeForm = ReturnType<typeof createProductTypeForm>;
export type ProductFieldForm = ReturnType<typeof createFieldForm>;
export type ProductChoiceForm = ReturnType<typeof createChoiceForm>;

export function resetProductTypeForm(form: ProductTypeForm, type?: ProductTypeDto): void {
  form.controls.fields.clear({ emitEvent: false });
  (type?.fields ?? []).forEach((field, index) =>
    form.controls.fields.push(createFieldForm(field, index), { emitEvent: false }),
  );
  form.reset(
    {
      code: type?.code ?? '',
      name: type?.name ?? '',
      isActive: type?.isActive ?? true,
      fields: form.controls.fields.getRawValue(),
    },
    { emitEvent: false },
  );
}
export function createProductTypeRequest(form: ProductTypeForm): CreateProductTypeRequest {
  const value = form.getRawValue();
  return { code: value.code.trim(), name: value.name.trim(), fields: value.fields.map(fieldInput) };
}
/** Keep server-assigned ids when a newer draft must remain on screen after saving. */
export function synchronizeProductTypeIdentity(form: ProductTypeForm, type: ProductTypeDto): void {
  for (const field of form.controls.fields.controls) {
    const canonical = type.fields.find(
      (item) =>
        item.id === field.controls.id.value ||
        item.code.toUpperCase() === field.controls.code.value.trim().toUpperCase(),
    );
    if (!canonical) continue;
    field.patchValue(
      {
        id: canonical.id,
        code: canonical.code,
        dataType: canonical.dataType,
        isRequired: canonical.isRequired,
      },
      { emitEvent: false },
    );
    for (const choice of field.controls.choices.controls) {
      const saved = canonical.choices.find(
        (item) =>
          item.id === choice.controls.id.value ||
          item.code.toUpperCase() === choice.controls.code.value.trim().toUpperCase(),
      );
      if (saved) choice.patchValue({ id: saved.id, code: saved.code }, { emitEvent: false });
    }
  }
}
export function editProductTypeRequest(
  form: ProductTypeForm,
  original: ProductTypeDto,
): EditProductTypeRequest {
  const value = form.getRawValue();
  return {
    id: original.id,
    version: original.version,
    name: value.name.trim(),
    isActive: value.isActive,
    addFields: value.fields
      .filter((field) => !field.id)
      .map((field) => ({ ...fieldInput(field), isRequired: false })),
    fields: value.fields
      .filter((field) => !!field.id)
      .map((field) => ({
        id: field.id,
        label: field.label.trim(),
        helpText: field.helpText.trim() || null,
        isFilterable: field.isFilterable,
        isActive: field.isActive,
        sortOrder: field.sortOrder,
        addChoices: field.choices
          .filter((choice) => !choice.id)
          .map((choice) => ({ code: choice.code.trim(), label: choice.label.trim() })),
        choices: field.choices
          .filter((choice) => !!choice.id)
          .map((choice) => ({
            id: choice.id,
            label: choice.label.trim(),
            isActive: choice.isActive,
            sortOrder: choice.sortOrder,
          })),
      })),
  };
}
function fieldInput(field: ReturnType<ProductFieldForm['getRawValue']>): FieldDefinitionInput {
  return {
    code: field.code.trim(),
    dataType: field.dataType,
    label: field.label.trim(),
    helpText: field.helpText.trim() || null,
    isRequired: field.isRequired,
    isFilterable: field.isFilterable,
    choices:
      field.dataType === ProductFieldType.Choice
        ? field.choices.map((choice) => ({ code: choice.code.trim(), label: choice.label.trim() }))
        : [],
  };
}
function uniqueCodes(control: AbstractControl): ValidationErrors | null {
  if (!(control instanceof FormArray)) return null;
  const codes = control.controls
    .map((child: AbstractControl) =>
      String(child.get('code')?.value ?? '')
        .trim()
        .toUpperCase(),
    )
    .filter(Boolean);
  return new Set(codes).size === codes.length ? null : { duplicateCodes: true };
}

/** Capture submitted groups by control identity; resolve current paths only when errors arrive. */
export function productTypeErrorAliases(
  form: ProductTypeForm,
  editing: boolean,
): () => Readonly<Record<string, string>> {
  const entries: {
    source: string;
    field: ProductFieldForm;
    member: string;
    choice?: ProductChoiceForm;
    choiceMember?: string;
  }[] = [];
  const groups = editing
    ? ([
        ['fields', form.controls.fields.controls.filter((field) => !!field.controls.id.value)],
        ['addFields', form.controls.fields.controls.filter((field) => !field.controls.id.value)],
      ] as const)
    : ([['fields', [...form.controls.fields.controls]]] as const);
  for (const [group, fields] of groups)
    fields.forEach((field, index) => {
      entries.push({ source: `${group}[${index}]`, field, member: '' });
      for (const member of Object.keys(field.controls))
        entries.push({ source: `${group}[${index}].${member}`, field, member });
      const choiceGroups =
        editing && group === 'fields'
          ? ([
              [
                'choices',
                field.controls.choices.controls.filter((choice) => !!choice.controls.id.value),
              ],
              [
                'addChoices',
                field.controls.choices.controls.filter((choice) => !choice.controls.id.value),
              ],
            ] as const)
          : ([['choices', [...field.controls.choices.controls]]] as const);
      for (const [choiceGroup, choices] of choiceGroups)
        choices.forEach((choice, choiceIndex) => {
          entries.push({
            source: `${group}[${index}].${choiceGroup}[${choiceIndex}]`,
            field,
            member: 'choices',
            choice,
          });
          for (const choiceMember of Object.keys(choice.controls))
            entries.push({
              source: `${group}[${index}].${choiceGroup}[${choiceIndex}].${choiceMember}`,
              field,
              member: 'choices',
              choice,
              choiceMember,
            });
        });
    });
  return () =>
    Object.fromEntries(
      entries.map((entry) => {
        const index = form.controls.fields.controls.indexOf(entry.field);
        const choiceIndex = entry.choice
          ? entry.field.controls.choices.controls.indexOf(entry.choice)
          : -1;
        const target =
          index < 0 || (entry.choice && choiceIndex < 0)
            ? '__unmapped__'
            : `fields.${index}${entry.member ? `.${entry.member}` : ''}${entry.choice ? `.${choiceIndex}${entry.choiceMember ? `.${entry.choiceMember}` : ''}` : ''}`;
        return [entry.source, target];
      }),
    );
}
