/**
 * Webhook Handler: App Uninstalled
 *
 * Cleans up shop data when app is uninstalled
 */

export async function handleAppUninstalled(shop, graphqlClient) {
  try {
    console.log(`[WEBHOOK] App uninstalled from shop: ${shop}`);

    // Delete all videos for this shop
    // Note: Shopify automatically cascades deletes to related metaobjects
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

    // Delete each video (which cascades to tags)
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

    console.log(`[WEBHOOK] Deleted ${videoIds.length} videos for shop: ${shop}`);

    return true;
  } catch (error) {
    console.error('[WEBHOOK] Error in handleAppUninstalled:', error);
    throw error;
  }
}
