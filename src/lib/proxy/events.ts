/**
 * Real-time event emitter for the AgenLens dashboard.
 *
 * Manages a simple in-memory pub/sub system that bridges the proxy layer
 * to WebSocket connections. When the proxy logs an activity, it emits
 * an event here, and connected dashboard clients receive it instantly.
 */

import type { ActivityEvent } from "@/lib/types";

type EventListener = (event: ActivityEvent) => void;

/** In-memory list of connected event listeners (WebSocket handlers). */
const listeners: Set<EventListener> = new Set();

/**
 * Registers a listener for real-time activity events.
 * Called when a WebSocket client connects to the dashboard.
 *
 * @param listener - Callback function to invoke on each event
 * @returns Cleanup function to remove the listener on disconnect
 */
export function subscribeToActivity(listener: EventListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Emits an activity event to all connected dashboard clients.
 * Called by the proxy logger after each API request is processed.
 *
 * @param event - The activity event to broadcast
 */
export function emitActivityEvent(event: ActivityEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // Listener errors should not break the proxy pipeline.
      // The listener will be cleaned up on WebSocket disconnect.
    }
  }
}
