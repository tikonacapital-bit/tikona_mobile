import React, { createContext, useContext, useState, useCallback } from 'react';
import CustomAlert, { AlertVariant, AlertButton } from '@/components/CustomAlert';

/* ─── Types ─── */
interface AlertConfig {
    title: string;
    message?: string | React.ReactNode;
    variant?: AlertVariant;
    buttons?: AlertButton[];
    autoDismissMs?: number;
}

interface AlertContextType {
    /**
     * Drop-in replacement for Alert.alert().
     *
     * Usage:
     *   showAlert('Title', 'Message')
     *   showAlert('Title', 'Message', [{ text: 'OK' }])
     *   showAlert({ title: 'Title', message: 'Message', variant: 'success', autoDismissMs: 2000 })
     */
    showAlert: (
        titleOrConfig: string | AlertConfig,
        message?: string | React.ReactNode,
        buttons?: AlertButton[],
    ) => void;
}

const AlertContext = createContext<AlertContextType>({
    showAlert: () => { },
});

export const useAlert = () => useContext(AlertContext);

export function AlertProvider({ children }: { children: React.ReactNode }) {
    const [visible, setVisible] = useState(false);
    const [config, setConfig] = useState<AlertConfig>({ title: '' });

    const showAlert = useCallback(
        (
            titleOrConfig: string | AlertConfig,
            message?: string | React.ReactNode,
            buttons?: AlertButton[],
        ) => {
            if (typeof titleOrConfig === 'string') {
                setConfig({
                    title: titleOrConfig,
                    message,
                    buttons,
                    variant: inferVariant(titleOrConfig, typeof message === 'string' ? message : undefined, buttons),
                });
            } else {
                setConfig(titleOrConfig);
            }
            setVisible(true);
        },
        [],
    );

    const handleDismiss = useCallback(() => {
        setVisible(false);
    }, []);

    return (
        <AlertContext.Provider value={{ showAlert }}>
            {children}
            <CustomAlert
                visible={visible}
                title={config.title}
                message={config.message}
                variant={config.variant}
                buttons={config.buttons}
                onDismiss={handleDismiss}
                autoDismissMs={config.autoDismissMs}
            />
        </AlertContext.Provider>
    );
}

/* ─── Helper: auto-detect variant from title keywords ─── */
function inferVariant(
    title: string,
    _message?: string | React.ReactNode,
    buttons?: AlertButton[],
): AlertVariant {
    const lower = title.toLowerCase();
    if (lower.includes('success') || lower.includes('added') || lower.includes('verified') || lower.includes('saved')) return 'success';
    if (lower.includes('error') || lower.includes('failed') || lower.includes('invalid') || lower.includes('missing') || lower.includes('weak')) return 'error';
    if (lower.includes('warning') || lower.includes('caution')) return 'warning';
    if (lower.includes('remove') || lower.includes('delete') || lower.includes('sign out')) return 'danger';
    if (buttons?.some((b) => b.style === 'destructive')) return 'danger';
    if (lower.includes('info') || lower.includes('reset') || lower.includes('terms') || lower.includes('require')) return 'info';
    return 'confirm';
}
