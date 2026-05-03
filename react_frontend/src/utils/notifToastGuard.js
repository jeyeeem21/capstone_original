// Prevents NotificationBell from toasting when an action handler already showed a toast.
// Call suppress() after any order action that triggers both a toast and a backend notification.

let _suppressUntil = 0;

export const suppressNotifToasts = (ms = 8000) => {
  _suppressUntil = Date.now() + ms;
};

export const isNotifToastSuppressed = () => Date.now() < _suppressUntil;
