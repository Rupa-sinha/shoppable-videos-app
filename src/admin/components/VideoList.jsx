import React, { useState, useEffect } from 'react';
import {
  Page,
  Layout,
  Card,
  Button,
  DataTable,
  Badge,
  Modal,
  TextField,
  FormLayout,
} from '@shopify/polaris';
import { PlusIcon } from '@shopify/polaris-icons';

export function VideoList() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newVideoTitle, setNewVideoTitle] = useState('');
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchVideos();
  }, []);

  async function fetchVideos() {
    try {
      setLoading(true);
      const response = await fetch('/api/videos');
      if (!response.ok) throw new Error('Failed to fetch videos');
      const data = await response.json();
      setVideos(data.videos || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateVideo() {
    if (!newVideoTitle.trim() || !newVideoUrl.trim()) {
      setError('Title and URL are required');
      return;
    }

    try {
      const response = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newVideoTitle,
          videoUrl: newVideoUrl,
        }),
      });

      if (!response.ok) throw new Error('Failed to create video');

      setNewVideoTitle('');
      setNewVideoUrl('');
      setShowModal(false);
      await fetchVideos();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteVideo(id) {
    if (!confirm('Delete this video? This cannot be undone.')) return;

    try {
      const response = await fetch(`/api/videos/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete video');
      await fetchVideos();
    } catch (err) {
      setError(err.message);
    }
  }

  const rows = videos.map((video) => [
    video.title || '(untitled)',
    video.tagCount || 0,
    video.status === 'LIVE' ? (
      <Badge status="success">Live</Badge>
    ) : (
      <Badge>Draft</Badge>
    ),
    new Date(video.createdAt).toLocaleDateString(),
    <Button
      plain
      onClick={() => {
        // Navigate to video editor
        window.location.href = `/admin/videos/${video.id}`;
      }}
    >
      Edit
    </Button>,
    <Button
      plain
      destructive
      onClick={() => handleDeleteVideo(video.id)}
    >
      Delete
    </Button>,
  ]);

  return (
    <Page
      title="Shoppable Videos"
      primaryAction={{
        content: 'Add video',
        icon: PlusIcon,
        onAction: () => setShowModal(true),
      }}
    >
      <Layout>
        <Layout.Section>
          {error && (
            <Card>
              <div style={{ color: '#c4345d', padding: '16px' }}>{error}</div>
            </Card>
          )}

          <Card>
            {loading ? (
              <div style={{ padding: '16px' }}>Loading videos...</div>
            ) : videos.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center' }}>
                No videos yet. Create your first one!
              </div>
            ) : (
              <DataTable
                columnContentTypes={['text', 'numeric', 'text', 'text', 'text', 'text']}
                headings={['Title', 'Products', 'Status', 'Created', 'Action', 'Action']}
                rows={rows}
              />
            )}
          </Card>
        </Layout.Section>
      </Layout>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Create Video"
        primaryAction={{
          content: 'Create',
          onAction: handleCreateVideo,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setShowModal(false),
          },
        ]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Title"
              value={newVideoTitle}
              onChange={setNewVideoTitle}
              placeholder="e.g., Spring Lookbook"
            />
            <TextField
              label="Video URL"
              value={newVideoUrl}
              onChange={setNewVideoUrl}
              placeholder="https://example.com/video.mp4"
              type="url"
            />
          </FormLayout>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
