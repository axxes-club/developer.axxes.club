import {rateLimited} from "@/lib/security/admission"
import { auth } from "@/lib/auth"
import { toNextJsHandler } from "better-auth/next-js"

const handlers = toNextJsHandler(auth)
export const GET = rateLimited(handlers.GET)
export const POST = rateLimited(handlers.POST)
