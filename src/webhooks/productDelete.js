/**
 * Webhook Handler: Product Deleted
 *
 * Marks video tags as orphaned when a tagged product is deleted
 */

export async function handleProductDelete(productId, shop, graphqlClient) {
  try {
    console.log(`[WEBHOOK] Product deleted: ${productId} from shop: ${shop}`);

    // Find all tags referencing this product
    const FIND_TAGS_QUERY = `
      query FindTagsByProduct($productId: String!) {
        metaobjects(type: "video_tag", query: "product_id:${productId}", first: 250) {
          nodes {
            id
            fields {
              key
              value
            }
          }
        }
      }
    `;

    const result = await graphqlClient.request(FIND_TAGS_QUERY, { productId });
    const tags = result.metaobjects.nodes;

    // Mark each as ORPHANED
    for (const tag of tags) {
      const UPDATE_MUTATION = `
        mutation MarkOrphaned($id: ID!) {
          metaobjectUpdate(id: $id, input: { fields: [{ key: "status", value: "ORPHANED" }] }) {
            metaobject {
              id
            }
            userErrors {
              message
            }
          }
        }
      `;

      await graphqlClient.request(UPDATE_MUTATION, { id: tag.id });
    }

    console.log(`[WEBHOOK] Marked ${tags.length} tags as orphaned for product: ${productId}`);

    return true;
  } catch (error) {
    console.error('[WEBHOOK] Error in handleProductDelete:', error);
    throw error;
  }
}
