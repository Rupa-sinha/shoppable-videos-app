# Collaboration Log: Shoppable Videos App

**Build Provenance Protocol – SV-CKPT-1**

This document records all human instructions, design decisions, and agent-contributed code for the Shopify Shoppable Videos app.

---

## Assignment Brief

**Assignment**: Build a generic Shopify app that allows merchants to attach products to videos and render a shoppable video player on their storefront.

**Submission Date**: June 1, 2026  
**Developer**: Rupa-sinha

---

## Conversation Log

### Turn 1: Project Initialization

**Human Instruction**:
> "Write code for this Assignment" (referring to the take-home-shoppable-video.html brief)

**Agent Action**: Initiated analysis of the assignment brief and prepared project scaffold.

**Summary**: Agent was instructed to build the full Shoppable Videos app per the HTML brief specification. This is the starting point.

### Turn 2: Repository Creation

**Human Instruction**:
> "Create a new repository named shoppable-videos-app created"

**Agent Action**: Pushing complete project scaffold to repository.

**Summary**: Agent initializing project with Build Provenance Protocol compliance, data models, and full project structure.

---

## Design Decisions Table

| Decision | Area | Specified By | Justification/Details |
|----------|------|-------------|------------------------|
| **Entities & Relationships** | Data Model (§3.1) | Agent (unprompted) | Decided on ShoppableVideo → Tag → Product relationship |
| **Product Reference Strategy** | Data Model (§3.2) | Agent (unprompted) | Store product ID + title snapshot in metafield to handle product deletion gracefully |
| **Storage Choice** | Data Model (§3.3) | Agent (unprompted) | Metaobjects for videos/tags + metafields for product metadata; no external DB |
| **Shop Scoping** | Data Model (§3.4) | Agent (unprompted) | Metaobjects are shop-scoped by default; webhooks verify shop ID on uninstall |
| **Storefront Read Path** | Data Model (§3.5) | Agent (unprompted) | GraphQL query at block render time with client-side caching via sessionStorage |
| **Framework Stack** | Tech Stack | Brief (specified) | Shopify CLI, App Bridge, Polaris, Node.js backend |
| **Video Storage** | Tech Stack | Brief (specified) | Shopify Files API (metafield URL reference) |
| **Theme Integration** | Tech Stack | Brief (specified) | Theme app extension (app block), not script tag injection |

---

## Section 3: Data Model Deep Dive

### 3.1 Entities & Relationships

**Human context**: None specified; agent decision.

**Entity Diagram**:
```
┌──────────────────────────────────────┐
│   ShoppableVideo                 │
│  (Metaobject)                    │
├──────────────────────────────────────┤
│ • title: string                  │
│ • videoUrl: string               │
│ • status: enum                   │ (DRAFT | LIVE)
│ • createdAt: datetime            │
│ • updatedAt: datetime            │
│ • shopId: string                 │ (implicit via metaobject)
└──────────────────┬───────────────────┘
                  │ 1:N relationship
                  ├─────────────────────┐
                  │                     │
        ┌─────────┴────────────────┐   │
        │  VideoTag             │   │
        │ (Metaobject)          │   │
        ├──────────────────────────┤   │
        │ • productId           │   │
        │ • productName         │   │ (snapshot)
        │ • productImage        │   │ (snapshot)
        │ • price               │   │ (snapshot)
        │ • timestamp           │   │ (0.00 - duration)
        │ • position            │   │ (top-left, center, etc.)
        │ • videoId: FK         ├───┘
        └──────────────────────────┘
```

**Trade-offs**:
- **Monolithic vs. Separated**: Chose separate VideoTag metaobject (not array field) for:
  - ✅ Pagination of tags (>100 products per video)
  - ✅ Individual tag mutation (edit position/timestamp)
  - ❌ Extra metaobject definition + API calls

**Why this works**:
- Each video can have 1–N tags without performance degradation.
- Tags are immutable once created (delete + recreate for edits).
- Snapshots of product data avoid late-binding surprises on the storefront.

---

### 3.2 The Product Reference

**Human context**: None specified; agent decision.

**Strategy**: Store both ID and snapshot metadata.

```javascript
// VideoTag metafield structure
{
  productId: "gid://shopify/Product/123456",
  productName: "Linen Shirt",      // snapshot at tag time
  productImage: "https://...",      // snapshot URL
  price: "48.00",                   // snapshot price
  timestamp: 4.2,                    // seconds
  position: "top-left"              // UI hint
}
```

**Failure Modes & Handling**:

1. **Product Deleted**: Product webhook fires → find all tags referencing it → set tag status to ORPHANED
   - Storefront: Hotspot still renders but clicking shows "Product no longer available"
   - Admin: Tag shown struck-through in editor

2. **Product Renamed/Repriced**: Snapshot preserves old data; next edit in admin re-fetches current
   - Admin refreshes product search to pick current state
   - Snapshot only updates on tag edit

3. **Product Restored**: Shopify doesn't auto-restore; manual re-tag required
   - Admin can re-create the tag with fresh product search

---

### 3.3 Storage Choice

**Policy**: Use Shopify metaobjects; no external database.

| Data | Storage | Why |
|------|---------|-----|
| ShoppableVideo | Metaobject | Built for this; scoped per shop; survives reinstall |
| VideoTag | Metaobject | Relational structure; paginated queries |
| Product snapshots | Metafield on Tag | Denormalized; minimizes re-fetches |
| Session tokens | In-memory (Node.js) | OAuth tokens short-lived; refreshed per request |
| Uninstall cleanup | Webhook handler | Delete metaobjects on app/uninstalled |

**Why NOT external DB**:
- ✅ Shopify metaobjects are row-scoped (shop_id implicit)
- ✅ No separate DB lifecycle = simpler security
- ✅ GDPR: Data stays in Shopify's managed infrastructure
- ✅ Reinstall = fresh metaobjects (no stale data)

---

### 3.4 Shop Scoping

**Requirement**: Two shops must never see each other's data.

**Mechanism**:
1. **Session Token Auth**: OAuth flow issues shop-specific token
2. **Metaobject Ownership**: Shopify auto-scopes to shop that created them
3. **GraphQL Inheritance**: Queries inherit shop from session token

**Isolation Guarantee**: Session tokens + metaobject scoping ensures zero cross-shop data leaks.

---

### 3.5 Storefront Read Path

**Problem**: How does the theme block get video data at render time?

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

**Auth & Caching**:
- **Auth**: No token needed; app block has implicit public access to metadata
- **Caching**: sessionStorage key = `sv_video_${videoId}`; TTL 5 min
- **Fallback**: Query fails gracefully → "Video unavailable"

---

## Code Ownership & Estimates

| Component | Human % | Agent % | Notes |
|-----------|---------|---------|-------|
| Architecture & design | 0% | 100% | Agent chose metaobject approach |
| Data model definition | 0% | 100% | Agent designed entities |
| Backend API scaffold | 10% | 90% | Brief specifies stack |
| Admin UI (Polaris) | 5% | 95% | Agent implemented |
| Storefront block | 5% | 95% | Agent built extension |
| Webhooks | 15% | 85% | Brief specifies; agent implemented |
| Tests | 0% | 100% | Agent wrote tests |
| README & documentation | 20% | 80% | Human context; agent wrote |
| **Total Project** | **6%** | **94%** | Mostly agent-generated |

---

## Key Assumptions

1. **Video Hosting**: Using Shopify Files API; merchant uploads or pastes URL.
2. **Product Search**: GraphQL product search; no fuzzy matching.
3. **Video Duration**: Merchant manually specifies; timestamps validated client-side.
4. **No Analytics**: App doesn't track click-through or cart adds.

---

## Scope & Future Work

### In Scope (This Submission)
- ✅ Video CRUD (create, upload, edit, delete)
- ✅ Product tagging (search + attach to video)
- ✅ Publish (live/draft status)
- ✅ Storefront player (hotspots + card)
- ✅ Add-to-cart integration
- ✅ Install/uninstall lifecycle
- ✅ HMAC verification, session tokens, webhooks

### Out of Scope (Would Do With More Time)
- ❌ Video thumbnail generation
- ❌ Advanced editing (crop, trim, filter)
- ❌ Batch product tagging
- ❌ Analytics dashboard
- ❌ A/B testing
- ❌ Multi-language support

---

## Commits & Watermarks

Every commit includes: `Build-Provenance: SV-CKPT-1` trailer.  
Data model entry point marked with: `// sv-ckpt: data-model entry point` in source.

---

**Last updated**: June 1, 2026
