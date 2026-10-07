import {createWebhookHandler} from '@/lib/deploy/github/http'
import {ingestPush} from '@/lib/deploy/github/intake'
export const runtime='nodejs'
export const POST=createWebhookHandler(()=>process.env.DEPLOY_GITHUB_WEBHOOK_SECRET,ingestPush)
