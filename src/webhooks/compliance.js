/**
 * Webhook Handler: GDPR Compliance
 *
 * Handles customer/shop data requests and redactions
 */

export async function handleCustomersDataRequest(shop, customerId) {
  try {
    console.log(`[WEBHOOK] Data request for customer: ${customerId} from shop: ${shop}`);

    // Shoppable Videos app does not store customer PII
    // Only product snapshots and video metadata (not tied to customers)
    // Return empty data set

    const data = {
      shop,
      customer_id: customerId,
      orders: [],
      customers: [],
      dataDownloads: [],
    };

    console.log(`[WEBHOOK] Data request completed for customer: ${customerId}`);

    return data;
  } catch (error) {
    console.error('[WEBHOOK] Error in handleCustomersDataRequest:', error);
    throw error;
  }
}

export async function handleCustomersRedact(shop, customerId) {
  try {
    console.log(`[WEBHOOK] Redact request for customer: ${customerId} from shop: ${shop}`);

    // Shoppable Videos app does not store customer data
    // No action needed

    console.log(`[WEBHOOK] Redact completed for customer: ${customerId}`);

    return true;
  } catch (error) {
    console.error('[WEBHOOK] Error in handleCustomersRedact:', error);
    throw error;
  }
}

export async function handleShopRedact(shop, graphqlClient) {
  try {
    console.log(`[WEBHOOK] Shop redact request for: ${shop}`);

    // Delete all data for this shop (same as app/uninstalled)
    const DELETE_VIDEOS_QUERY = `
      query GetAllVideos {
        metaobjects(type: "shoppable_video", first: 250) {
          nodes {
            id
          }
        }
      }
    `;

    const result = await graphqlClient.request(DELETE_VIDEOS_QUERY);
    const videoIds = result.metaobjects.nodes.map((v) => v.id);

    for (const videoId of videoIds) {
      const DELETE_MUTATION = `
        mutation DeleteVideo($id: ID!) {
          metaobjectDelete(id: $id) {
            deletedId
          }
        }
      `;

      await graphqlClient.request(DELETE_MUTATION, { id: videoId });
    }

    console.log(`[WEBHOOK] Shop redact completed for: ${shop}`);

    return true;
  } catch (error) {
    console.error('[WEBHOOK] Error in handleShopRedact:', error);
    throw error;
  }
}
