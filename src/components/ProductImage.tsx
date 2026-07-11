import { useEffect, useRef, useState } from 'react'

const convertedHeicCache = new Map<string, Promise<Blob>>()

const isHeicUrl = (url: string) => {
  try {
    return /\.hei[cf](?:$|[?&#])/i.test(decodeURIComponent(url))
  } catch {
    return /\.hei[cf](?:$|[?&#])/i.test(url)
  }
}

const loadHeicAsJpeg = (url: string): Promise<Blob> => {
  const cached = convertedHeicCache.get(url)
  if (cached) return cached

  const task = (async () => {
    const response = await fetch(`/api/image?url=${encodeURIComponent(url)}`)
    if (!response.ok) throw new Error('Unable to download HEIC image')

    const source = await response.blob()
    const { default: heic2any } = await import('heic2any')
    const converted = await heic2any({
      blob: source,
      toType: 'image/jpeg',
      quality: 0.82
    })

    return Array.isArray(converted) ? converted[0] : converted
  })()

  convertedHeicCache.set(url, task)
  task.catch(() => convertedHeicCache.delete(url))
  return task
}

type ProductImageProps = {
  src?: string
  alt: string
  priority?: boolean
}

export default function ProductImage({ src, alt, priority = false }: ProductImageProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [shouldLoad, setShouldLoad] = useState(priority)
  const [resolvedSrc, setResolvedSrc] = useState<string>()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (priority || shouldLoad || !src) return

    const node = hostRef.current
    if (!node || !('IntersectionObserver' in window)) {
      setShouldLoad(true)
      return
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setShouldLoad(true)
          observer.disconnect()
        }
      },
      { rootMargin: '500px 0px' }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [priority, shouldLoad, src])

  useEffect(() => {
    if (!src || !shouldLoad) return

    let active = true
    let objectUrl: string | undefined
    setFailed(false)

    if (!isHeicUrl(src)) {
      setResolvedSrc(src)
      return
    }

    setResolvedSrc(undefined)
    loadHeicAsJpeg(src)
      .then(blob => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setResolvedSrc(objectUrl)
      })
      .catch(() => {
        if (active) setFailed(true)
      })

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [src, shouldLoad])

  if (!src) {
    return <div ref={hostRef} className="product-image placeholder">尚無照片</div>
  }

  if (!shouldLoad || (!resolvedSrc && !failed)) {
    return <div ref={hostRef} className="product-image placeholder">照片載入中…</div>
  }

  if (failed) {
    return <div ref={hostRef} className="product-image placeholder">照片無法顯示</div>
  }

  return (
    <div ref={hostRef} className="product-image">
      <img
        src={resolvedSrc}
        alt={alt}
        decoding="async"
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'low'}
        draggable={false}
        onError={() => setFailed(true)}
      />
    </div>
  )
}
