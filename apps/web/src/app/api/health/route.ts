import { NextResponse } from 'next/server'
import { getPublicApiBaseUrl } from '../../../lib/runtime-env'

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    service: 'openport-web',
    apiBaseUrl: getPublicApiBaseUrl()
  })
}
