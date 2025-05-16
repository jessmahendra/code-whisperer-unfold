
import { KnowledgeEntry } from './types';

// Mock knowledge base entries for demo purposes
export const mockKnowledgeEntries: KnowledgeEntry[] = [
  {
    type: 'comment',
    content: '/** Processes subscription payments through Stripe integration */',
    filePath: 'ghost/core/core/server/services/members/payment.js',
    keywords: ['subscription', 'payment', 'process', 'stripe', 'members'],
  },
  {
    type: 'comment',
    content: '/** When subscription expires, member status is changed to free */',
    filePath: 'ghost/core/core/server/services/members/subscriptions.js',
    keywords: ['subscription', 'expires', 'expiration', 'member', 'free'],
  },
  {
    type: 'function',
    content: 'function handleSubscriptionExpiration(memberId) { ... }',
    filePath: 'ghost/core/core/server/services/members/api/index.js',
    metadata: {
      name: 'handleSubscriptionExpiration',
      params: 'memberId',
    },
    keywords: ['subscription', 'expiration', 'handle', 'member'],
  },
  {
    type: 'comment',
    content: '/** No limits on post count in Ghost - verified in post access controller */',
    filePath: 'ghost/core/core/server/api/v2/content/posts.js',
    keywords: ['limits', 'posts', 'count', 'restriction'],
  },
  {
    type: 'comment',
    content: '/** Premium content restricted to paid members via visibility settings */',
    filePath: 'ghost/core/core/server/api/v2/content/posts.js',
    keywords: ['premium', 'content', 'paid', 'members', 'visibility'],
  },
  {
    type: 'comment',
    content: '/** Ghost subscription management handles tier upgrades and downgrades */',
    filePath: 'ghost/core/core/server/services/members/subscriptions.js',
    keywords: ['subscription', 'upgrade', 'downgrade', 'tier', 'management'],
  },
  {
    type: 'function',
    content: 'function processMemberTierChange(memberId, fromTierId, toTierId) { ... }',
    filePath: 'ghost/core/core/server/services/members/api/index.js',
    metadata: {
      name: 'processMemberTierChange',
      params: 'memberId, fromTierId, toTierId',
    },
    keywords: ['tier', 'change', 'process', 'member'],
  },
  {
    type: 'comment',
    content: '/** Email features require newsletter subscription status to be active */',
    filePath: 'ghost/core/core/server/services/mail/index.js',
    keywords: ['email', 'newsletter', 'subscription', 'active'],
  },
]
