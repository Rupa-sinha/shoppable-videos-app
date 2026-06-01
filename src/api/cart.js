/**
 * API: Cart endpoints
 *
 * Handles adding products to Shopify cart
 */

import express from 'express';

const router = express.Router();

const ADD_TO_CART_MUTATION = `
  mutation AddToCart($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart {
        id
        lines(first: 10) {
          nodes {
            id
            quantity
            merchandise {
              ... on ProductVariant {
                id
                title
                price {
                  amount
                }
              }
            }
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const CREATE_CART_MUTATION = `
  mutation CreateCart($lines: [CartLineInput!]) {
    cartCreate(input: { lines: $lines }) {
      cart {
        id
        checkoutUrl
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * POST /api/cart/add
 * Add product to cart (client calls Storefront API directly)
 */
router.post('/add', async (req, res) => {
  try {
    const { productId, variantId, quantity = 1 } = req.body;

    if (!variantId && !productId) {
      return res.status(400).json({ error: 'Missing variantId or productId' });
    }

    if (quantity < 1 || !Number.isInteger(quantity)) {
      return res.status(400).json({ error: 'Invalid quantity' });
    }

    // In production, client-side JavaScript calls Shopify Storefront API directly
    // This endpoint is a fallback or proxy if needed
    // For now, return instructions

    res.json({
      message: 'Client should call Shopify Storefront API directly',
      cartAction: 'add',
      variantId,
      quantity,
    });
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
