import React, { useState, useEffect } from 'react';
import {
  Page,
  Layout,
  Card,
  Button,
  TextField,
  FormLayout,
  Tag,
  ResourceList,
  ResourceItem,
  Badge,
  SkeletonBodyText,
  Select,
} from '@shopify/polaris';
import { DeleteIcon } from '@shopify/polaris-icons';

const POSITIONS = [
  { label: 'Top Left', value: 'top-left' },
  { label: 'Top Center', value: 'top-center' },
  { label: 'Top Right', value: 'top-right' },
  { label: 'Center Left', value: 'center-left' },
  { label: 'Center', value: 'center' },
  { label: 'Center Right', value: 'center-right' },
  { label: 'Bottom Left', value: 'bottom-left' },
  { label: 'Bottom Center', value: 'bottom-center' },
  { label: 'Bottom Right', value: 'bottom-right' },
];

export function VideoEditor({ videoId }) {
  const [video, setVideo] = useState(null);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('DRAFT');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [tags, setTags] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [tagTimestamp, setTagTimestamp] = useState('0');
  const [tagPosition, setTagPosition] = useState('center');

  useEffect(() => {
    fetchVideo();
  }, [videoId]);

  async function fetchVideo() {
    try {
      const response = await fetch(`/api/videos/${videoId}`);
      if (!response.ok) throw new Error('Failed to load video');
      const data = await response.json();
      setVideo(data);
      setTitle(data.title);
      setStatus(data.status);
      setTags(data.tags || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;

    try {
      setSearching(true);
      const response = await fetch(`/api/products/search?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error('Failed to search');
      const data = await response.json();
      setProducts(data.products || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  }

  async function handleAddTag() {
    if (!selectedProduct) {
      setError('Please select a product');
      return;
    }

    try {
      const response = await fetch(`/api/videos/${videoId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct.id,
          productName: selectedProduct.title,
          productImage: selectedProduct.image,
          price: selectedProduct.price,
          timestamp: parseFloat(tagTimestamp),
          position: tagPosition,
        }),
      });

      if (!response.ok) throw new Error('Failed to add tag');

      setSelectedProduct(null);
      setTagTimestamp('0');
      setTagPosition('center');
      setShowProductSearch(false);
      await fetchVideo();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemoveTag(tagId) {
    if (!confirm('Remove this tag?')) return;

    try {
      const response = await fetch(`/api/videos/${videoId}/tags/${tagId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to remove tag');
      await fetchVideo();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      const response = await fetch(`/api/videos/${videoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, status }),
      });

      if (!response.ok) throw new Error('Failed to save');
      setError(null);
      // Show success message
      alert('Video saved!');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Page title="Loading...">
        <Layout>
          <Layout.Section>
            <Card>
              <SkeletonBodyText />
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  if (!video) {
    return (
      <Page title="Video not found">
        <Layout>
          <Layout.Section>
            <Card>
              <div style={{ padding: '16px' }}>This video could not be found.</div>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page title={title || 'New Video'}>
      <Layout>
        <Layout.Section oneThird>
          <Card>
            <div style={{ padding: '16px' }}>
              <div
                style={{
                  width: '100%',
                  aspectRatio: '9/16',
                  backgroundColor: '#f0f1f4',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px',
                  color: '#6b7280',
                  fontSize: '14px',
                }}
              >
                Video preview
              </div>
              <Button fullWidth variant="secondary">
                Replace video
              </Button>
            </div>
          </Card>
        </Layout.Section>

        <Layout.Section oneThird>
          <Card>
            <div style={{ padding: '16px' }}>
              <FormLayout>
                <TextField
                  label="Title"
                  value={title}
                  onChange={setTitle}
                  placeholder="Video title"
                />

                <Select
                  label="Status"
                  options={[
                    { label: 'Draft', value: 'DRAFT' },
                    { label: 'Live', value: 'LIVE' },
                  ]}
                  value={status}
                  onChange={setStatus}
                />

                <div style={{ marginTop: '16px' }}>
                  <Button
                    fullWidth
                    primary
                    onClick={handleSave}
                    loading={saving}
                  >
                    Save
                  </Button>
                </div>

                {error && (
                  <div style={{ color: '#c4345d', marginTop: '8px' }}>
                    {error}
                  </div>
                )}
              </FormLayout>
            </div>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card title="Tagged Products">
            <div style={{ padding: '16px' }}>
              <Button
                fullWidth
                onClick={() => setShowProductSearch(true)}
              >
                + Add product
              </Button>

              {showProductSearch && (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
                  <TextField
                    label="Search catalog"
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Product name..."
                  />

                  <Button
                    onClick={handleSearch}
                    loading={searching}
                    fullWidth
                    style={{ marginTop: '8px' }}
                  >
                    Search
                  </Button>

                  {products.length > 0 && (
                    <div style={{ marginTop: '16px' }}>
                      <h3 style={{ fontSize: '14px', marginBottom: '8px' }}>Results:</h3>
                      <ResourceList
                        items={products}
                        renderItem={(product) => (
                          <ResourceItem
                            key={product.id}
                            onClick={() => setSelectedProduct(product)}
                            selected={selectedProduct?.id === product.id}
                          >
                            <h3>{product.title}</h3>
                            <p>{product.price}</p>
                          </ResourceItem>
                        )}
                      />

                      {selectedProduct && (
                        <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f3f4f6', borderRadius: '6px' }}>
                          <h4>{selectedProduct.title}</h4>

                          <TextField
                            label="Timestamp (seconds)"
                            value={tagTimestamp}
                            onChange={setTagTimestamp}
                            type="number"
                            min="0"
                            step="0.1"
                            style={{ marginTop: '8px' }}
                          />

                          <Select
                            label="Position"
                            options={POSITIONS}
                            value={tagPosition}
                            onChange={setTagPosition}
                            style={{ marginTop: '8px' }}
                          />

                          <Button
                            fullWidth
                            primary
                            onClick={handleAddTag}
                            style={{ marginTop: '12px' }}
                          >
                            Add to video
                          </Button>

                          <Button
                            fullWidth
                            onClick={() => setShowProductSearch(false)}
                            style={{ marginTop: '8px' }}
                          >
                            Done
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {tags.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <h3 style={{ fontSize: '14px', marginBottom: '8px' }}>Current tags:</h3>
                  {tags.map((tag) => (
                    <div
                      key={tag.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px',
                        backgroundColor: '#f3f4f6',
                        borderRadius: '6px',
                        marginBottom: '8px',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '14px' }}>
                          {tag.productName}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                          @ {tag.timestamp}s · {tag.position}
                        </div>
                      </div>
                      <Button
                        icon={DeleteIcon}
                        plain
                        onClick={() => handleRemoveTag(tag.id)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
