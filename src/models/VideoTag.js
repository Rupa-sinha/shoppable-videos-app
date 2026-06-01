/**
 * VideoTag Metaobject Model
 *
 * Represents a product tag on a shoppable video.
 * Stored as a separate metaobject for scalability and individual mutations.
 *
 * @typedef {Object} VideoTag
 * @property {string} id - Metaobject instance ID
 * @property {string} videoId - Parent video ID (reference)
 * @property {string} productId - Shopify Product gid
 * @property {string} productName - Product name (snapshot)
 * @property {string} productImage - Product image URL (snapshot)
 * @property {string} price - Product price (snapshot)
 * @property {number} timestamp - Video position in seconds
 * @property {string} position - Hotspot position (enum)
 * @property {string} status - 'ACTIVE' or 'ORPHANED'
 */

const CREATE_TAG_MUTATION = `
  mutation CreateVideoTag($input: MetaobjectCreateInput!) {
    metaobjectCreate(input: $input) {
      metaobject {
        id
        type
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

const UPDATE_TAG_MUTATION = `
  mutation UpdateVideoTag($id: ID!, $input: MetaobjectUpdateInput!) {
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

const DELETE_TAG_MUTATION = `
  mutation DeleteVideoTag($id: ID!) {
    metaobjectDelete(id: $id) {
      deletedId
      userErrors {
        field
        message
      }
    }
  }
`;

const GET_TAG_BY_PRODUCT_ID_QUERY = `
  query GetTagsByProductId($productId: String!) {
    metaobjects(type: "video_tag", query: "product_id: $productId", first: 100) {
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

export class VideoTag {
  /**
   * Create a new video tag
   * @param {import('graphql-request').GraphQLClient} graphqlClient
   * @param {Object} data - { videoId, productId, productName, productImage, price, timestamp, position }
   */
  static async create(graphqlClient, data) {
    const input = {
      type: 'video_tag',
      fields: [
        { key: 'video_id', value: data.videoId },
        { key: 'product_id', value: data.productId },
        { key: 'product_name', value: data.productName },
        { key: 'product_image', value: data.productImage },
        { key: 'price', value: data.price },
        { key: 'timestamp', value: String(data.timestamp) },
        { key: 'position', value: data.position },
        { key: 'status', value: 'ACTIVE' },
      ],
    };

    const result = await graphqlClient.request(CREATE_TAG_MUTATION, { input });

    if (result.metaobjectCreate.userErrors.length > 0) {
      throw new Error(
        `Failed to create tag: ${result.metaobjectCreate.userErrors[0].message}`
      );
    }

    return this.fromGraphQL(result.metaobjectCreate.metaobject);
  }

  /**
   * Update a video tag
   */
  static async update(graphqlClient, id, data) {
    const fields = [];
    if (data.timestamp !== undefined) {
      fields.push({ key: 'timestamp', value: String(data.timestamp) });
    }
    if (data.position !== undefined) {
      fields.push({ key: 'position', value: data.position });
    }
    if (data.status !== undefined) {
      fields.push({ key: 'status', value: data.status });
    }

    const input = { fields };

    const result = await graphqlClient.request(UPDATE_TAG_MUTATION, { id, input });

    if (result.metaobjectUpdate.userErrors.length > 0) {
      throw new Error(
        `Failed to update tag: ${result.metaobjectUpdate.userErrors[0].message}`
      );
    }

    return this.fromGraphQL(result.metaobjectUpdate.metaobject);
  }

  /**
   * Delete a video tag
   */
  static async delete(graphqlClient, id) {
    const result = await graphqlClient.request(DELETE_TAG_MUTATION, { id });

    if (result.metaobjectDelete.userErrors.length > 0) {
      throw new Error(
        `Failed to delete tag: ${result.metaobjectDelete.userErrors[0].message}`
      );
    }

    return result.metaobjectDelete.deletedId;
  }

  /**
   * Find all tags referencing a product
   */
  static async findByProductId(graphqlClient, productId) {
    const result = await graphqlClient.request(GET_TAG_BY_PRODUCT_ID_QUERY, {
      productId,
    });

    return result.metaobjects.nodes.map((node) => this.fromGraphQL(node));
  }

  /**
   * Convert GraphQL response to VideoTag object
   */
  static fromGraphQL(node) {
    const fieldsMap = {};
    (node.fields || []).forEach((field) => {
      fieldsMap[field.key] = field.value;
    });

    return {
      id: node.id,
      type: node.type,
      videoId: fieldsMap.video_id || '',
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
