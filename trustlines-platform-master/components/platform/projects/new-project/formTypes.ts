import type { FieldErrors, UseFormRegister, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import type { NewProjectFormValues } from '@/lib/validations/project';

/** The react-hook-form handles the wizard steps need, passed down from NewProjectForm. */
export interface FormHandles {
  register: UseFormRegister<NewProjectFormValues>;
  setValue: UseFormSetValue<NewProjectFormValues>;
  watch: UseFormWatch<NewProjectFormValues>;
  errors: FieldErrors<NewProjectFormValues>;
}
