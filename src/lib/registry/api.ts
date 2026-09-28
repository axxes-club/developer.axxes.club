import type { ApiProduct } from "./spec"

/**
 * The API reference.
 *
 * Transcribed from what each product actually serves today, not from what
 * it might serve one day. A reference page that documents an endpoint which
 * does not exist is worse than no reference at all, because a developer
 * will build against it.
 *
 * Every operation carries `requires`, the plan feature that unlocks it, so
 * the page can say "this is on Build" before someone spends an afternoon
 * discovering it with a 403.
 */
export const API_PRODUCTS: ApiProduct[] = [
  {
    key: "lanes",
    name: "Lanes",
    summary: "Boards, sprints, scrum poker and custom fields.",
    url: "https://lanes.axxes.club",
    surface: "read-write",
    note: "The first AXXES product with a public API, and the reference to copy.",
    baseUrl: "https://lanes.axxes.club/api/v1",
    resources: [
      {
        key: "boards",
        label: "Boards",
        description: "A board is a delivery stream: its lists are stages and its cards are the work.",
        operations: [
          {
            id: "lanes.boards.get",
            method: "GET",
            path: "/boards/{boardId}",
            summary: "Read a board, its lists and the card count in each.",
            description:
              "Returns the board, its lists in position order with a count of cards in each, and the role your key has on it. Use `yourRole` to decide what to show before making a call that would be refused.",
            requires: "api.read",
            pathParams: [
              { name: "boardId", type: "string", required: true, description: "The board's UUID.", example: "0f3c…" },
            ],
            response: {
              board: { id: "0f3c…", name: "Checkout", prefix: "CO", updatedAt: "2026-09-28T12:00:00Z" },
              lists: [{ id: "9a1b…", name: "Doing", position: 1, wipLimit: 3, isDoneList: false, count: 7 }],
              yourRole: "developer",
            },
            errors: [
              { status: 401, code: "unauthorized", meaning: "The key is missing, expired, revoked or signed wrong. A new key is needed — this cannot be retried." },
              { status: 403, code: "forbidden", meaning: "The key's owner has no role on this board. Ask a board owner for one." },
              { status: 404, code: "not_found", meaning: "No such board, or it belongs to another workspace." },
            ],
            example: `curl -H "Authorization: Bearer $AXXES_KEY" \\\n  https://lanes.axxes.club/api/v1/boards/$BOARD_ID`,
          },
        ],
      },
      {
        key: "cards",
        label: "Cards",
        description: "The work itself. Cards belong to a list and carry a stable key.",
        operations: [
          {
            id: "lanes.cards.list",
            method: "GET",
            path: "/boards/{boardId}/cards",
            summary: "List every card on a board.",
            description:
              "Each card carries a `key` such as `CO-014` — the same key used in standups and commit messages. It is stable: it survives moving a card between lists, which a position does not. Filter with `list` to scope it to one stage and `limit` to cap the response.",
            requires: "api.read",
            pathParams: [
              { name: "boardId", type: "string", required: true, description: "The board's UUID." },
            ],
            query: [
              { name: "list", type: "string", description: "Only cards in this list.", example: "9a1b…" },
              { name: "limit", type: "number", description: "1–200, default 100.", example: 50 },
            ],
            response: {
              boardPrefix: "CO",
              cards: [
                { id: "77…", listId: "9a1b…", title: "Retry failed charges", priority: "high", estimatedHours: 3, key: "CO-014" },
              ],
            },
            errors: [
              { status: 403, code: "forbidden", meaning: "The key's owner cannot read cards here." },
              { status: 404, code: "not_found", meaning: "No such board." },
            ],
            example: `curl -H "Authorization: Bearer $AXXES_KEY" \\\n  "https://lanes.axxes.club/api/v1/boards/$BOARD_ID/cards?limit=50"`,
          },
          {
            id: "lanes.cards.create",
            method: "POST",
            path: "/boards/{boardId}/cards",
            summary: "Create a card.",
            description:
              "Puts a card in the board's first list unless you name one. The card is given the next number in the board's sequence, which becomes its `key`. That number is allocated from the database, so two cards created at the same moment cannot collide.",
            requires: "api.write",
            pathParams: [
              { name: "boardId", type: "string", required: true, description: "The board's UUID." },
            ],
            body: [
              { name: "title", type: "string", required: true, description: "What the work is. Up to 500 characters.", example: "Retry failed charges" },
              { name: "listId", type: "string", description: "Which list to put it in. Defaults to the first.", example: "9a1b…" },
              { name: "description", type: "string", description: "Longer detail, markdown." },
            ],
            response: { card: { id: "78…", title: "Retry failed charges", key: "CO-015" } },
            errors: [
              { status: 400, code: "bad_request", meaning: "No title, or the list is on another board." },
              { status: 403, code: "forbidden", meaning: "This key cannot write. Write access is on the Build plan." },
              { status: 429, code: "rate_limited", meaning: "Too many calls. Slow down; the limit is per minute and per plan." },
            ],
            example: `curl -X POST https://lanes.axxes.club/api/v1/boards/$BOARD_ID/cards \\\n  -H "Authorization: Bearer $AXXES_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"title":"Retry failed charges"}'`,
          },
        ],
      },
    ],
  },
  {
    key: "afters",
    name: "afters.am",
    summary: "Events, ticket types, orders, scanning and webhooks.",
    url: "https://afters.am",
    surface: "read-write",
    note: "The widest surface of any AXXES product, and the oldest.",
    baseUrl: "https://api.axxes.club/v1",
    resources: [
      {
        key: "events",
        label: "Events",
        description: "An event is a dated thing people can buy a ticket to.",
        operations: [
          {
            id: "afters.events.list",
            method: "GET",
            path: "/events",
            summary: "List events.",
            description: "Paginated. `cursor` is opaque — pass back what the previous page returned.",
            requires: "api.read",
            query: [
              { name: "limit", type: "number", description: "1–100, default 25." },
              { name: "cursor", type: "string", description: "Opaque cursor from the previous page." },
            ],
            response: { data: [{ id: "ev_…", title: "THE WINDOWS", startsAt: "2026-08-18T21:00:00Z" }], nextCursor: "eyJ…" },
            errors: [{ status: 401, code: "unauthorized", meaning: "Missing or invalid key." }],
          },
        ],
      },
      {
        key: "webhooks",
        label: "Webhooks",
        description: "Events pushed to your server as they happen.",
        operations: [
          {
            id: "afters.webhooks.create",
            method: "POST",
            path: "/webhooks",
            summary: "Register an endpoint.",
            description:
              "Returns a signing secret once. Verify every delivery by checking the `X-AXXES-Signature` header against the raw body with that secret — the JSON is re-serialised in transit, so verifying the parsed body will fail intermittently.",
            requires: "api.webhooks",
            body: [
              { name: "url", type: "string", required: true, description: "HTTPS only.", example: "https://example.com/hooks/axxes" },
              { name: "events", type: "array", required: true, description: "Which events to receive.", example: ["order.created", "ticket.checked_in"] },
            ],
            response: { id: "wh_…", secret: "whsec_…" },
            errors: [{ status: 400, code: "bad_request", meaning: "Non-HTTPS url, or an unknown event name." }],
          },
        ],
      },
    ],
  },
  {
    key: "nexus",
    name: "Nexus",
    summary: "The knowledge base.",
    url: "https://nexus.axxes.club",
    surface: "none",
    note: "Read access is coming. Nexus has its own in-product developer section today; it is not this API.",
    baseUrl: null,
    resources: [],
  },
  {
    key: "krates",
    name: "Krates",
    summary: "Inventory and requests.",
    url: "https://kr8s.axxes.club",
    surface: "none",
    note: "No public API yet. Ask if you need one — inventory is a common request.",
    baseUrl: null,
    resources: [],
  },
  {
    key: "folders",
    name: "Folders",
    summary: "File manager.",
    url: "https://folders.axxes.club",
    surface: "none",
    note: "No public API yet.",
    baseUrl: null,
    resources: [],
  },
  {
    key: "tollbooth",
    name: "Tollbooth",
    summary: "Payments on Stripe.",
    url: "https://tollbooth.axxes.club",
    surface: "beta",
    note: "In private beta. Ask for access before building on it.",
    baseUrl: null,
    resources: [],
  },
  {
    key: "vibez",
    name: "Vibez",
    summary: "Attendee photo feeds.",
    url: "https://vibez.axxes.club",
    surface: "beta",
    note: "In beta, behind an allowlist.",
    baseUrl: null,
    resources: [],
  },
]

export function apiByKey(key: string) {
  return API_PRODUCTS.find((p) => p.key === key)
}

export function documentedProducts() {
  return API_PRODUCTS.filter((p) => p.resources.length > 0)
}

/** Everything not yet public, so the index can be honest about it. */
export function comingSoon() {
  return API_PRODUCTS.filter((p) => p.resources.length === 0)
}

export function operationById(id: string) {
  for (const product of API_PRODUCTS) {
    for (const resource of product.resources) {
      const op = resource.operations.find((o) => o.id === id)
      if (op) return { product, resource, operation: op }
    }
  }
  return null
}
