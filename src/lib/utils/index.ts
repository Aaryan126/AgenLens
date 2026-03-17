/**
 * General utility functions used across the AgenLens application.
 * Includes class name merging for Tailwind and data sanitization helpers.
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind CSS class names, resolving conflicts.
 * Combines clsx for conditional classes with tailwind-merge for deduplication.
 *
 * @param inputs - Class values to merge (strings, arrays, objects)
 * @returns Merged class name string
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Generates a unique request ID for grouping sub-agent actions.
 * Uses a combination of timestamp and random string for uniqueness.
 *
 * @returns A unique request identifier string
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `req_${timestamp}_${random}`;
}

/**
 * Generates a unique session ID for tracking agent conversations.
 *
 * @returns A unique session identifier string
 */
export function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `ses_${timestamp}_${random}`;
}

/**
 * Sanitizes an API request or response body for safe storage.
 * Strips sensitive content (email bodies, file contents, message text)
 * and retains only metadata (subjects, filenames, IDs, counts).
 *
 * @param body - The raw request or response body
 * @param targetService - The API service for context-aware sanitization
 * @returns Sanitized metadata object safe for database storage
 */
export function sanitizeForStorage(
  body: unknown,
  targetService: string
): Record<string, unknown> | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const raw = body as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  /** Fields that are always safe to store. */
  const safeFields = [
    "id",
    "subject",
    "title",
    "name",
    "filename",
    "mimeType",
    "size",
    "start",
    "end",
    "status",
    "state",
    "number",
    "created_at",
    "updated_at",
    "labels",
    "attendees",
    "organizer",
    "channel",
    "repository",
    "owner",
    "totalCount",
    "resultCount",
  ];

  /** Fields that contain sensitive content and must be excluded. */
  const sensitiveFields = [
    "body",
    "content",
    "snippet",
    "message",
    "text",
    "raw",
    "payload",
    "data",
    "html",
    "plain",
    "description",
  ];

  for (const [key, value] of Object.entries(raw)) {
    if (sensitiveFields.includes(key.toLowerCase())) {
      sanitized[key] = "[redacted]";
    } else if (safeFields.includes(key)) {
      sanitized[key] = value;
    } else if (typeof value === "string" && value.length > 200) {
      sanitized[key] = `${value.substring(0, 50)}... [truncated]`;
    } else if (typeof value !== "object") {
      sanitized[key] = value;
    } else if (Array.isArray(value)) {
      sanitized[key] = `[Array of ${value.length} items]`;
    }
  }

  sanitized._service = targetService;
  return sanitized;
}

/**
 * Converts a Google Calendar API scope URL to a human-readable label.
 *
 * @param scope - The full OAuth scope string
 * @returns Human-readable scope description
 */
export function scopeToLabel(scope: string): string {
  const scopeMap: Record<string, string> = {
    "https://www.googleapis.com/auth/calendar.readonly": "Read Calendar",
    "https://www.googleapis.com/auth/calendar.events":
      "Read & Write Calendar Events",
    "https://www.googleapis.com/auth/gmail.readonly": "Read Email",
    "https://www.googleapis.com/auth/gmail.send": "Send Email",
    "https://www.googleapis.com/auth/gmail.modify": "Modify Email",
    "https://www.googleapis.com/auth/drive.readonly": "Read Drive Files",
    "https://www.googleapis.com/auth/drive.file": "Read & Write Drive Files",
    "channels:read": "Read Slack Channels",
    "chat:write": "Post Slack Messages",
    "search:read": "Search Slack",
    "users:read": "Read Slack Users",
    "repo:status": "Read Repo Status",
    public_repo: "Access Public Repos",
    repo: "Full Repo Access",
    "write:issues": "Create/Edit Issues",
    "write:pull_requests": "Create/Edit PRs",
  };
  return scopeMap[scope] || scope;
}

/**
 * Formats a timestamp into a human-readable relative time string.
 *
 * @param date - The date to format
 * @returns Relative time string like "2 minutes ago"
 */
export function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
