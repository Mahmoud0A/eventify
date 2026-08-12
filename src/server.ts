import { createServer, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { findById } from "./domain.ts";
import type { Event } from "./domain.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 3000;
const EVENTS_FILE = join(__dirname, "../data/events.json");

let cachedEvents: Event[] | null = null;
const startTime: number = Date.now();

/**
 * Load events from data/events.json asynchronously
 */
async function loadEvents(): Promise<Event[]> {
  if (cachedEvents !== null) {
    return cachedEvents;
  }

  try {
    const data = await readFile(EVENTS_FILE, "utf-8");
    cachedEvents = JSON.parse(data) as Event[];
    return cachedEvents;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Failed to load events: ${errorMessage}`);
    throw new Error("Failed to load events");
  }
}

/**
 * Parse URL path and extract resource and optional ID
 */
function parsePath(url: string): { resource: string; id: string | null } {
  const pathname = url.split("?")[0] || "";
  const parts = pathname.split("/").filter(Boolean);

  return {
    resource: parts[0] || "",
    id: parts[1] || null,
  };
}

/**
 * Send JSON response
 */
function sendJson(
  res: ServerResponse,
  statusCode: number,
  data: unknown
): void {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

/**
 * HTTP Server
 */
const server = createServer(async (req, res) => {
  const { resource, id } = parsePath(req.url || "");

  // GET /health
  if (req.method === "GET" && resource === "health") {
    const uptime = Date.now() - startTime;
    sendJson(res, 200, { status: "ok", uptime });
    return;
  }

  // GET /events
  if (req.method === "GET" && resource === "events" && !id) {
    try {
      const events = await loadEvents();
      sendJson(res, 200, events);
    } catch {
      sendJson(res, 500, { error: "Failed to load events" });
    }
    return;
  }

  // GET /events/:id
  if (req.method === "GET" && resource === "events" && id) {
    try {
      const events = await loadEvents();
      const event = findById(events, id);

      if (!event) {
        sendJson(res, 404, { error: "Event not found" });
        return;
      }

      sendJson(res, 200, event);
    } catch {
      sendJson(res, 500, { error: "Failed to load events" });
    }
    return;
  }

  // POST /events (stretch)
  if (req.method === "POST" && resource === "events" && !id) {
    let body = "";

    req.on("data", (chunk: Buffer) => {
      body += chunk.toString("utf-8");
    });

    req.on("end", async () => {
      try {
        const payload = JSON.parse(body);

        // Basic validation
        if (
          !payload.title ||
          !payload.description ||
          payload.capacity === undefined ||
          !payload.organizerId ||
          !payload.startsAt
        ) {
          sendJson(res, 400, {
            error:
              "Missing required fields: title, description, capacity, organizerId, startsAt",
          });
          return;
        }

        // Create new event
        const newEvent: Event = {
          id: `evt-${Date.now()}`,
          title: payload.title,
          description: payload.description,
          venue: payload.venue || null,
          startsAt: payload.startsAt,
          capacity: payload.capacity,
          priceCents: payload.priceCents || 0,
          organizerId: payload.organizerId,
          createdAt: new Date().toISOString(),
        };

        // Add to cached events (note: not persisted to disk in this version)
        cachedEvents?.push(newEvent);

        sendJson(res, 201, newEvent);
      } catch (error) {
        if (error instanceof SyntaxError) {
          sendJson(res, 400, { error: "Invalid JSON" });
        } else {
          sendJson(res, 500, { error: "Failed to create event" });
        }
      }
    });
    return;
  }

  // 404 for everything else
  sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
