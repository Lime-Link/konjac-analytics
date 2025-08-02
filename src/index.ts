// src/index.ts

export type KonjacOptions = {
  /** Your per-site API key (raw, not hashed) */
  apiKey: string
  /** Base URL for Konjac’s API (omit trailing slash) */
  endpoint?: string
}

export class Konjac {
  private readonly apiKey: string
  private readonly baseUrl: string

  constructor(opts: KonjacOptions) {
    this.apiKey = opts.apiKey
    this.baseUrl = opts.endpoint?.replace(/\/+$/, '') ?? 'https://api.konjac.io'

    if (typeof window !== 'undefined') {
      this.hookRouter()
      this.trackPageview()
    }
  }

  /** Automatically track on SPA navigation */
  private hookRouter() {
    const push = history.pushState
    history.pushState = (...args) => {
      push.apply(history, args as any)
      this.trackPageview()
    }
    window.addEventListener('popstate', () => this.trackPageview())
  }

  /** Fire a “pageview” beacon or fetch */
  private trackPageview() {
    const payload = {
      apiKey: this.apiKey,
      type: 'pageview' as const,
      ts: new Date().toISOString(),
      url: window.location.href,
      referrer: document.referrer,
    }
    const body = JSON.stringify(payload)
    const url = `${this.baseUrl}/track-analytics`

    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, body)
    } else {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      }).catch(() => {})
    }
  }

  /**
   * Manually track a named event
   * @param name  Event name, e.g. "button_click"
   * @param data  Optional metadata about the event
   */
  public trackEvent(name: string, data?: Record<string, any>) {
    const payload = {
      apiKey: this.apiKey,
      type: 'event' as const,
      ts: new Date().toISOString(),
      event: name,
      data: data ?? {},
    }
    fetch(`${this.baseUrl}/track-analytics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {})
  }

  /**
   * Fetch last N pageviews/events for this site
   * @param params.limit  Max number of records to return (default 100)
   */
  public async fetchAnalytics(params?: { limit?: number }) {
    const payload = {
      apiKey: this.apiKey,
      limit: params?.limit ?? 100,
    }
    const res = await fetch(`${this.baseUrl}/fetch-analytics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      throw new Error(`Konjac fetchAnalytics error: ${res.status} ${text}`)
    }
    return res.json() as Promise<any[]>
  }
}

/**
 * One-line initializer
 */
export function initKonjac(opts: KonjacOptions) {
  return new Konjac(opts)
}
