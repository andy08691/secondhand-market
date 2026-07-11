import { useEffect, useMemo, useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import type { Product } from './types'

const priceLabel = (value: number) => value === 0 ? '免費' : `$${value}`

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
    fetch('/api/products')
      .then(async response => {
        if (!response.ok) throw new Error((await response.json()).error ?? '讀取商品失敗')
        return response.json()
      })
      .then(data => setProducts(data.products ?? []))
      .catch(err => setError(err instanceof Error ? err.message : '讀取商品失敗'))
      .finally(() => setLoading(false))
  }, [])

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
          .filter(Boolean).join(' ').toLowerCase()
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
            <option value="全部">所有價格</option><option value="free">免費</option>
            <option value="1-10">$1–10</option><option value="11-50">$11–50</option><option value="51+">$51+</option>
          </select>
          <select value={sort} onChange={event => setSort(event.target.value)}>
            <option value="newest">最新上架</option><option value="price-asc">價格低到高</option><option value="price-desc">價格高到低</option>
          </select>
        </div>
      </section>

      <section className="content">
        {loading && <div className="message">正在載入商品…</div>}
        {error && <div className="message error">{error}</div>}
        {!loading && !error && filtered.length === 0 && <div className="message">找不到符合條件的商品。</div>}
        <div className="grid">
          {filtered.map(product => (
            <article className="card" key={product.id} onClick={() => setSelected(product)}>
              <div className="card__image">
                {product.photos[0] ? <img src={product.photos[0]} alt={product.name} loading="lazy" /> : <div className="placeholder">尚無照片</div>}
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
              {selected.photos.length ? selected.photos.map(url => <img key={url} src={url} alt={selected.name} />) : <div className="placeholder">尚無照片</div>}
            </div>
            <div className="modal__body">
              <p className="eyebrow">{selected.category}</p>
              <h2>{selected.name}</h2>
              <div className="price-row large"><strong>{priceLabel(selected.salePrice)}</strong>{selected.originalPrice != null && <span>原價 ${selected.originalPrice}</span>}</div>
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
