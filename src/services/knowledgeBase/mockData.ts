
import { KnowledgeEntry } from './types';

export function generateMockData(): KnowledgeEntry[] {
  return [
    {
      type: 'content',
      content: 'Ghost is a powerful app for new-media creators to publish, share, and grow a business around their content. It comes with modern tools to build a website, publish content, send newsletters & offer paid subscriptions to members.',
      filePath: 'README.md',
      keywords: ['ghost', 'publishing', 'content', 'business', 'creators'],
      metadata: { isReadme: true, priority: 'high', fileType: 'documentation' }
    },
    {
      type: 'content',
      content: 'Ghost offers different membership tiers: Free members get access to public content, Paid members get access to premium content and features, and Complimentary members get special access.',
      filePath: 'core/server/services/members/index.js',
      keywords: ['membership', 'free', 'paid', 'premium', 'tiers'],
      metadata: { isGhostMembership: true, priority: 'high', fileType: 'javascript' }
    },
    {
      type: 'content',
      content: 'Free membership plan includes: Access to public posts, Newsletter subscription, Community access. No payment required.',
      filePath: 'core/server/services/members/plans/free.js',
      keywords: ['free', 'plan', 'membership', 'public', 'newsletter'],
      metadata: { isGhostMembership: true, priority: 'high', fileType: 'javascript' }
    },
    {
      type: 'content',
      content: 'Premium membership plan includes: All free features plus: Access to premium posts, Premium newsletter content, Priority support, Member-only features.',
      filePath: 'core/server/services/members/plans/premium.js',
      keywords: ['premium', 'paid', 'plan', 'membership', 'exclusive'],
      metadata: { isGhostMembership: true, priority: 'high', fileType: 'javascript' }
    },
    {
      type: 'content',
      content: 'Ghost Admin interface allows you to configure membership plans, set pricing, manage subscribers, and customize member portal settings.',
      filePath: 'core/client/app/components/gh-members-settings.js',
      keywords: ['admin', 'membership', 'pricing', 'settings', 'portal'],
      metadata: { isGhostAdmin: true, priority: 'medium', fileType: 'javascript' }
    }
  ];
}
