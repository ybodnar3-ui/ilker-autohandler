import { runSync } from './pipeline'
import { readStatus } from './storage/r2'

export interface Env {
  ASSETS: R2Bucket
  WILLHABEN_ORG_ID: string
  USER_AGENT: string
  PAGES_DEPLOY_HOOK?: string
  ALERT_WEBHOOK_URL?: string
}

const dealerUrl = (orgId: string) =>
  `https://www.willhaben.at/iad/haendler/hayatgruppe/auto/?orgId=${orgId}&page=1&rows=200`

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const outcome = await runSync({
      bucket: env.ASSETS,
      now: new Date(),

      fetchPage: () =>
        fetch(dealerUrl(env.WILLHABEN_ORG_ID), {
          headers: { 'User-Agent': env.USER_AGENT, 'Accept-Language': 'de-AT,de;q=0.9' },
        }),

      fetchImage: (url) => fetch(url, { headers: { 'User-Agent': env.USER_AGENT } }),

      // Перебудова сайту запускається лише коли зміст справді змінився —
      // рішення про це ухвалює pipeline, не цей обробник.
      triggerBuild: async () => {
        if (!env.PAGES_DEPLOY_HOOK) return
        await fetch(env.PAGES_DEPLOY_HOOK, { method: 'POST' })
      },

      notify: async (message) => {
        if (!env.ALERT_WEBHOOK_URL) return
        await fetch(env.ALERT_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: message }),
        })
      },
    })

    ctx.waitUntil(Promise.resolve())
    console.log('sync', JSON.stringify(outcome))
  },

  /** Ручна перевірка стану: GET /status */
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname !== '/status') {
      return new Response('Not found', { status: 404 })
    }
    return Response.json(await readStatus(env.ASSETS))
  },
}
