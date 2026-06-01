/**
 * API: Products endpoints
 *
 * Handles product search from Shopify catalog
 */

import express from 'express';

const router = express.Router();

const SEARCH_PRODUCTS_QUERY = `
  query SearchProducts($query: String!, $first: Int!) {
    products(first: $first, query: $query) {
      nodes {
        id
        title
        handle
        featuredImage {
          url
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
        variants(first: 1) {
          nodes {
            id
            price
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

/**
 * GET /api/products/search
 * Search products in Shopify catalog
 */
router.get('/search', async (req, res) => {
  try {
    const { q, first = 10 } = req.query;
    const graphqlClient = req.graphqlClient;

    if (!q) {
      return res.status(400).json({ error: 'Missing search query' });
    }

    if (q.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const result = await graphqlClient.request(SEARCH_PRODUCTS_QUERY, {
      query: q,
      first: Math.min(parseInt(first), 50), // Cap at 50
    });

    const products = result.products.nodes.map((product) => ({
      id: product.id,
      title: product.title,
      handle: product.handle,
      image: product.featuredImage?.url || '',
      price: product.variants.nodes[0]?.price || '0.00',
    }));

    res.json({
      products,
      pageInfo: result.products.pageInfo,
    });
  } catch (error) {
    console.error('Error searching products:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
