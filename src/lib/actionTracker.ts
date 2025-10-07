import { logger } from './logger';

export const actionTracker = {
  buttonClick: (buttonName: string, metadata?: Record<string, any>) => {
    logger.userAction('click', buttonName, metadata);
  },

  linkClick: (linkName: string, destination: string, metadata?: Record<string, any>) => {
    logger.userAction('click', linkName, { ...metadata, destination });
  },

  formSubmit: (formName: string, formData: Record<string, any>, metadata?: Record<string, any>) => {
    logger.formSubmit(formName, formData, metadata);
  },

  filterApplied: (filterType: string, filterValue: any, metadata?: Record<string, any>) => {
    logger.userAction('filter', filterType, { ...metadata, filterValue });
  },

  searchPerformed: (searchQuery: string, resultsCount: number, metadata?: Record<string, any>) => {
    logger.userAction('search', 'search box', { ...metadata, searchQuery, resultsCount });
  },

  selectionChanged: (fieldName: string, newValue: any, oldValue?: any, metadata?: Record<string, any>) => {
    logger.userAction('select', fieldName, { ...metadata, newValue, oldValue });
  },

  itemDeleted: (itemType: string, itemId: string, metadata?: Record<string, any>) => {
    logger.userAction('delete', itemType, { ...metadata, itemId });
  },

  itemCreated: (itemType: string, itemId: string, metadata?: Record<string, any>) => {
    logger.userAction('create', itemType, { ...metadata, itemId });
  },

  itemUpdated: (itemType: string, itemId: string, changes: Record<string, any>, metadata?: Record<string, any>) => {
    logger.userAction('update', itemType, { ...metadata, itemId, changes });
  },

  exportPerformed: (exportType: string, format: string, recordCount: number, metadata?: Record<string, any>) => {
    logger.userAction('export', exportType, { ...metadata, format, recordCount });
  },

  uploadStarted: (fileType: string, fileName: string, fileSize: number, metadata?: Record<string, any>) => {
    logger.userAction('upload_start', fileType, { ...metadata, fileName, fileSize });
  },

  uploadCompleted: (fileType: string, fileName: string, duration: number, metadata?: Record<string, any>) => {
    logger.userAction('upload_complete', fileType, { ...metadata, fileName, duration });
  },

  downloadStarted: (resourceType: string, resourceId: string, metadata?: Record<string, any>) => {
    logger.userAction('download_start', resourceType, { ...metadata, resourceId });
  },

  tabChanged: (fromTab: string, toTab: string, metadata?: Record<string, any>) => {
    logger.userAction('tab_change', 'tabs', { ...metadata, fromTab, toTab });
  },

  modalOpened: (modalName: string, metadata?: Record<string, any>) => {
    logger.userAction('modal_open', modalName, metadata);
  },

  modalClosed: (modalName: string, action: 'save' | 'cancel' | 'close', metadata?: Record<string, any>) => {
    logger.userAction('modal_close', modalName, { ...metadata, action });
  },
};
