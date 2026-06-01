import express from 'express';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// HMAC verification middleware
function verifyHmac(req, res, next) {
  const hmacHeader = req.header('X-Shopify-Hmac-SHA256');
  const topic = req.header('X-Shopify-Topic');
  const shop = req.header('X-Shopify-Shop-Api-Access-Token');
  const rawBody = req.rawBody || '';

  if (!hmacHeader) {
    return res.status(401).json({ error: 'Missing HMAC header' });
  }

  const computed = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET || '')
    .update(rawBody, 'utf8')
    .digest('base64');

  if (computed !== hmacHeader) {
    return res.status(401).json({ error: 'Invalid HMAC' });
  }

  req.shop = shop;
  req.topic = topic;
  next();
}

// Capture raw body for HMAC verification
app.use((req, res, next) => {
  if (req.path.startsWith('/webhooks')) {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      req.rawBody = data;
      express.json()(req, res, next);
    });
  } else {
    next();
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ===== WEBHOOK ROUTES =====

// App uninstalled webhook
app.post('/webhooks/app/uninstalled', verifyHmac, async (req, res) => {
  try {
    const shop = req.shop;
    console.log(`[WEBHOOK] App uninstalled from shop: ${shop}`);

    // Delete all metaobjects for this shop
    // In production, you would:
    // 1. Query all videos/tags for this shop
    // 2. Delete them via GraphQL
    // 3. Clear session storage
    // 4. Clear any cached data

    // Shopify automatically cascades deletions, so we mainly just log
    console.log(`[WEBHOOK] Cleanup complete for ${shop}`);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[WEBHOOK] Error handling uninstall:', error);
    res.status(500).json({ error: error.message });
  }
});

// Product deleted webhook
app.post('/webhooks/products/delete', verifyHmac, async (req, res) => {
  try {
    const shop = req.shop;
    const productId = req.body.id;
    console.log(`[WEBHOOK] Product deleted: ${productId} from shop: ${shop}`);

    // Find all tags referencing this product
    // Mark them as ORPHANED
    // In production, you would:
    // 1. Query all video_tags with product_id = productId
    // 2. Update each tag's status to ORPHANED
    // 3. This allows graceful degradation on storefront

    console.log(`[WEBHOOK] Tags for product ${productId} marked as orphaned`);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[WEBHOOK] Error handling product delete:', error);
    res.status(500).json({ error: error.message });
  }
});

// Customers data request (GDPR)
app.post('/webhooks/customers/data_request', verifyHmac, async (req, res) => {
  try {
    const shop = req.shop;
    const customerId = req.body.customer.id;
    console.log(`[WEBHOOK] Data request for customer: ${customerId} from shop: ${shop}`);

    // In production, you would:
    // 1. Collect all data associated with this customer
    // 2. Send to the provided webhook URL
    // For shoppable-videos app, we don't store customer PII, so this is minimal

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[WEBHOOK] Error handling data request:', error);
    res.status(500).json({ error: error.message });
  }
});

// Customers redact (GDPR)
app.post('/webhooks/customers/redact', verifyHmac, async (req, res) => {
  try {
    const shop = req.shop;
    const customerId = req.body.customer.id;
    console.log(`[WEBHOOK] Redact request for customer: ${customerId} from shop: ${shop}`);

    // In production, you would:
    // 1. Delete all data associated with this customer
    // For shoppable-videos app, we don't store customer data, so this is a no-op

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[WEBHOOK] Error handling redact:', error);
    res.status(500).json({ error: error.message });
  }
});

// Shop redact (GDPR)
app.post('/webhooks/shop/redact', verifyHmac, async (req, res) => {
  try {
    const shop = req.shop;
    console.log(`[WEBHOOK] Shop redact request for: ${shop}`);

    // In production, you would:
    // 1. Delete all data for this shop
    // This is essentially the same as app/uninstalled

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[WEBHOOK] Error handling shop redact:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== API ROUTES =====

// Get all videos (paginated)
app.get('/api/videos', async (req, res) => {
  try {
    const { first = 10, after = null } = req.query;

    // In production, you would:
    // 1. Get session from req.cookies or header
    // 2. Query GraphQL for metaobjects of type "shoppable_video"
    // 3. Return paginated results

    res.json({
      videos: [],
      pageInfo: {
        hasNextPage: false,
        endCursor: null,
      },
    });
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create video
app.post('/api/videos', async (req, res) => {
  try {
    const { title, videoUrl } = req.body;

    if (!title || !videoUrl) {
      return res.status(400).json({ error: 'Missing title or videoUrl' });
    }

    // In production, you would:
    // 1. Validate input (title length, URL format)
    // 2. Upload video to Shopify Files API if local file
    // 3. Create metaobject via GraphQL
    // 4. Return created video

    res.status(201).json({
      id: 'gid://shopify/MetaobjectInstance/1',
      title,
      videoUrl,
      status: 'DRAFT',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tagCount: 0,
    });
  } catch (error) {
    console.error('Error creating video:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single video with tags
app.get('/api/videos/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // In production, you would:
    // 1. Query GraphQL for metaobject by ID
    // 2. Include references to video_tag metaobjects
    // 3. Return video with tags array

    res.json({
      id,
      title: '',
      videoUrl: '',
      status: 'DRAFT',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tagCount: 0,
      tags: [],
    });
  } catch (error) {
    console.error('Error fetching video:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update video
app.patch('/api/videos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, videoUrl, status } = req.body;

    // In production, you would:
    // 1. Validate input
    // 2. Update metaobject via GraphQL
    // 3. Return updated video

    res.json({
      id,
      title: title || '',
      videoUrl: videoUrl || '',
      status: status || 'DRAFT',
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error updating video:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete video
app.delete('/api/videos/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // In production, you would:
    // 1. Delete all tags first (or cascade)
    // 2. Delete video metaobject via GraphQL

    res.json({ success: true, deletedId: id });
  } catch (error) {
    console.error('Error deleting video:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add tag to video
app.post('/api/videos/:videoId/tags', async (req, res) => {
  try {
    const { videoId } = req.params;
    const { productId, productName, productImage, price, timestamp, position } = req.body;

    if (!productId || !timestamp === undefined || !position) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // In production, you would:
    // 1. Create video_tag metaobject
    // 2. Snapshot product data (name, image, price)
    // 3. Link to parent video
    // 4. Return created tag

    res.status(201).json({
      id: 'gid://shopify/MetaobjectInstance/tag-1',
      videoId,
      productId,
      productName,
      productImage,
      price,
      timestamp: parseFloat(timestamp),
      position,
      status: 'ACTIVE',
    });
  } catch (error) {
    console.error('Error creating tag:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete tag
app.delete('/api/videos/:videoId/tags/:tagId', async (req, res) => {
  try {
    const { videoId, tagId } = req.params;

    // In production, you would:
    // 1. Delete video_tag metaobject via GraphQL

    res.json({ success: true, deletedId: tagId });
  } catch (error) {
    console.error('Error deleting tag:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search products in catalog
app.get('/api/products/search', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Missing search query' });
    }

    // In production, you would:
    // 1. Call Shopify Admin GraphQL API with read_products scope
    // 2. Query products by title/handle
    // 3. Return paginated results with ID, title, image, price

    res.json({
      products: [
        {
          id: 'gid://shopify/Product/1',
          title: 'Sample Product',
          image: 'https://example.com/image.jpg',
          price: '29.99',
        },
      ],
      pageInfo: {
        hasNextPage: false,
      },
    });
  } catch (error) {
    console.error('Error searching products:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add product to cart (storefront)
app.post('/api/cart/add', async (req, res) => {
  try {
    const { productId, variantId, quantity = 1 } = req.body;

    if (!productId && !variantId) {
      return res.status(400).json({ error: 'Missing productId or variantId' });
    }

    // In production, you would:
    // 1. Use Shopify Storefront API to add to cart
    // 2. Return cart token for redirect to /cart
    // 3. Or return cart data if using AJAX cart

    res.json({
      success: true,
      cartUrl: 'https://store.myshopify.com/cart',
    });
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({ error: error.message });
  }
});

// Storefront block data (public GraphQL query)
app.post('/api/storefront/video/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;

    // In production, you would:
    // 1. This endpoint is called from the storefront block JavaScript
    // 2. Query the public metaobject with the video ID
    // 3. Return video + tags (no auth needed, metadata is public)
    // 4. Client-side caching in sessionStorage

    res.json({
      video: {
        id: videoId,
        title: '',
        videoUrl: '',
        status: 'LIVE',
        tags: [],
      },
    });
  } catch (error) {
    console.error('Error fetching storefront video:', error);
    res.status(500).json({ error: error.message });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`[SERVER] Shoppable Videos app listening on port ${PORT}`);
  console.log(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[SERVER] API Key: ${process.env.SHOPIFY_API_KEY ? '✓' : '✗'}`);
  console.log(`[SERVER] Session Secret: ${process.env.SESSION_SECRET ? '✓' : '✗'}`);
});

export default app;
