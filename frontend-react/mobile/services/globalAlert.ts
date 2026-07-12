export type GlobalAlertType = 'success' | 'error' | 'info' | 'warning';

export type GlobalAlertPayload = {
  type?: GlobalAlertType;
  title: string;
  message?: string;
};

type AlertHandler = (payload: GlobalAlertPayload) => void;

let alertHandler: AlertHandler | null = null;
let pendingAlert: GlobalAlertPayload | null = null;

export function setGlobalAlertHandler(handler: AlertHandler | null) {
  alertHandler = handler;
  if (alertHandler && pendingAlert) {
    alertHandler(pendingAlert);
    pendingAlert = null;
  }
}

export function showGlobalAlert(payload: GlobalAlertPayload) {
  if (alertHandler) {
    alertHandler(payload);
    return;
  }
  pendingAlert = payload;
}
