export const formatDateForInput = (dateString: string | null): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const convertLocalDateToUTC = (dateString: string): string | null => {
  if (!dateString) return null;

  if (dateString.includes('T')) {
    const localDate = new Date(dateString);
    return localDate.toISOString();
  }

  const [year, month, day] = dateString.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  return utcDate.toISOString();
};

export const areDatesEqual = (dbDate: string | null, formDate: string): boolean => {
  if (!dbDate && !formDate) return true;
  if (!dbDate || !formDate) return false;

  const dbFormatted = formatDateForInput(dbDate);
  return dbFormatted === formDate;
};

export const formatDateForDisplay = (dateString: string | null): string => {
  if (!dateString) return 'No date';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};
