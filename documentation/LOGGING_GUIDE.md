# Logging Guide

This guide explains how to implement comprehensive logging in all new and existing features.

## Overview

The application uses a centralized logging system that captures all important events, errors, and user actions. All logs are stored in the database and can be viewed in the System Logs page.

## When to Log

You MUST log in these scenarios:

1. **All Operations Start**: Log when any significant operation begins
2. **All Errors**: Log any caught exceptions or errors
3. **All Success**: Log successful completion of operations
4. **User Actions**: Log button clicks, form submissions, navigation
5. **Performance**: Log slow operations (>1s execution time)
6. **Security Events**: Log authentication, authorization, access attempts
7. **Data Changes**: Log creates, updates, deletes
8. **API Calls**: Log all external API interactions
9. **Edge Function Calls**: Log function invocations

## Log Levels

- `trace()` - Very detailed debugging information (use sparingly)
- `debug()` - Detailed debugging information
- `info()` - General informational messages
- `warn()` - Warning messages for potential issues
- `error()` - Error messages for failures that are handled
- `critical()` - Critical errors that affect system stability

## Usage Examples

### Basic Logging

```typescript
import { logger } from '../lib/logger';

// Info logging
logger.info('User logged in successfully', { userId: user.id });

// Error logging
logger.error('Failed to load data', error, { context: 'additional info' });

// Warning
logger.warn('API rate limit approaching', { remaining: 10 });

// Debug
logger.debug('Processing item', { itemId: '123', step: 1 });
```

### Database Operations

```typescript
try {
  logger.info('Creating new receipt', { amount: 100.50, category: 'Travel' });

  const { data, error } = await supabase
    .from('receipts')
    .insert({ ... });

  if (error) {
    logger.error('Failed to create receipt', error, { amount: 100.50 });
    throw error;
  }

  logger.info('Receipt created successfully', { receiptId: data.id });
  logger.database('insert', 'receipts', true, { receiptId: data.id });
} catch (err) {
  logger.error('Error in receipt creation flow', err);
}
```

### API Calls

```typescript
try {
  logger.info('Calling external API', { endpoint: '/api/ocr', method: 'POST' });

  const response = await fetch(endpoint, { ... });

  logger.api(endpoint, 'POST', response.status, {
    responseTime: Date.now() - startTime
  });

  if (!response.ok) {
    logger.error('API call failed', undefined, {
      status: response.status,
      endpoint
    });
  }
} catch (err) {
  logger.error('API call error', err, { endpoint });
}
```

### Performance Tracking

```typescript
const startTime = performance.now();

try {
  // ... do work

  const executionTime = performance.now() - startTime;
  logger.performance('loadReceiptsList', executionTime, {
    count: receipts.length
  });
} catch (err) {
  logger.error('Operation failed', err);
}
```

### User Actions

```typescript
// Button clicks
const handleDelete = async (id: string) => {
  logger.userAction('click', 'delete_button', { receiptId: id });

  try {
    // ... perform delete
    logger.info('Receipt deleted', { receiptId: id });
  } catch (err) {
    logger.error('Delete failed', err, { receiptId: id });
  }
};

// Form submissions
const handleSubmit = async (formData: FormData) => {
  logger.formSubmit('receipt_form', {
    amount: formData.amount,
    category: formData.category
  });

  // ... handle submission
};
```

### Authentication Events

```typescript
try {
  logger.info('Login attempt', { email });

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    logger.auth('login', false, { email, reason: error.message });
    throw error;
  }

  logger.auth('login', true, { email });
} catch (err) {
  logger.error('Login error', err, { email });
}
```

### Edge Function Calls

```typescript
try {
  logger.info('Invoking edge function', { functionName: 'extract-receipt-data' });

  const response = await fetch(functionUrl, { ... });

  if (response.ok) {
    logger.edgeFunction('extract-receipt-data', true);
  } else {
    logger.edgeFunction('extract-receipt-data', false, {
      status: response.status
    });
  }
} catch (err) {
  logger.error('Edge function error', err, { functionName: 'extract-receipt-data' });
}
```

### Navigation

```typescript
// Automatically logged by usePageTracking hook
usePageTracking('Dashboard', { section: 'overview' });

// Manual navigation logging
logger.navigation('/receipts', '/reports', { trigger: 'sidebar_click' });
```

## Best Practices

1. **Always log the start of operations**
   ```typescript
   logger.info('Starting data export', { format: 'CSV', filters });
   ```

2. **Log errors with context**
   ```typescript
   logger.error('Export failed', error, {
     format: 'CSV',
     recordCount: 100,
     step: 'generation'
   });
   ```

3. **Track performance for slow operations**
   ```typescript
   const startTime = performance.now();
   // ... operation
   const duration = performance.now() - startTime;
   if (duration > 1000) {
     logger.performance('slowOperation', duration);
   }
   ```

4. **Sanitize sensitive data**
   ```typescript
   // DON'T log passwords, tokens, or sensitive data
   logger.error('Auth failed', error, {
     email,  // OK
     // password: password  // NEVER
   });
   ```

5. **Use appropriate log levels**
   - Use `debug` for development-only information
   - Use `info` for normal operations
   - Use `warn` for recoverable issues
   - Use `error` for failures
   - Use `critical` for system-threatening errors

6. **Include relevant metadata**
   ```typescript
   logger.info('Receipt uploaded', {
     receiptId,
     fileSize,
     mimeType,
     uploadedBy: userId
   });
   ```

## Viewing Logs

1. Navigate to **System Logs** in the admin menu
2. Filter by level, category, date range
3. Search by message or metadata
4. Export logs for analysis

## Categories

Available log categories:
- `AUTH` - Authentication events
- `DATABASE` - Database operations
- `API` - External API calls
- `EDGE_FUNCTION` - Edge function invocations
- `CLIENT_ERROR` - Client-side errors
- `SECURITY` - Security-related events
- `PERFORMANCE` - Performance metrics
- `USER_ACTION` - User interactions
- `PAGE_VIEW` - Page navigation
- `NAVIGATION` - Route changes

## Implementation Checklist

When adding new features, ensure you:

- [ ] Import logger: `import { logger } from '../lib/logger';`
- [ ] Log operation start
- [ ] Log all errors with context
- [ ] Log successful completion
- [ ] Track performance for async operations
- [ ] Log user interactions
- [ ] Log database operations
- [ ] Sanitize sensitive data
- [ ] Use appropriate log levels
- [ ] Include relevant metadata
