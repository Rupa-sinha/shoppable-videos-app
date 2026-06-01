/**
 * Utility: GraphQL Helpers
 *
 * Functions for querying Shopify GraphQL API
 */

import { GraphQLClient } from 'graphql-request';

const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-01';

/**
 * Create an authenticated GraphQL client for a shop
 */
export function createGraphqlClient(shop, accessToken) {
  const endpoint = `https://${shop}/admin/api/${API_VERSION}/graphql.json`;

  return new GraphQLClient(endpoint, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create a public GraphQL client for storefront (no auth)
 */
export function createStorefrontClient(shop, storefrontAccessToken) {
  const endpoint = `https://${shop}/api/${API_VERSION}/graphql.json`;

  return new GraphQLClient(endpoint, {
    headers: {
      'X-Shopify-Storefront-Access-Token': storefrontAccessToken,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Retry logic with exponential backoff for rate limits
 */
export async function queryWithRetry(client, query, variables, maxRetries = 3) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await client.request(query, variables);
    } catch (error) {
      lastError = error;

      if (error.status === 429) {
        // Rate limited: exponential backoff
        const delay = Math.pow(2, i) * 1000;
        console.log(`[GraphQL] Rate limited. Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        // Not a rate limit error, throw immediately
        throw error;
      }
    }
  }

  throw lastError;
}
