import { useEffect } from "react";
import { io } from "socket.io-client";
import type { Lead } from "../types";

const socketUrl = import.meta.env.VITE_SOCKET_URL ?? "http://localhost:3000";
const events = [
  "lead.created",
  "lead.assigned",
  "lead.status_changed",
  "lead.lost",
  "lead.follow_up_required",
] as const;

export function useLeadSocket(
  token: string | null,
  onLead: (lead: Lead) => void,
) {
  useEffect(() => {
    if (!token) return;

    const socket = io(socketUrl, {
      auth: { token },
      transports: ["websocket"],
    });
    events.forEach((event) => socket.on(event, onLead));

    return () => {
      events.forEach((event) => socket.off(event, onLead));
      socket.disconnect();
    };
  }, [token, onLead]);
}
