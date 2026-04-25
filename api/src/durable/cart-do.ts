import { DurableObject } from 'cloudflare:workers'
import { AppEnv } from '@/types/app.env'

type DOEnv = AppEnv['Bindings']

export class CartHubDO extends DurableObject {
  private clients = new Set<WebSocket>()

  constructor(ctx: DurableObjectState, env: DOEnv) {
    super(ctx, env);
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url)

    if (url.pathname === '/ws') {
      const pair = new WebSocketPair()
      const client = pair[0]
      const server = pair[1]

      server.accept()
      this.clients.add(server)

      server.addEventListener('close', () => this.clients.delete(server))
      server.addEventListener('error', () => this.clients.delete(server))

      return new Response(null, { status: 101, webSocket: client })
    }

    if (url.pathname === '/publish' && req.method === 'POST') {
      const payload = await req.json()
      const data = JSON.stringify(payload)

      for (const ws of this.clients) {
        try {
          ws.send(data)
        } catch {
          this.clients.delete(ws)
        }
      }

      return new Response('ok')
    }

    return new Response('Not found', { status: 404 })
  }

}
