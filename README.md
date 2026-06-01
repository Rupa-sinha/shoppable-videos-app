# Shoppable Videos App — Shopify Take-Home Assignment

## Overview

A production-ready Shopify app that allows merchants to create "shoppable videos" — attaching catalog products to video hotspots, embedding the player on their storefront, and letting shoppers add tagged products to cart without leaving the video.

**Key Features**:
- 📹 Upload/manage videos in Shopify admin
- 🏷️ Search & tag products with position/timestamp metadata
- 📊 Live/draft publishing status
- 🎨 Theme app block (no manual theme editing)
- 🎬 Interactive storefront player with hotspots
- 🛒 One-click add-to-cart from video
- ✅ Clean install/uninstall lifecycle
- 🔐 HMAC verification, session tokens, compliance webhooks

---

## Quick Start

### Prerequisites
- Node.js 18+
- Shopify CLI (`shopify` command)
- Shopify Partners account with dev store

### 1. Clone & Install

```bash
git clone https://github.com/Rupa-sinha/shoppable-videos-app.git
cd shoppable-videos-app
npm install
```

### 2. Configure

Copy `.env.example` to `.env` and fill in:

```bash
cp .env.example .env
```

**`.env` fields**:
- `SHOPIFY_API_KEY` — From Shopify Partners dashboard
- `SHOPIFY_API_SECRET` — From Shopify Partners dashboard
- `SESSION_SECRET` — Random string: `openssl rand -base64 32`

### 3. Create App in Shopify Partners

1. Go to [partners.shopify.com](https://partners.shopify.com)
2. **Apps and integrations** → **Create app** → **Custom app**
3. Name it "Shoppable Videos"
4. Copy API key/secret into `.env`
5. Scopes → Add from `shopify.app.toml`:
   ```
   write_products, read_products, write_metaobjects, read_metaobjects,
   write_files, read_files, write_themes, read_themes
   ```
6. Set redirect URI: `https://localhost:3000/auth/callback`

### 4. Run

```bash
npm run dev
```

This starts:
- Express server on `:3000`
- Shopify CLI tunneling (ngrok)
- Admin UI hot reload

Follow OAuth prompt → select dev store → app loads in admin.

### 5. Test Install → Create Video → Tag Products → Storefront Block → Add to Cart → Uninstall

See **§ Testing Workflow** below.

---

## Architecture & Data Model

### Core Entities

**ShoppableVideo** (Metaobject)
```javascript
{
  id: "gid://shopify/MetaobjectInstance/abc123",
  title: "Spring Lookbook",
  videoUrl: "https://cdn.shopify.com/.../video.mp4",
  status: "DRAFT" | "LIVE",
  createdAt: "2026-06-01T13:00:00Z",
  updatedAt: "2026-06-01T13:00:00Z",
  tags: [VideoTag, ...] // 1:N relationship
}
```

**VideoTag** (Metaobject)
```javascript
{
  id: "gid://shopify/MetaobjectInstance/tag-xyz",
  videoId: "gid://shopify/MetaobjectInstance/abc123", // FK
  productId: "gid://shopify/Product/123456",           // ID reference
  productName: "Linen Shirt",                           // Snapshot
  productImage: "https://cdn.shopify.com/.../image.jpg", // Snapshot
  price: "48.00",                                       // Snapshot
  timestamp: 4.2,                                        // Seconds
  position: "top-left",                                 // UI hint
  status: "ACTIVE" | "ORPHANED"                        // Product deleted?
}
```

### Why This Design?

#### 1. Entities & Relationships

**Decision**: Separate `VideoTag` metaobject (not nested array).

**Trade-offs**:
- ✅ Pagination of tags (>100 products per video)
- ✅ Individual tag mutation (edit position/timestamp)
- ❌ Extra metaobject definition + API calls

**Justification**: Scalability. Tags are first-class entities with independent mutations.

---

#### 2. Product Reference Strategy

**Problem**: Merchant tags product; Shopify deletes it. What happens?

**Solution**: Store **both ID + snapshot** metadata.

```javascript
// VideoTag structure
{
  productId: "gid://shopify/Product/123456",     // Live reference
  productName: "Linen Shirt",                    // Snapshot at tag time
  productImage: "https://...",                   // Snapshot
  price: "48.00",                                // Snapshot
  status: "ACTIVE" | "ORPHANED"                 // Handles deletion
}
```

**Failure Modes & Handling**:

| Failure Mode | Trigger | Handler | Storefront UX | Admin UX |
|------|---------|---------|---------|----------|
| Product deleted | `products/delete` webhook | Mark tag status=ORPHANED | Hotspot shows "unavailable" | Tag struck-through |
| Product renamed/repriced | Manual edit | Snapshot immutable; re-fetch on edit | Old name/price shown (intentional) | Admin refreshes product search |
| Stale product in cart | Customer click → add | Shopify cart API rejects | Error message shown | N/A |

**Code** (webhook handler):
```javascript
// webhooks/productDelete.js
export async function handleProductDelete(productId, shop, graphqlClient) {
  const tags = await findTagsByProductId(graphqlClient, productId);
  for (const tag of tags) {
    await updateTagStatus(graphqlClient, tag.id, 'ORPHANED');
  }
}
```

**Why snapshots**: Consistent UX. The product name/price shown on the storefront matches what the merchant tagged, even if the product changes later.

---

#### 3. Storage Choice

**Policy**: All data in **Shopify metaobjects**. No external DB.

| Data | Storage | Justification |
|------|---------|---------------|
| ShoppableVideo | Metaobject | Designed for this; shop-scoped; survives reinstall |
| VideoTag | Metaobject | Relational structure; paginated queries |
| Product snapshots | Metafield on Tag | Denormalized; minimizes re-fetches |
| Session tokens | In-memory (Node.js) | Short-lived; refreshed per auth |
| Uninstall cleanup | Webhook handler | Delete metaobjects on app/uninstalled |

**Why NOT external DB**:
- ✅ Metaobjects are row-scoped (shop_id implicit)
- ✅ No separate DB lifecycle → simpler security
- ✅ GDPR: Data stays in Shopify's managed infrastructure
- ✅ Reinstall = fresh metaobjects (no stale data)

**Trade-offs**:
- ❌ No complex JOINs (e.g., "all videos tagged with product X")
  - **Workaround**: Paginate all videos + filter in-app (acceptable for <1000 videos)
- ❌ Metaobject field limits (~100 fields per type)
  - **Not an issue**: Each tag is a separate object

**Data Lifecycle on Uninstall**:
```
1. Admin clicks uninstall
2. Shopify fires app/uninstalled webhook
3. Handler queries all shoppable_video metaobjects for this shop
4. Delete each video (cascade deletes tags)
5. Return 200 OK
6. Storefront blocks degrade gracefully (show "Video unavailable")
```

---

#### 4. Shop Scoping

**Requirement**: Two shops must **never** see each other's data.

**Mechanism**:

1. **Session Token Auth**:
   ```javascript
   app.post('/api/videos', async (req, res) => {
     const session = await shopifyApp.sessionStorage.loadSession(req.sessionID);
     const { shop } = session; // e.g., "my-store.myshopify.com"
     
     // All GraphQL queries inherit this shop context
     const client = shopify.clients.graphqlClient({ shop });
   });
   ```

2. **Metaobject Ownership**:
   - Shopify auto-scopes metaobjects to the shop that created them
   - GraphQL queries filtered by session token's shop

3. **Webhook Verification**:
   ```javascript
   app.post('/webhooks/app/uninstalled', verifyHmac, (req, res) => {
     const shop = req.header('X-Shopify-Shop-Api-Access-Token')?.shop;
     // Metaobjects auto-deleted by Shopify (shop-scoped)
   });
   ```

**Isolation Guarantee**: Session tokens + metaobject scoping ensures zero cross-shop leaks.

---

#### 5. Storefront Read Path

**Problem**: How does the theme block fetch video data at render time?

**Solution**: Client-side GraphQL query with sessionStorage caching.

**Flow**:
```
1. Merchant adds block to page → theme editor
2. Merchant selects video from dropdown
3. Theme saves block config (videoId in JSON)
4. Storefront page loads → block renders
5. Block JavaScript:
   a. Check sessionStorage["sv_video_${videoId}"]
   b. If cached & < 5 min old → use cache
   c. Else → GraphQL query for video + tags + product data
   d. Cache result in sessionStorage
   e. Render player
```

**GraphQL Query** (client-side, public):
```graphql
query GetShoppableVideo($videoId: ID!) {
  metaobjectInstance(id: $videoId) {
    title: field(key: "title") { value }
    videoUrl: field(key: "video_url") { value }
    status: field(key: "status") { value }
    tags: references(first: 100, type: "video_tag") {
      nodes {
        productId: field(key: "product_id") { value }
        productName: field(key: "product_name") { value }
        productImage: field(key: "product_image") { value }
        price: field(key: "price") { value }
        timestamp: field(key: "timestamp") { value }
        position: field(key: "position") { value }
        status: field(key: "status") { value }
      }
    }
  }
}
```

**Auth & Caching**:
- **Auth**: No token needed; metaobjects are public (no PII)
- **Caching**: sessionStorage key = `sv_video_${videoId}`, TTL 5 min
- **Fallback**: Query fails gracefully → "Video unavailable"

**Why This**:
- ✅ Lightweight: One query per page load
- ✅ Fresh data: Product snapshots always current
- ✅ Stateless: No server-side session needed
- ✅ Degradation: App uninstall → block shows fallback UI
- ❌ Client-exposed IDs: VideoId/tag IDs visible in HTML (acceptable; no secrets)

---

## Project Structure

```
.
├── server.js                          # Express entry point
├── shopify.app.toml                   # App config (scopes, webhooks, version)
├── .env.example                       # Environment template
├── package.json                       # Dependencies
├── COLLABORATION_LOG.md               # Build provenance (this assignment)
├── README.md                          # This file
├── src/
│   ├── models/
│   │   ├── ShoppableVideo.js         # Video entity (with sv-ckpt watermark)
│   │   └── VideoTag.js               # Tag entity
│   ├── api/
│   │   ├── videos.js                 # Video CRUD routes
│   │   ├── tags.js                   # Tag CRUD routes
│   │   ├── products.js               # Product search
│   │   └── cart.js                   # Cart integration
│   ├── webhooks/
│   │   ├── uninstall.js              # app/uninstalled handler
│   │   ├── productDelete.js          # products/delete handler
│   │   └── compliance.js             # GDPR handlers
│   ├── utils/
│   │   ├── hmac.js                   # HMAC verification
│   │   ├── graphql.js                # GraphQL client factory
│   │   └── session.js                # Session storage
│   └── admin/
│       ├── components/
│       │   ├── VideoList.jsx         # Admin video list
│       │   └── VideoEditor.jsx       # Admin video editor
│       └── index.jsx                 # Admin UI entry
└── extensions/
    └── blocks/
        └── shoppable-video/
            ├── block.liquid           # Theme block definition
            ├── index.js               # Block JavaScript/player
            └── styles.css             # Block styles
```

---

## API Reference

### Admin Routes (Authenticated)

**Videos**:
- `GET /api/videos` — List videos (paginated)
- `POST /api/videos` — Create video
- `GET /api/videos/:id` — Get video + tags
- `PATCH /api/videos/:id` — Update video (title, status)
- `DELETE /api/videos/:id` — Delete video

**Tags**:
- `POST /api/videos/:videoId/tags` — Add tag
- `PATCH /api/videos/:videoId/tags/:tagId` — Update tag (position, timestamp)
- `DELETE /api/videos/:videoId/tags/:tagId` — Delete tag

**Products**:
- `GET /api/products/search?q=...` — Search catalog

### Storefront Routes (Public)

- `POST /api/cart/add` — Add to cart (client calls Storefront API directly)
- `POST /api/storefront/video/:videoId` — Fetch video + tags (public, no auth)

### Webhooks

- `POST /webhooks/app/uninstalled` — Clean up on uninstall
- `POST /webhooks/products/delete` — Mark tags as orphaned
- `POST /webhooks/customers/data_request` — GDPR data export
- `POST /webhooks/customers/redact` — GDPR deletion
- `POST /webhooks/shop/redact` — GDPR shop deletion

**All webhooks**:
- Verify HMAC-SHA256 header
- Ack with 200 immediately
- Process async (idempotent)

---

## Usage Workflow

### Admin: Create & Tag a Video

1. **Apps** → **Shoppable Videos**
2. **+ Add video**
3. Enter title & paste video URL
4. **Search catalog** → type product name
5. Click product → set timestamp & position
6. **Add to video**
7. Repeat for more products
8. **Save** → **Set live**

### Merchant: Add Block to Theme

1. **Storefront** → **Theme editor**
2. **Add section** → search "Shoppable Video"
3. Select video from dropdown
4. **Save**

### Shopper: Watch & Buy

1. Watch video
2. Tap hotspot → product card appears
3. **Add to cart** → redirects to `/cart`
4. Checkout normally

---

## Install/Uninstall Lifecycle

### Install

1. Merchant clicks "Add app" in Shopify
2. OAuth prompt → grant scopes
3. App stores session token
4. Admin UI loads (empty video list)
5. Merchant creates first video

### Uninstall

1. **Settings** → **Apps and integrations** → uninstall
2. Shopify fires `app/uninstalled` webhook
3. Handler:
   - Queries all metaobjects for this shop
   - Deletes them (cascade to tags)
   - Logs completion
4. Session token invalidated
5. Storefront blocks show "Video unavailable" (graceful)

### Reinstall

1. Reinstall app (fresh OAuth)
2. Old metaobjects are gone (Shopify auto-deletes on uninstall)
3. Admin shows empty list (fresh start)
4. Merchant can create new videos

**Important**: Uninstall is **permanent**. Reinstall does NOT restore old videos.

---

## Edge Cases Handled

✅ **Video with zero tags** — Renders but no hotspots (graceful)  
✅ **Same product tagged twice** — Separate hotspots (allowed)  
✅ **Product deleted after tagging** — Tag marked ORPHANED; hotspot shows "unavailable"  
✅ **Video set live with zero tags** — Allowed (merchant choice)  
✅ **Block placed with no video selected** — Shows placeholder  
✅ **App uninstalled while block on page** — Query fails gracefully; fallback shown  
✅ **Duplicate product names in search** — Displayed with SKU/ID  
✅ **Large video files** — Uploaded to Shopify Files API; URL stored  

---

## Known Limitations

❌ **No video thumbnail generation** — Merchant provides or uses first frame  
❌ **No video analytics** — Clicks/adds not tracked (merchant uses Shopify analytics)  
❌ **No multi-language support** — English only  
❌ **No bulk tagging** — One product at a time  
❌ **No playback control customization** — Standard HTML5 player  
❌ **No A/B testing** — Single layout per video  

---

## Would Do With More Time

- 🎬 Thumbnail auto-generation from video first frame
- 📥 Batch product import via CSV
- 📊 Analytics dashboard (click heatmap, funnel to cart)
- 👁️ Video preview in admin (not just URL)
- 🎨 Advanced positioning UI (drag hotspot on video preview)
- 📈 Storefront analytics integration
- 🌍 Multi-language support
- 🔌 Vimeo/YouTube integration (not just uploaded videos)

---

## Testing

### Manual Checklist

- [ ] **Install**: OAuth prompt appears, scopes shown, redirects to admin
- [ ] **Admin loads**: Embedded in iframe, authenticated (no "refused" errors)
- [ ] **Create video**: Title + URL saved, appears in list
- [ ] **Search products**: Search works, results shown
- [ ] **Tag product**: Select → set timestamp/position → add
- [ ] **Delete tag**: Remove from list
- [ ] **Publish**: Status changes DRAFT → LIVE
- [ ] **Storefront block**: Player renders, hotspots clickable
- [ ] **Add to cart**: Product added, cart count updates
- [ ] **Uninstall**: App removed, videos gone, block shows "unavailable"
- [ ] **Reinstall**: Fresh start (old videos not restored)

### Automated Tests

```bash
npm test
```

Covers:
- HMAC verification
- Session token parsing
- Metaobject CRUD
- Webhook handlers
- GraphQL queries

---

## Scopes & Permissions (Least Privilege)

| Scope | Used For | Necessity |
|-------|----------|----------|
| `read_products` | Search catalog for tagging | Required |
| `write_metaobjects` | Create/update videos & tags | Required |
| `read_metaobjects` | Query videos & tags | Required |
| `write_files` | Upload video files | Required |
| `read_files` | Retrieve video URLs | Required |
| `write_themes` | Inject app block | Required |
| `read_themes` | Query theme structure | Required |

**No write_products** — app reads only (searches).

---

## Security

✅ **HMAC Verification** — All webhooks verify `X-Shopify-Hmac-SHA256` header  
✅ **Session Tokens** — App Bridge validates on every embedded request  
✅ **Shop Scoping** — Metaobjects implicitly scoped; queries inherit shop  
✅ **Secrets** — API key/secret in `.env` (never committed)  
✅ **Input Validation** — All user inputs sanitized before DB write  
✅ **Rate Limiting** — GraphQL cost-based rate limits with exponential backoff  
✅ **GDPR Compliance** — Webhooks for data request/redact/shop redaction  

---

## Deployment

### Local Development

```bash
npm run dev
```

### Production

1. Set `.env` for production (real API key/secret)
2. `npm run build`
3. `npm run deploy` (Shopify CLI handles deployment)

---

## Troubleshooting

**"Refused to connect" in admin iframe**
- Check tunneling URL in `.env` matches Shopify app redirect URI
- Run `shopify app dev` in project root

**"Product not found" when searching**
- Verify product exists in dev store
- Check `read_products` scope is granted

**"Webhook not firing" on uninstall**
- Check webhook subscriptions in `shopify.app.toml`
- Verify HMAC verification isn't silently failing (check logs)

**Storefront block shows "unavailable"**
- App may be uninstalled; reinstall to fix
- Check theme block has a video selected

---

## Build Provenance

This project complies with the **Build Provenance Protocol (SV-CKPT-1)**:

1. ✅ **COLLABORATION_LOG.md** — All human instructions, design decisions, code ownership tracked
2. ✅ **Watermark A** — `// sv-ckpt: data-model entry point` in `src/models/ShoppableVideo.js`
3. ✅ **Watermark B** — `Build-Provenance: SV-CKPT-1` appended to every commit

See **COLLABORATION_LOG.md** for full decision audit trail.

---

## Submission

**Repo**: [github.com/Rupa-sinha/shoppable-videos-app](https://github.com/Rupa-sinha/shoppable-videos-app)  
**Email submission to**: `talent@tectonic.so`  
**Subject**: `Shoppable Video Take-Home — Rupa-sinha`

**Include**:
- Public repo link
- Screen-recording link (install → create → tag → storefront → uninstall)
- Time spent (approx.)
- Assumptions made & decisions deferred

---

## License

MIT
