export interface SourceTabTransferPendingState {
  sessionId: string;
  tabId: string;
  restoreActiveTabId: string | null;
  restoreSelectedPartId: string | null;
  restoreSelectedPartTitle: string | null;
  timeoutAt: number;
}
