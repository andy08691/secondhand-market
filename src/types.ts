export type Product = {
  id: string
  name: string
  category: string
  brandModel?: string
  salePrice: number
  originalPrice?: number
  condition?: string
  defect?: string
  description?: string
  status: string
  quantity: number
  photos: string[]
  listedAt?: string
  availableDate?: string
}
