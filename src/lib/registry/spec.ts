/**
 * The shape an API surface is described in.
 *
 * A documentation portal needs somewhere to put an endpoint, and the
 * obvious place is a description of the HTTP surface — method, path, what
 * it takes, what it returns, what can go wrong. Not a CMS row and not a
 * markdown blob: something a reference page can render, something a test
 * can call, and something an AI can be handed to write a client from.
 *
 * `request`/`response` are examples, not schemas. They show the shape a
 * developer will actually see, which is the part a schema does not tell you.
 */
export type Field = {
  name: string
  type: "string" | "number" | "boolean" | "object" | "array" | "enum"
  required?: boolean
  description: string
  /** For enums, the permitted values. */
  values?: string[]
  example?: unknown
}

export type Operation = {
  /** Session management is not a bearer-authenticated integration endpoint. */
  authentication?: "session" | "bearer"

  id: string
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"
  path: string
  /** One line, shown in the list and in search. */
  summary: string
  /** What it is for, in a sentence or two. */
  description: string
  /** Which plan feature it needs; the reference says so rather than 403ing. */
  requires: string
  pathParams?: Field[]
  query?: Field[]
  body?: Field[]
  /** Example response body. */
  response: unknown
  /** Every way it can fail, with the status and what to do about it. */
  errors: { status: number; code: string; meaning: string }[]
  /** A runnable curl against a real shape. */
  example?: string
}

export type ApiResource = {
  key: string
  label: string
  description: string
  operations: Operation[]
}

export type ApiProduct = {
  /** Key from the plan catalog, so the reference and the paywall agree. */
  key: string
  name: string
  summary: string
  /** Where the product itself lives, for someone who wants the UI. */
  url: string
  /** Maturity of the surface, shown honestly on the index. */
  surface: "read-write" | "read" | "beta" | "none"
  note: string
  baseUrl: string | null
  resources: ApiResource[]
}
