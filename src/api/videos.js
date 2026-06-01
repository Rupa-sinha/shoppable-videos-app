/**
 * API: Videos endpoints
 *
 * Handles video CRUD operations
 */

import express from 'express';
import { ShoppableVideo } from '../models/ShoppableVideo.js';

const router = express.Router();

/**
 * GET /api/videos
 * List all videos for the current shop (paginated)
 */
router.get('/', async (req, res) => {
  try {
    const { first = 10, after } = req.query;
    const graphqlClient = req.graphqlClient;

    const result = await ShoppableVideo.list(graphqlClient, parseInt(first), after);

    res.json(result);
  } catch (error) {
    console.error('Error listing videos:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/videos
 * Create a new video
 */
router.post('/', async (req, res) => {
  try {
    const { title, videoUrl } = req.body;
    const graphqlClient = req.graphqlClient;

    if (!title || !videoUrl) {
      return res.status(400).json({ error: 'Missing title or videoUrl' });
    }

    if (title.length > 255) {
      return res.status(400).json({ error: 'Title must be less than 255 characters' });
    }

    // Validate URL format
    try {
      new URL(videoUrl);
    } catch {
      return res.status(400).json({ error: 'Invalid video URL' });
    }

    const video = await ShoppableVideo.create(graphqlClient, {
      title,
      videoUrl,
      status: 'DRAFT',
    });

    res.status(201).json(video);
  } catch (error) {
    console.error('Error creating video:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/videos/:id
 * Get a single video with its tags
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const graphqlClient = req.graphqlClient;

    const video = await ShoppableVideo.getById(graphqlClient, id);

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    res.json(video);
  } catch (error) {
    console.error('Error fetching video:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/videos/:id
 * Update a video
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, videoUrl, status } = req.body;
    const graphqlClient = req.graphqlClient;

    const data = {};
    if (title !== undefined) data.title = title;
    if (videoUrl !== undefined) data.videoUrl = videoUrl;
    if (status !== undefined) {
      if (!['DRAFT', 'LIVE'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be DRAFT or LIVE' });
      }
      data.status = status;
    }

    const video = await ShoppableVideo.update(graphqlClient, id, data);

    res.json(video);
  } catch (error) {
    console.error('Error updating video:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/videos/:id
 * Delete a video (cascades to tags)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const graphqlClient = req.graphqlClient;

    // Note: In production, also delete all associated tags
    const deletedId = await ShoppableVideo.delete(graphqlClient, id);

    res.json({ success: true, deletedId });
  } catch (error) {
    console.error('Error deleting video:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
