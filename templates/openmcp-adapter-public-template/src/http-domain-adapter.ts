import type { DomainAdapter, Ledger, Transaction } from 'openmcp'

type ListTransactionsInput = Parameters<DomainAdapter['listTransactions']>[1]

export type HttpDomainAdapterOptions = {
  baseUrl: string
  fetchImpl?: typeof fetch
  getAuthHeader?: () => string | Promise<string>
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path}`
}

export class HttpDomainAdapter implements DomainAdapter {
  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch
  private readonly getAuthHeader?: () => string | Promise<string>

  constructor(options: HttpDomainAdapterOptions) {
    this.baseUrl = options.baseUrl
    this.fetchImpl = options.fetchImpl || fetch
    this.getAuthHeader = options.getAuthHeader
  }

  async listLedgers(_: string): Promise<Ledger[]> {
    return this.request<Ledger[]>('GET', '/ledgers')
  }

  async listTransactions(_: string, input: ListTransactionsInput): Promise<{ items: Transaction[]; total: number; page: number; pageSize: number; hasMore: boolean }> {
    const params = new URLSearchParams({ ledgerId: input.ledgerId })
    if (input.startDate) params.set('startDate', input.startDate)
    if (input.endDate) params.set('endDate', input.endDate)
    if (input.page) params.set('page', String(input.page))
    if (input.pageSize) params.set('pageSize', String(input.pageSize))

    return this.request('GET', `/transactions?${params.toString()}`)
  }

  async createTransaction(_: string, payload: Record<string, unknown>): Promise<Transaction> {
    return this.request('POST', '/transactions', payload)
  }

  async updateTransaction(_: string, transactionId: string, payload: Record<string, unknown>): Promise<Transaction> {
    return this.request('PATCH', `/transactions/${encodeURIComponent(transactionId)}`, payload)
  }

  async softDeleteTransaction(_: string, transactionId: string): Promise<{ id: string; deleted: true }> {
    return this.request('DELETE', `/transactions/${encodeURIComponent(transactionId)}?hard=false`)
  }

  async hardDeleteTransaction(_: string, transactionId: string): Promise<{ id: string; deleted: true; hard: true }> {
    return this.request('DELETE', `/transactions/${encodeURIComponent(transactionId)}?hard=true`)
  }

  async getTransactionById(_: string, transactionId: string): Promise<Transaction | null> {
    const result = await this.request<{ item: Transaction | null }>('GET', `/transactions/${encodeURIComponent(transactionId)}`)
    return result.item
  }

  async close(): Promise<void> {
    return
  }

  private async request<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      'content-type': 'application/json'
    }

    if (this.getAuthHeader) {
      const auth = await this.getAuthHeader()
      if (auth) headers.authorization = auth
    }

    const response = await this.fetchImpl(joinUrl(this.baseUrl, path), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Adapter upstream request failed: ${response.status} ${text}`)
    }

    return response.json() as Promise<T>
  }
}

export function createHttpDomainAdapter(options: HttpDomainAdapterOptions): DomainAdapter {
  return new HttpDomainAdapter(options)
}
