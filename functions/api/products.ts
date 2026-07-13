type Env = {
  NOTION_TOKEN: string
  NOTION_DATA_SOURCE_ID: string
}

type PagesContext = {
  env: Env
  request: Request
}

type NotionProperty = Record<string, any>
type NotionPage = {
  id: string
  created_time: string
  properties: Record<string, NotionProperty>
}

const NOTION_VERSION = '2025-09-03'
const STATUS_ORDER: Record<string, number> = {
  出售中: 0,
  保留中: 1,
  已售出: 2
}

const textValue = (property?: NotionProperty): string => {
  const values = property?.title ?? property?.rich_text ?? []
  return values.map((item: any) => item?.plain_text ?? '').join('').trim()
}

const selectValue = (property?: NotionProperty): string => property?.select?.name ?? ''
const numberValue = (property?: NotionProperty): number | undefined =>
  typeof property?.number === 'number' ? property.number : undefined

const dateValue = (property?: NotionProperty): string | undefined => {
  const start = property?.date?.start
  return typeof start === 'string' ? start.slice(0, 10) : undefined
}

const fileUrls = (property?: NotionProperty): string[] =>
  (property?.files ?? [])
    .map((item: any) => item?.file?.url ?? item?.external?.url)
    .filter(Boolean)

const toProduct = (page: NotionPage) => {
  const properties = page.properties
  const primary = fileUrls(properties['主要照片'])
  const additional = fileUrls(properties['補充照片'])

  return {
    id: page.id,
    name: textValue(properties['物品名稱']) || '未命名物品',
    category: selectValue(properties['分類']) || '其他',
    brandModel: textValue(properties['品牌／型號']) || undefined,
    salePrice: numberValue(properties['預計售價（USD）']) ?? 0,
    originalPrice: numberValue(properties['原購入價（USD）']),
    condition: selectValue(properties['物品狀況']) || undefined,
    defect: textValue(properties['瑕疵／缺件']) || undefined,
    description: textValue(properties['描述／備註']) || undefined,
    status: selectValue(properties['出售狀態']) || '待上架',
    quantity: numberValue(properties['數量']) ?? 1,
    photos: [...primary, ...additional],
    listedAt: properties['上架日期']?.date?.start ?? page.created_time,
    availableDate: dateValue(properties['Available Date'])
  }
}

export const onRequestGet = async ({ env }: PagesContext): Promise<Response> => {
  if (!env.NOTION_TOKEN || !env.NOTION_DATA_SOURCE_ID) {
    return Response.json(
      { error: '網站尚未設定 Notion 環境變數。' },
      { status: 500 }
    )
  }

  try {
    const pages: NotionPage[] = []
    let cursor: string | undefined

    do {
      const response = await fetch(
        `https://api.notion.com/v1/data_sources/${env.NOTION_DATA_SOURCE_ID}/query`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.NOTION_TOKEN}`,
            'Content-Type': 'application/json',
            'Notion-Version': NOTION_VERSION
          },
          body: JSON.stringify({
            page_size: 100,
            ...(cursor ? { start_cursor: cursor } : {})
          })
        }
      )

      if (!response.ok) {
        const detail = await response.text()
        console.error('Notion API error:', response.status, detail)
        throw new Error(`Notion API returned ${response.status}`)
      }

      const data = await response.json() as {
        results: NotionPage[]
        has_more: boolean
        next_cursor?: string | null
      }
      pages.push(...data.results)
      cursor = data.has_more ? data.next_cursor ?? undefined : undefined
    } while (cursor)

    const products = pages
      .map(toProduct)
      .filter(product => product.status !== '下架')
      .sort((a, b) => {
        const statusDifference = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
        if (statusDifference !== 0) return statusDifference
        return (b.listedAt ?? '').localeCompare(a.listedAt ?? '')
      })

    return Response.json(
      { products, updatedAt: new Date().toISOString() },
      {
        headers: {
          'Cache-Control': 'public, max-age=300, s-maxage=300',
          'X-Content-Type-Options': 'nosniff'
        }
      }
    )
  } catch (error) {
    console.error(error)
    return Response.json(
      { error: '目前無法讀取商品資料，請稍後再試。' },
      { status: 502 }
    )
  }
}
