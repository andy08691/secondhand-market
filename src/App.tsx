import { useEffect, useMemo, useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import ProductImage from './components/ProductImage'
import type { Product } from './types'

const PRODUCT_CACHE_KEY = 'secondhand-market-products-v2'
const PRODUCT_CACHE_TTL_MS = 5 * 60 * 1000

const priceLabel = (value: number) => value === 0 ? '免費' : `$${value}`

type ProductCache = {
  expiresAt: number
  products: Product[]
}

const readProductCache = (): Product[] | null => {
  try {
    const raw = sessionStorage.getItem(PRODUCT_CACHE_KEY)
    if (!raw) return null

    const cache = JSON.parse(raw) as ProductCache
    if (!Array.isArray(cache.products) || cache.expiresAt <= Date.now()) {
      sessionStorage.removeItem(PRODUCT_CACHE_KEY)
      return null
    }

    return cache.products
  } catch {
    sessionStorage.removeItem(PRODUCT_CACHE_KEY)
    return null
  }
}

const writeProductCache = (products: Product[]) => {
  try {
    const cache: ProductCache = {
      products,
      expiresAt: Date.now() + PRODUCT_CACHE_TTL_MS
    }
    sessionStorage.setItem(PRODUCT_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // The storefront still works when storage is unavailable.
  }
}

function App() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('全部')
  const [priceRange, setPriceRange] = useState('全部')
  const [sort, setSort] = useState('newest')
  const [selected, setSelected] = useState<Product | null>(null)

  useEffect(() => {
    const cachedProducts = readProductCache()
    if (cachedProducts) {
      setProducts(cachedProducts)
      setLoading(false)
      return
    }

    const controller = new AbortController()

    fetch('/api/products', {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    })
      .then(async response => {
        if (!response.ok) {
          const body = await response.json().catch(() => ({})) as { error?: string }
          throw new Error(body.error ?? '讀取商品失敗')
        }
        return response.json() as Promise<{ products?: Product[] }>
      })
      .then(data => {
        const nextProducts = data.products ?? []
        setProducts(nextProducts)
        writeProductCache(nextProducts)
      })
      .catch(err => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : '讀取商品失敗')
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!selected) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null)
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [selected])

  const categories = useMemo(
    () => ['全部', ...Array.from(new Set(products.map(product => product.category).filter(Boolean)))],
    [products]
  )

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const matchesPrice = (price: number) => {
      if (priceRange === 'free') return price === 0
      if (priceRange === '1-10') return price >= 1 && price <= 10
      if (priceRange === '11-50') return price >= 11 && price <= 50
      if (priceRange === '51+') return price >= 51
      return true
    }

    return products
      .filter(product => {
        const text = [product.name, product.brandModel, product.description, product.category]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        return (!normalized || text.includes(normalized))
          && (category === '全部' || product.category === category)
          && matchesPrice(product.salePrice)
      })
      .sort((a, b) => {
        if (sort === 'price-asc') return a.salePrice - b.salePrice
        if (sort === 'price-desc') return b.salePrice - a.salePrice
        return (b.listedAt ?? '').localeCompare(a.listedAt ?? '')
      })
  }, [products, query, category, priceRange, sort])

  return (
    <main>
      <header className="hero">
        <div className="hero__content">
          <p className="eyebrow">SECONDHAND MARKET</p>
          <h1>二手物品出售</h1>
          <p>所有商品皆為自用二手物品。可用關鍵字、分類與價格快速找到需要的項目。</p>
          <div className="stats"><strong>{products.length}</strong><span>件商品</span></div>
        </div>
      </header>

      <section className="toolbar" aria-label="商品篩選">
        <label className="search-box">
          <Search size={18} />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜尋商品、品牌或描述" />
        </label>
        <div className="filters">
          <SlidersHorizontal size={18} />
          <select value={category} onChange={event => setCategory(event.target.value)}>
            {categories.map(item => <option key={item}>{item}</option>)}
          </select>
          <select value={priceRange} onChange={event => setPriceRange(event.target.value)}>
            <option value="全部">所有價格</option>
            <option value="free">免費</option>
            <option value="1-10">$1–10</option>
            <option value="11-50">$11–50</option>
            <option value="51+">$51+</option>
          </select>
          <select value={sort} onChange={event => setSort(event.target.value)}>
            <option value="newest">最新上架</option>
            <option value="price-asc">價格低到高</option>
            <option value="price-desc">價格高到低</option>
          </select>
        </div>
      </section>

      <section className="content">
        {loading && <div className="message">正在載入商品…</div>}
        {error && <div className="message error">{error}</div>}
        {!loading && !error && filtered.length === 0 && <div className="message">找不到符合條件的商品。</div>}
        <div className="grid">
          {filtered.map((product, index) => (
            <article
              className="card"
              key={product.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelected(product)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') setSelected(product)
              }}
            >
              <div className="card__image">
                <ProductImage src={product.photos[0]} alt={product.name} priority={index < 3} />
                <span className="status">{product.status}</span>
              </div>
              <div className="card__body">
                <div className="card__meta"><span>{product.category}</span><span>{product.condition}</span></div>
                <h2>{product.name}</h2>
                {product.brandModel && <p className="muted">{product.brandModel}</p>}
                <div className="price-row">
                  <strong>{priceLabel(product.salePrice)}</strong>
                  {product.originalPrice != null && <span>原價 ${product.originalPrice}</span>}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <article className="modal" onClick={event => event.stopPropagation()}>
            <button className="close" aria-label="關閉" onClick={() => setSelected(null)}><X /></button>
            <div className="modal__gallery">
              {selected.photos.length
                ? selected.photos.map((url, index) => (
                    <ProductImage key={`${url}-${index}`} src={url} alt={`${selected.name} 照片 ${index + 1}`} priority />
                  ))
                : <div className="placeholder">尚無照片</div>}
            </div>
            <div className="modal__body">
              <p className="eyebrow">{selected.category}</p>
              <h2>{selected.name}</h2>
              <div className="price-row large">
                <strong>{priceLabel(selected.salePrice)}</strong>
                {selected.originalPrice != null && <span>原價 ${selected.originalPrice}</span>}
              </div>
              {selected.brandModel && <p><b>品牌／型號：</b>{selected.brandModel}</p>}
              {selected.condition && <p><b>物品狀況：</b>{selected.condition}</p>}
              {selected.defect && <p><b>瑕疵／缺件：</b>{selected.defect}</p>}
              {selected.description && <p className="description">{selected.description}</p>}
            </div>
          </article>
        </div>
      )}
    </main>
  )
}

export default App
