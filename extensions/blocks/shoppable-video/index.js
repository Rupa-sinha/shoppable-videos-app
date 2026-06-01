/**
 * Shoppable Video Player - Storefront Block JavaScript
 *
 * Renders interactive video player with hotspots and product cards.
 * Queries Shopify GraphQL API for video/tag data (no auth needed).
 */

const CACHE_KEY_PREFIX = 'sv_video_';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const STOREFRONT_QUERY = `
  query GetShoppableVideo($videoId: ID!) {
    metaobjectInstance(id: $videoId) {
      id
      title: field(key: "title") { value }
      videoUrl: field(key: "video_url") { value }
      status: field(key: "status") { value }
      tags: references(first: 100, type: "video_tag") {
        nodes {
          id
          productId: field(key: "product_id") { value }
          productName: field(key: "product_name") { value }
          productImage: field(key: "product_image") { value }
          price: field(key: "price") { value }
          timestamp: field(key: "timestamp") { value }
          position: field(key: "position") { value }
          status: field(key: "status") { value }
        }
      }
    }
  }
`;

class ShoppableVideoPlayer {
  constructor(container) {
    this.container = container;
    this.videoId = container.getAttribute('data-video-id');
    this.video = null;
    this.tags = [];
    this.currentTagIndex = 0;

    if (!this.videoId) {
      this.renderError('No video selected');
      return;
    }

    this.init();
  }

  async init() {
    try {
      // Try to load from cache
      const cached = this.loadFromCache();
      if (cached) {
        this.video = cached;
      } else {
        // Fetch from GraphQL
        this.video = await this.fetchVideo();
        this.saveToCache(this.video);
      }

      if (!this.video) {
        this.renderError('Video not found');
        return;
      }

      this.tags = this.video.tags || [];
      this.render();
    } catch (error) {
      console.error('[ShoppableVideo] Error initializing:', error);
      this.renderError('Failed to load video');
    }
  }

  loadFromCache() {
    const cacheKey = CACHE_KEY_PREFIX + this.videoId;
    const cached = sessionStorage.getItem(cacheKey);

    if (!cached) return null;

    try {
      const data = JSON.parse(cached);
      const age = Date.now() - data.timestamp;

      if (age > CACHE_TTL) {
        sessionStorage.removeItem(cacheKey);
        return null;
      }

      return data.video;
    } catch (e) {
      return null;
    }
  }

  saveToCache(video) {
    const cacheKey = CACHE_KEY_PREFIX + this.videoId;
    sessionStorage.setItem(
      cacheKey,
      JSON.stringify({
        video,
        timestamp: Date.now(),
      })
    );
  }

  async fetchVideo() {
    const response = await fetch(`${window.Shopify.routes.root}graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: STOREFRONT_QUERY,
        variables: {
          videoId: this.videoId,
        },
      }),
    });

    const data = await response.json();

    if (data.errors) {
      console.error('[ShoppableVideo] GraphQL error:', data.errors);
      throw new Error(data.errors[0]?.message || 'GraphQL error');
    }

    return data.data?.metaobjectInstance;
  }

  render() {
    this.container.innerHTML = '';

    if (!this.video || this.video.status !== 'LIVE') {
      this.renderError('Video is not live');
      return;
    }

    const playerDiv = document.createElement('div');
    playerDiv.className = 'sv-player';

    // Video element
    const video = document.createElement('video');
    video.className = 'sv-video';
    video.src = this.video.videoUrl;
    video.controls = true;
    video.playsInline = true;
    playerDiv.appendChild(video);

    // Hotspots
    const activeTags = this.tags.filter((t) => t.status !== 'ORPHANED');

    for (const tag of activeTags) {
      const hotspot = document.createElement('div');
      hotspot.className = 'sv-hotspot';
      hotspot.setAttribute('data-tag-id', tag.id);
      hotspot.setAttribute('data-timestamp', tag.timestamp);

      // Position: convert 'top-left' -> { top: '10%', left: '10%' }
      const [vPos, hPos] = tag.position.split('-');
      const posMap = {
        top: '10%',
        center: '50%',
        bottom: '90%',
      };
      const hPosMap = {
        left: '10%',
        center: '50%',
        right: '90%',
      };

      hotspot.style.top = posMap[vPos] || '50%';
      hotspot.style.left = hPosMap[hPos] || '50%';
      hotspot.style.transform = 'translate(-50%, -50%)';

      hotspot.addEventListener('click', () => this.selectTag(tag.id));
      playerDiv.appendChild(hotspot);
    }

    // Product card
    if (activeTags.length > 0) {
      this.currentTagIndex = 0;
      const card = this.renderProductCard(activeTags[0]);
      playerDiv.appendChild(card);

      // Sync hotspot clicks
      const hotspots = playerDiv.querySelectorAll('.sv-hotspot');
      hotspots.forEach((hotspot, index) => {
        hotspot.addEventListener('click', () => {
          this.currentTagIndex = index;
          const newCard = this.renderProductCard(activeTags[index]);
          const oldCard = playerDiv.querySelector('.sv-product-card');
          if (oldCard) oldCard.replaceWith(newCard);
        });
      });
    }

    this.container.appendChild(playerDiv);
  }

  renderProductCard(tag) {
    const card = document.createElement('div');
    card.className = 'sv-product-card';

    if (tag.status === 'ORPHANED') {
      card.innerHTML = `
        <div style="padding: 12px; text-align: center;">
          <p class="sv-unavailable">This product is no longer available</p>
        </div>
      `;
      return card;
    }

    const img = document.createElement('div');
    img.className = 'sv-product-image';
    if (tag.productImage) {
      img.style.backgroundImage = `url(${tag.productImage})`;
      img.style.backgroundSize = 'cover';
      img.style.backgroundPosition = 'center';
    }

    const meta = document.createElement('div');
    meta.className = 'sv-product-meta';
    meta.innerHTML = `
      <h3 class="sv-product-title">${escapeHtml(tag.productName)}</h3>
      <p class="sv-product-price">\$${escapeHtml(tag.price)}</p>
    `;

    const btn = document.createElement('button');
    btn.className = 'sv-add-to-cart';
    btn.textContent = 'Add to cart';
    btn.addEventListener('click', () => this.addToCart(tag));

    card.appendChild(img);
    card.appendChild(meta);
    card.appendChild(btn);

    return card;
  }

  selectTag(tagId) {
    const index = this.tags.findIndex((t) => t.id === tagId);
    if (index >= 0) {
      this.currentTagIndex = index;
    }
  }

  async addToCart(tag) {
    try {
      // Use Shopify Storefront Cart API
      const cartResponse = await fetch(`${window.Shopify.routes.root}cart/add.js`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: [
            {
              id: tag.productId,
              quantity: 1,
            },
          ],
        }),
      });

      if (cartResponse.ok) {
        // Redirect to cart
        window.location.href = `${window.Shopify.routes.root}cart`;
      } else {
        alert('Failed to add to cart. Please try again.');
      }
    } catch (error) {
      console.error('[ShoppableVideo] Error adding to cart:', error);
      alert('Error adding to cart');
    }
  }

  renderError(message) {
    const div = document.createElement('div');
    div.className = 'sv-loading';
    div.textContent = message;
    this.container.appendChild(div);
  }
}

// Initialize player when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const containers = document.querySelectorAll('.shoppable-video-root');
    containers.forEach((container) => new ShoppableVideoPlayer(container));
  });
} else {
  const containers = document.querySelectorAll('.shoppable-video-root');
  containers.forEach((container) => new ShoppableVideoPlayer(container));
}

// Utility: escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
