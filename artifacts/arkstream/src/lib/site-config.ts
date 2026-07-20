/**
 * ArkStream Site Configuration
 *
 * Edit this file to control:
 *   - maintenanceMode   on/off — when true, all routes redirect to the maintenance page
 *   - maintenanceMessage shown on the maintenance page
 *   - discordInvite     the /discord link in the footer and notice modal
 *   - notices           array of announcements shown in the Notice modal
 *
 * Notice types: 'info' | 'warning' | 'maintenance'
 */

export type NoticeType = "info" | "warning" | "maintenance";

export interface Notice {
  id: string;
  title: string;
  message: string;
  type: NoticeType;
  date: string; // ISO date string, e.g. "2025-07-20"
}

export const siteConfig = {
  // ── Maintenance ────────────────────────────────────────────────────────────
  maintenanceMode: true,
  maintenanceMessage:
    "ArkStream is currently undergoing scheduled maintenance. Our team is working to restore service as quickly as possible. Thank you for your patience.",

  // ── Discord ────────────────────────────────────────────────────────────────
  discordInvite: "https://discord.gg/DpKvNtNmZM",

  // ── Notices ────────────────────────────────────────────────────────────────
  notices: [
    {
      id: "notice-001",
      title: "Welcome to ArkStream",
      message:
        "ArkStream is now live! Browse thousands of anime titles and stream episodes completely free. More features coming soon.",
      type: "info" as NoticeType,
      date: "2025-07-20",
    },
    // Add more notices here. Most recent first.
    // {
    //   id: 'notice-002',
    //   title: 'Scheduled Maintenance — July 25',
    //   message: 'ArkPulse-1 will undergo brief maintenance on July 25 at 02:00 UTC. Expect ~15 min downtime.',
    //   type: 'warning' as NoticeType,
    //   date: '2025-07-20',
    // },
  ] as Notice[],
} as const;
