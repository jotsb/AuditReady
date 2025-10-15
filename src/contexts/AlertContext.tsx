import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { AlertModal, AlertVariant, AlertType } from '../components/shared/AlertModal';
import { logger } from '../lib/logger';

interface AlertConfig {
  type: AlertType;
  variant: AlertVariant;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

interface AlertContextValue {
  showAlert: (config: Omit<AlertConfig, 'type'>) => Promise<void>;
  showConfirm: (config: Omit<AlertConfig, 'type'>) => Promise<boolean>;
}

const AlertContext = createContext<AlertContextValue | undefined>(undefined);

export function AlertProvider({ children }: { children: ReactNode }) {
  const [alertConfig, setAlertConfig] = useState<AlertConfig | null>(null);
  const [resolvePromise, setResolvePromise] = useState<((value: boolean) => void) | null>(null);

  const closeAlert = useCallback(() => {
    setAlertConfig(null);
    setResolvePromise(null);
  }, []);

  const showAlert = useCallback(
    async (config: Omit<AlertConfig, 'type'>): Promise<void> => {
      // Log to system logs
      if (config.variant === 'error') {
        logger.error(config.title, new Error(config.message), { category: 'USER_ACTION', action: 'alert_shown' });
      } else if (config.variant === 'warning') {
        logger.warn(config.title, { category: 'USER_ACTION', action: 'alert_shown', message: config.message });
      } else {
        logger.info(config.title, { category: 'USER_ACTION', action: 'alert_shown', message: config.message });
      }

      return new Promise((resolve) => {
        setAlertConfig({ ...config, type: 'alert' });
        setResolvePromise(() => () => {
          closeAlert();
          resolve();
        });
      });
    },
    [closeAlert]
  );

  const showConfirm = useCallback(
    async (config: Omit<AlertConfig, 'type'>): Promise<boolean> => {
      // Log to system logs
      logger.info('Confirm dialog shown', { category: 'USER_ACTION', action: 'confirm_shown', title: config.title, message: config.message });

      return new Promise((resolve) => {
        setAlertConfig({ ...config, type: 'confirm' });
        setResolvePromise(() => (confirmed: boolean) => {
          // Log user's choice
          logger.info('Confirm dialog response', { category: 'USER_ACTION', action: 'confirm_response', title: config.title, confirmed });
          closeAlert();
          resolve(confirmed);
        });
      });
    },
    [closeAlert]
  );

  const handleConfirm = useCallback(() => {
    if (resolvePromise) {
      resolvePromise(true);
    }
  }, [resolvePromise]);

  const handleCancel = useCallback(() => {
    if (resolvePromise) {
      resolvePromise(false);
    }
  }, [resolvePromise]);

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      {alertConfig && (
        <AlertModal
          isOpen={true}
          type={alertConfig.type}
          variant={alertConfig.variant}
          title={alertConfig.title}
          message={alertConfig.message}
          confirmText={alertConfig.confirmText}
          cancelText={alertConfig.cancelText}
          onConfirm={handleConfirm}
          onCancel={alertConfig.type === 'confirm' ? handleCancel : undefined}
        />
      )}
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
}
