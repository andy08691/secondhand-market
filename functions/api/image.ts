type PagesContext = {
  request: Request
}

const isAllowedHost = (hostname: string) => {
  const host = hostname.toLowerCase()
  return host === 'secure.notion-static.com'
    || host.endsWith('.notion-static.com')
    || host.endsWith('.notionusercontent.com')
    || host.endsWith('.amazonaws.com')
    || host.endsWith('.cloudfront.net')
}

export const onRequestGet = async ({ request }: PagesContext): Promise<Response> => {
  const requestUrl = new URL(request.url)
  const rawUrl = requestUrl.searchParams.get('url')

  if (!rawUrl) {
    return Response.json({ error: 'Missing image URL.' }, { status: 400 })
  }

  let sourceUrl: URL
  try {
    sourceUrl = new URL(rawUrl)
  } catch {
    return Response.json({ error: 'Invalid image URL.' }, { status: 400 })
  }

  if (sourceUrl.protocol !== 'https:' || !isAllowedHost(sourceUrl.hostname)) {
    return Response.json({ error: 'Image host is not allowed.' }, { status: 403 })
  }

  const response = await fetch(sourceUrl.toString(), {
    headers: {
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
    }
  })

  if (!response.ok || !response.body) {
    return Response.json({ error: 'Unable to fetch image.' }, { status: 502 })
  }

  const headers = new Headers()
  headers.set('Content-Type', response.headers.get('Content-Type') ?? 'application/octet-stream')
  headers.set('Cache-Control', 'public, max-age=2700, s-maxage=2700, stale-while-revalidate=3600')
  headers.set('X-Content-Type-Options', 'nosniff')

  const contentLength = response.headers.get('Content-Length')
  if (contentLength) headers.set('Content-Length', contentLength)

  return new Response(response.body, {
    status: 200,
    headers
  })
}
