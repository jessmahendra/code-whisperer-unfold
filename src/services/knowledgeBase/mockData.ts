
import { KnowledgeEntry } from './types';

// Mock knowledge base entries for demo purposes
export const mockKnowledgeEntries: KnowledgeEntry[] = [
  {
    id: 'mock-1',
    type: 'comment',
    content: '/** Processes subscription payments through Stripe integration */',
    filePath: 'ghost/core/core/server/services/members/payment.js',
    keywords: ['subscription', 'payment', 'process', 'stripe', 'members'],
    lastUpdated: '2024-01-01T00:00:00Z',
  },
  {
    id: 'mock-2',
    type: 'comment',
    content: '/** When subscription expires, member status is changed to free */',
    filePath: 'ghost/core/core/server/services/members/subscriptions.js',
    keywords: ['subscription', 'expires', 'expiration', 'member', 'free'],
    lastUpdated: '2024-01-01T00:00:00Z',
  },
  {
    id: 'mock-3',
    type: 'function',
    content: 'function handleSubscriptionExpiration(memberId) { ... }',
    filePath: 'ghost/core/core/server/services/members/api/index.js',
    metadata: {
      name: 'handleSubscriptionExpiration',
      params: 'memberId',
    },
    keywords: ['subscription', 'expiration', 'handle', 'member'],
    lastUpdated: '2024-01-01T00:00:00Z',
  },
  {
    id: 'mock-4',
    type: 'comment',
    content: '/** No limits on post count in Ghost - verified in post access controller */',
    filePath: 'ghost/core/core/server/api/v2/content/posts.js',
    keywords: ['limits', 'posts', 'count', 'restriction'],
    lastUpdated: '2024-01-01T00:00:00Z',
  },
  {
    id: 'mock-5',
    type: 'comment',
    content: '/** Premium content restricted to paid members via visibility settings */',
    filePath: 'ghost/core/core/server/api/v2/content/posts.js',
    keywords: ['premium', 'content', 'paid', 'members', 'visibility'],
    lastUpdated: '2024-01-01T00:00:00Z',
  },
  {
    id: 'mock-6',
    type: 'comment',
    content: '/** Ghost subscription management handles tier upgrades and downgrades */',
    filePath: 'ghost/core/core/server/services/members/subscriptions.js',
    keywords: ['subscription', 'upgrade', 'downgrade', 'tier', 'management'],
    lastUpdated: '2024-01-01T00:00:00Z',
  },
  {
    id: 'mock-7',
    type: 'function',
    content: 'function processMemberTierChange(memberId, fromTierId, toTierId) { ... }',
    filePath: 'ghost/core/core/server/services/members/api/index.js',
    metadata: {
      name: 'processMemberTierChange',
      params: 'memberId, fromTierId, toTierId',
    },
    keywords: ['tier', 'change', 'process', 'member'],
    lastUpdated: '2024-01-01T00:00:00Z',
  },
  {
    id: 'mock-8',
    type: 'comment',
    content: '/** Email features require newsletter subscription status to be active */',
    filePath: 'ghost/core/core/server/services/mail/index.js',
    keywords: ['email', 'newsletter', 'subscription', 'active'],
    lastUpdated: '2024-01-01T00:00:00Z',
  },
]
