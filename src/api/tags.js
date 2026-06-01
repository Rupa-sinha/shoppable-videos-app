/**
 * API: Tags endpoints
 *
 * Handles video tag CRUD operations
 */

import express from 'express';
import { VideoTag } from '../models/VideoTag.js';

const router = express.Router();

/**
 * POST /api/videos/:videoId/tags
 * Add a tag to a video
 */
router.post('/:videoId/tags', async (req, res) => {
  try {
    const { videoId } = req.params;
    const { productId, productName, productImage, price, timestamp, position } = req.body;
    const graphqlClient = req.graphqlClient;

    if (!productId || timestamp === undefined || !position) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['top-left', 'top-center', 'top-right', 'center-left', 'center', 'center-right', 'bottom-left', 'bottom-center', 'bottom-right'].includes(position)) {
      return res.status(400).json({ error: 'Invalid position' });
    }

    const timestampNum = parseFloat(timestamp);
    if (isNaN(timestampNum) || timestampNum < 0) {
      return res.status(400).json({ error: 'Invalid timestamp' });
    }

    const tag = await VideoTag.create(graphqlClient, {
      videoId,
      productId,
      productName: productName || 'Product',
      productImage: productImage || '',
      price: price || '0.00',
      timestamp: timestampNum,
      position,
    });

    res.status(201).json(tag);
  } catch (error) {
    console.error('Error creating tag:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/videos/:videoId/tags/:tagId
 * Update a tag (position/timestamp)
 */
router.patch('/:videoId/tags/:tagId', async (req, res) => {
  try {
    const { videoId, tagId } = req.params;
    const { timestamp, position } = req.body;
    const graphqlClient = req.graphqlClient;

    const data = {};
    if (timestamp !== undefined) {
      const ts = parseFloat(timestamp);
      if (isNaN(ts) || ts < 0) {
        return res.status(400).json({ error: 'Invalid timestamp' });
      }
      data.timestamp = ts;
    }
    if (position !== undefined) {
      if (!['top-left', 'top-center', 'top-right', 'center-left', 'center', 'center-right', 'bottom-left', 'bottom-center', 'bottom-right'].includes(position)) {
        return res.status(400).json({ error: 'Invalid position' });
      }
      data.position = position;
    }

    const tag = await VideoTag.update(graphqlClient, tagId, data);

    res.json(tag);
  } catch (error) {
    console.error('Error updating tag:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/videos/:videoId/tags/:tagId
 * Delete a tag
 */
router.delete('/:videoId/tags/:tagId', async (req, res) => {
  try {
    const { videoId, tagId } = req.params;
    const graphqlClient = req.graphqlClient;

    const deletedId = await VideoTag.delete(graphqlClient, tagId);

    res.json({ success: true, deletedId });
  } catch (error) {
    console.error('Error deleting tag:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
