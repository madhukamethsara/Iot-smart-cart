import { DurableObject } from 'cloudflare:workers'
import { AppEnv } from '@/types/app.env'

type DOEnv = AppEnv['Bindings']

export class CartHubDO extends DurableObject {
  private clients = new Set<WebSocket>()
  private cartClients = new Map<string, Set<WebSocket>>()

  constructor(ctx: DurableObjectState, env: DOEnv) {
    super(ctx, env);
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const cartWsPath = this.extractScopedPath(url.pathname, '/ws/')
    const cartPublishPath = this.extractScopedPath(url.pathname, '/publish/')

    if (url.pathname === '/ws') {
      return this.upgradeGlobalSocket()
    }

    if (cartWsPath) {
      return this.upgradeCartSocket(cartWsPath)
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

    if (cartPublishPath && req.method === 'POST') {
      const payload = await req.json()
      const data = JSON.stringify(payload)
      const scopedClients = this.cartClients.get(cartPublishPath)

      if (!scopedClients) {
        return new Response('ok')
      }

      for (const ws of scopedClients) {
        try {
          ws.send(data)
        } catch {
          scopedClients.delete(ws)
        }
      }

      if (scopedClients.size === 0) {
        this.cartClients.delete(cartPublishPath)
      }

      return new Response('ok')
    }

    return new Response('Not found', { status: 404 })
  }

  private extractScopedPath(pathname: string, prefix: '/ws/' | '/publish/'): string | null {
    if (!pathname.startsWith(prefix)) {
      return null
    }

    const scopedKey = pathname.slice(prefix.length)

    if (!scopedKey || scopedKey.includes('/')) {
      return null
    }

    return scopedKey
  }

  private upgradeGlobalSocket(): Response {
    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]

    server.accept()
    this.clients.add(server)

    server.addEventListener('close', () => this.clients.delete(server))
    server.addEventListener('error', () => this.clients.delete(server))

    return new Response(null, { status: 101, webSocket: client })
  }

  private upgradeCartSocket(cartKey: string): Response {
    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]

    server.accept()

    let scopedClients = this.cartClients.get(cartKey)
    if (!scopedClients) {
      scopedClients = new Set<WebSocket>()
      this.cartClients.set(cartKey, scopedClients)
    }

    scopedClients.add(server)

    const removeClient = () => {
      const activeClients = this.cartClients.get(cartKey)
      if (!activeClients) {
        return
      }

      activeClients.delete(server)
      if (activeClients.size === 0) {
        this.cartClients.delete(cartKey)
      }
    }

    server.addEventListener('close', removeClient)
    server.addEventListener('error', removeClient)

    return new Response(null, { status: 101, webSocket: client })
  }

}
