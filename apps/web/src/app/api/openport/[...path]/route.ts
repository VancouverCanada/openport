const INTERNAL_API_BASE_URL =
  process.env.OPENPORT_INTERNAL_API_BASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_OPENPORT_API_BASE_URL?.trim() ||
  'http://127.0.0.1:4100/api'

export const dynamic = 'force-dynamic'

function buildTargetUrl(path: string[]): string {
  const normalized = path.join('/')
  return `${INTERNAL_API_BASE_URL}/${normalized}`
}

async function proxy(request: Request, path: string[]): Promise<Response> {
  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.delete('connection')
  headers.delete('content-length')

  const response = await fetch(buildTargetUrl(path), {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text(),
    cache: 'no-store',
    redirect: 'manual'
  })

  const responseHeaders = new Headers(response.headers)
  responseHeaders.delete('content-encoding')
  responseHeaders.delete('content-length')
  responseHeaders.delete('transfer-encoding')

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders
  })
}

type RouteContext = {
  params: Promise<{ path: string[] }>
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params
  return proxy(request, path)
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params
  return proxy(request, path)
}

export async function PUT(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params
  return proxy(request, path)
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params
  return proxy(request, path)
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params
  return proxy(request, path)
}

export async function OPTIONS(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params
  return proxy(request, path)
}
