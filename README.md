# Secondhand Market

A responsive secondhand-item storefront powered by a Notion database and deployed with Cloudflare Pages.

## Features

- Reads products from the existing Notion database
- Displays primary and additional product photos
- Keyword search across product name, model, category, and description
- Category and price filters
- Price sorting
- Responsive product grid and detail modal
- Hides items marked `已售出` or `下架`
- Keeps the Notion token in a server-side Cloudflare Pages Function

## Stack

- React
- TypeScript
- Vite
- Cloudflare Pages Functions
- Notion API

## Notion database

The API expects these properties:

- `物品名稱`
- `分類`
- `品牌／型號`
- `預計售價（USD）`
- `原購入價（USD）`
- `物品狀況`
- `瑕疵／缺件`
- `描述／備註`
- `出售狀態`
- `數量`
- `主要照片`
- `補充照片`
- `上架日期`

## Local frontend development

```bash
npm install
npm run dev
```

The frontend calls `/api/products`. To test the complete Cloudflare Pages application locally, install Wrangler and create a `.dev.vars` file:

```env
NOTION_TOKEN=secret_xxx
NOTION_DATA_SOURCE_ID=329c73e4-63dc-49f1-9e8c-ac7552c85b53
```

Never commit `.dev.vars` or a real Notion token.

## Create a Notion integration

1. Create an internal Notion integration.
2. Copy its secret token.
3. Open the `二手物品出售管理` database.
4. Share the database with that integration.
5. Keep the integration read-only if possible.

The Notion connection used inside ChatGPT is separate and cannot be reused as a website secret.

## Deploy to Cloudflare Pages

1. In Cloudflare Dashboard, open **Workers & Pages**.
2. Create a Pages project and connect `andy08691/secondhand-market`.
3. Set the build command to `npm run build`.
4. Set the build output directory to `dist`.
5. Add these environment variables under project settings:
   - `NOTION_TOKEN`
   - `NOTION_DATA_SOURCE_ID=329c73e4-63dc-49f1-9e8c-ac7552c85b53`
6. Deploy the project.

The `functions/api/products.ts` file is automatically deployed as `/api/products`.

## Product visibility

The current API shows all records except those whose `出售狀態` is:

- `已售出`
- `下架`

To publish only fully prepared products, change the filter in `functions/api/products.ts` to include only `出售中`.

## Security

- Do not put `NOTION_TOKEN` in frontend code.
- Do not commit the token to GitHub.
- Rotate the token immediately if it is exposed.
- The API response is cached for five minutes to reduce Notion API traffic.
