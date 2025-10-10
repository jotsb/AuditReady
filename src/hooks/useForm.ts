import { useState, useCallback, FormEvent, ChangeEvent } from 'react';

interface UseFormOptions<T> {
  initialValues: T;
  onSubmit: (values: T) => Promise<void>;
  validate?: (values: T) => string | null;
}

interface UseFormReturn<T> {
  values: T;
  errors: string | null;
  loading: boolean;
  isSubmitting: boolean;
  handleChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  handleSubmit: (e: FormEvent) => Promise<void>;
  setFieldValue: (field: keyof T, value: any) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export function useForm<T extends Record<string, any>>({
  initialValues,
  onSubmit,
  validate,
}: UseFormOptions<T>): UseFormReturn<T> {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    setValues((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));

    if (errors) {
      setErrors(null);
    }
  }, [errors]);

  const setFieldValue = useCallback((field: keyof T, value: any) => {
    setValues((prev) => ({
      ...prev,
      [field]: value,
    }));

    if (errors) {
      setErrors(null);
    }
  }, [errors]);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setErrors(null);

    if (validate) {
      const validationError = validate(values);
      if (validationError) {
        setErrors(validationError);
        return;
      }
    }

    setLoading(true);

    try {
      await onSubmit(values);
    } catch (err: any) {
      setErrors(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [values, validate, onSubmit]);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors(null);
    setLoading(false);
  }, [initialValues]);

  return {
    values,
    errors,
    loading,
    isSubmitting: loading,
    handleChange,
    handleSubmit,
    setFieldValue,
    setError: setErrors,
    reset,
  };
}
