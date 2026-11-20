// Exact app-owned browser state that belongs in an encrypted full backup.
// Never include cookies, authentication tokens, connection caches or unknown keys.
export const WORKSPACE_BACKUP_CLIENT_KEYS = [
  "mb-drafts",
  "mb-draft-attachments",
  "mb-draft-send-ids",
  "mb-draft-channel-modes",
  "mb-skin",
  "mb-show-threads",
  "mb-show-run-card",
  "mb-send-key",
  "mb-color-user-bubbles",
  "mb-chat-width",
  "mengbot.sidebarDensity",
  "mengbot.sidebarToolsLayout",
  "mengbot.sidebarCollapsedSections.v1",
  "mengbot.sidebarSectionOrder.v1",
  "mb-analytics-opt-out",
  "mengbot.remote-voice.v1",
] as const;

export type WorkspaceBackupClientState = Partial<Record<(typeof WORKSPACE_BACKUP_CLIENT_KEYS)[number], string>>;
