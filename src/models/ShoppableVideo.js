// sv-ckpt: data-model entry point

/**
 * ShoppableVideo Metaobject Model
 *
 * Represents a shoppable video entity with tagging support.
 * Stored in Shopify metaobjects; one per video per shop.
 *
 * @typedef {Object} ShoppableVideo
 * @property {string} id - Metaobject instance ID
 * @property {string} title - Video title
 * @property {string} videoUrl - URL to video (Shopify Files API or external)
 * @property {string} status - 'DRAFT' or 'LIVE'
 * @property {string} createdAt - ISO datetime
 * @property {string} updatedAt - ISO datetime
 * @property {VideoTag[]} tags - Array of VideoTag references
 */

const CREATE_VIDEO_MUTATION = `
  mutation CreateShoppableVideo($input: MetaobjectCreateInput!) {
    metaobjectCreate(input: $input) {
      metaobject {
        id
        type
        displayName
        fields {
          key
          value
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const UPDATE_VIDEO_MUTATION = `
  mutation UpdateShoppableVideo($id: ID!, $input: MetaobjectUpdateInput!) {
    metaobjectUpdate(id: $id, input: $input) {
      metaobject {
        id
        fields {
          key
          value
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const DELETE_VIDEO_MUTATION = `
  mutation DeleteShoppableVideo($id: ID!) {
    metaobjectDelete(id: $id) {
      deletedId
      userErrors {
        field
        message
      }
    }
  }
`;

const GET_VIDEO_QUERY = `
  query GetShoppableVideo($id: ID!) {
    metaobject(id: $id) {
      id
      type
      displayName
      fields {
        key
        value
      }
      references(first: 100, type: "video_tag") {
        nodes {
          id
          type
          fields {
            key
            value
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

const LIST_VIDEOS_QUERY = `
  query ListShoppableVideos($first: Int!, $after: String) {
    metaobjects(type: "shoppable_video", first: $first, after: $after) {
      nodes {
        id
        type
        displayName
        fields {
          key
          value
        }
        references(first: 100, type: "video_tag") {
          nodes {
            id
          }
          totalCount
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export class ShoppableVideo {
  /**
   * Create a new shoppable video
   * @param {import('graphql-request').GraphQLClient} graphqlClient
   * @param {Object} data - { title, videoUrl, status }
   */
  static async create(graphqlClient, data) {
    const input = {
      type: 'shoppable_video',
      fields: [
        { key: 'title', value: data.title },
        { key: 'video_url', value: data.videoUrl },
        { key: 'status', value: data.status || 'DRAFT' },
        { key: 'created_at', value: new Date().toISOString() },
        { key: 'updated_at', value: new Date().toISOString() },
      ],
    };

    const result = await graphqlClient.request(CREATE_VIDEO_MUTATION, { input });

    if (result.metaobjectCreate.userErrors.length > 0) {
      throw new Error(
        `Failed to create video: ${result.metaobjectCreate.userErrors[0].message}`
      );
    }

    return this.fromGraphQL(result.metaobjectCreate.metaobject);
  }

  /**
   * Get a single video by ID
   */
  static async getById(graphqlClient, id) {
    const result = await graphqlClient.request(GET_VIDEO_QUERY, { id });

    if (!result.metaobject) {
      return null;
    }

    return this.fromGraphQL(result.metaobject);
  }

  /**
   * List all videos (paginated)
   */
  static async list(graphqlClient, first = 10, after = null) {
    const result = await graphqlClient.request(LIST_VIDEOS_QUERY, { first, after });

    return {
      videos: result.metaobjects.nodes.map((node) => this.fromGraphQL(node)),
      pageInfo: result.metaobjects.pageInfo,
    };
  }

  /**
   * Update a video
   */
  static async update(graphqlClient, id, data) {
    const fields = [];
    if (data.title !== undefined) {
      fields.push({ key: 'title', value: data.title });
    }
    if (data.videoUrl !== undefined) {
      fields.push({ key: 'video_url', value: data.videoUrl });
    }
    if (data.status !== undefined) {
      fields.push({ key: 'status', value: data.status });
    }
    fields.push({ key: 'updated_at', value: new Date().toISOString() });

    const input = { fields };

    const result = await graphqlClient.request(UPDATE_VIDEO_MUTATION, { id, input });

    if (result.metaobjectUpdate.userErrors.length > 0) {
      throw new Error(
        `Failed to update video: ${result.metaobjectUpdate.userErrors[0].message}`
      );
    }

    return this.fromGraphQL(result.metaobjectUpdate.metaobject);
  }

  /**
   * Delete a video
   */
  static async delete(graphqlClient, id) {
    const result = await graphqlClient.request(DELETE_VIDEO_MUTATION, { id });

    if (result.metaobjectDelete.userErrors.length > 0) {
      throw new Error(
        `Failed to delete video: ${result.metaobjectDelete.userErrors[0].message}`
      );
    }

    return result.metaobjectDelete.deletedId;
  }

  /**
   * Convert GraphQL response to ShoppableVideo object
   */
  static fromGraphQL(node) {
    const fieldsMap = {};
    (node.fields || []).forEach((field) => {
      fieldsMap[field.key] = field.value;
    });

    const tagCount = node.references?.totalCount || 0;

    return {
      id: node.id,
      type: node.type,
      title: fieldsMap.title || '',
      videoUrl: fieldsMap.video_url || '',
      status: fieldsMap.status || 'DRAFT',
      createdAt: fieldsMap.created_at || new Date().toISOString(),
      updatedAt: fieldsMap.updated_at || new Date().toISOString(),
      tagCount,
      tags: (node.references?.nodes || []).map((tag) => ({
        id: tag.id,
        type: tag.type,
        ...this.extractTagFields(tag.fields),
      })),
    };
  }

  /**
   * Extract tag fields from GraphQL response
   */
  static extractTagFields(fields) {
    const fieldsMap = {};
    (fields || []).forEach((field) => {
      fieldsMap[field.key] = field.value;
    });

    return {
      productId: fieldsMap.product_id || '',
      productName: fieldsMap.product_name || '',
      productImage: fieldsMap.product_image || '',
      price: fieldsMap.price || '',
      timestamp: parseFloat(fieldsMap.timestamp) || 0,
      position: fieldsMap.position || 'center',
      status: fieldsMap.status || 'ACTIVE',
    };
  }
}
