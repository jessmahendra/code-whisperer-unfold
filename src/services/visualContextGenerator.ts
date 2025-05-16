
/**
 * Generates visual context diagrams based on query and knowledge results
 * @param {string} query - User query
 * @param {Array} results - Knowledge base search results
 * @returns {object|null} Visual context object for rendering diagrams
 */
export function generateVisualContext(
  query: string,
  results: any[]
): { type: 'flowchart' | 'component' | 'state'; syntax: string } | null {
  
  // Determine the most appropriate visualization type based on query
  let visualizationType: 'flowchart' | 'component' | 'state' = 'flowchart';
  
  if (query.toLowerCase().includes('component') || 
      query.toLowerCase().includes('architecture') ||
      query.toLowerCase().includes('structure')) {
    visualizationType = 'component';
  } else if (query.toLowerCase().includes('state') || 
             query.toLowerCase().includes('status')) {
    visualizationType = 'state';
  }
  
  // Subscription flow diagram
  if (query.toLowerCase().includes('subscription') || 
      query.toLowerCase().includes('payment')) {
    return {
      type: 'flowchart',
      syntax: `
flowchart TB
    subgraph Member
      Start[Member visits site] --> Free[Views free content]
      Free --> Subscribe[Clicks subscribe]
    end
    Subscribe --> CheckoutFlow
    subgraph CheckoutFlow
      SelectPlan[Select plan] --> EnterCard[Enter card details]
      EnterCard --> ProcessPayment[Process payment with Stripe]
    end
    ProcessPayment -->|Success| GrantAccess[Grant premium access]
    ProcessPayment -->|Failure| RetryPayment[Retry payment]
    RetryPayment -->|Success| GrantAccess
    RetryPayment -->|Failure| NotifyFailure[Notify member & admin]
    GrantAccess --> AccessContent[Access premium content]
    
    subgraph Expiration
      MonthlyCheck[Monthly check] --> CheckValid[Check if subscription valid]
      CheckValid -->|Valid| MaintainAccess[Maintain premium access]
      CheckValid -->|Invalid| DowngradeAccess[Downgrade to free access]
    end
`
    };
  }
  
  // Content publishing flow
  if (query.toLowerCase().includes('post') || 
      query.toLowerCase().includes('content') ||
      query.toLowerCase().includes('publish')) {
    return {
      type: 'flowchart',
      syntax: `
flowchart TD
    Start[Author creates post] --> Draft[Save as draft]
    Draft --> Edit[Edit content]
    Edit --> SetVisibility[Set visibility]
    SetVisibility -->|Public| AllAccess[Available to everyone]
    SetVisibility -->|Members-only| MembersAccess[Available to all members]
    SetVisibility -->|Paid members| PaidAccess[Available to paid members only]
    SetVisibility --> Schedule[Schedule publication]
    SetVisibility --> PublishNow[Publish immediately]
    Schedule --> AutoPublish[Auto-publish at scheduled time]
    PublishNow --> Live[Post goes live]
    AutoPublish --> Live
`
    };
  }
  
  // Authentication flow
  if (query.toLowerCase().includes('auth') || 
      query.toLowerCase().includes('login') ||
      query.toLowerCase().includes('signup')) {
    return {
      type: 'flowchart',
      syntax: `
flowchart TD
    Start[User visits site] --> LoginChoice[Login/Signup choice]
    LoginChoice -->|New user| Signup[Sign up form]
    LoginChoice -->|Existing user| Login[Login form]
    Signup --> EnterDetails[Enter email & password]
    EnterDetails --> VerifyEmail[Verify email]
    VerifyEmail -->|Verified| SetupAccount[Complete account setup]
    Login --> EnterCreds[Enter credentials]
    Login -->|Magic link| RequestMagic[Request magic link]
    RequestMagic --> ReceiveEmail[Receive email]
    ReceiveEmail --> ClickLink[Click magic link]
    EnterCreds --> Validate[Validate credentials]
    ClickLink --> GenerateSession[Generate user session]
    Validate -->|Valid| GenerateSession
    Validate -->|Invalid| RetryLogin[Retry login]
    SetupAccount --> GenerateSession
    GenerateSession --> Authorized[User authorized]
`
    };
  }
  
  // Ghost component architecture
  if (query.toLowerCase().includes('architecture') || 
      query.toLowerCase().includes('component') ||
      query.toLowerCase().includes('structure')) {
    return {
      type: 'component',
      syntax: `
flowchart TD
    subgraph Frontend
      Theme[Themes] --> Handlebars[Handlebars Templates]
      Admin[Admin Interface] --> Ember[Ember.js]
    end
    
    subgraph API
      ContentAPI[Content API] --> PublicContent[Public Content Access]
      AdminAPI[Admin API] --> Management[Site Management]
    end
    
    subgraph Core
      Router[Routing] --> Controllers[Controllers]
      Controllers --> Models[Models]
      Models --> Database[(Database)]
      Services[Services] --> Models
      Auth[Authentication] --> Services
      Members[Members System] --> Services
      Payments[Payment Processing] --> Stripe[(Stripe API)]
      Email[Email Service] --> EmailProviders[(Email Providers)]
    end
    
    Frontend --> API
    API --> Core
`
    };
  }
  
  // Member states diagram
  if (query.toLowerCase().includes('member') && 
     (query.toLowerCase().includes('status') || 
      query.toLowerCase().includes('state'))) {
    return {
      type: 'state',
      syntax: `
stateDiagram-v2
    [*] --> Free: Sign up
    Free --> Paid: Subscribe
    Paid --> Free: Subscription expires
    Free --> Deleted: Delete account
    Paid --> Deleted: Delete account
    Paid --> Comped: Admin comps account
    Comped --> Free: Comp expires
    Paid --> PaidOtherTier: Change tier
`
    };
  }
  
  // Generate a custom diagram based on the results if no predefined diagram matches
  if (results.length > 0) {
    // Extract entities and relationships from results
    const entities = new Set<string>();
    const relationships: [string, string, string][] = [];
    
    results.forEach(result => {
      if (result.type === 'function' && result.metadata?.name) {
        entities.add(result.metadata.name);
      }
      
      if (result.type === 'export') {
        const exportName = Object.keys(result.exports || {})[0];
        if (exportName) entities.add(exportName);
      }
      
      // Detect potential relationships from content
      const content = result.content.toLowerCase();
      if (content.includes('require(') || content.includes('import ')) {
        for (const entity of entities) {
          if (content.includes(entity.toLowerCase())) {
            relationships.push([result.filePath.split('/').pop()?.split('.')[0] || 'Unknown', 'uses', entity]);
          }
        }
      }
    });
    
    // If we found interesting relationships, create a custom diagram
    if (relationships.length > 0) {
      let syntax = 'flowchart LR\n';
      
      // Add nodes
      entities.forEach(entity => {
        syntax += `    ${entity}[${entity}]\n`;
      });
      
      // Add relationships
      relationships.slice(0, 10).forEach(([source, relation, target]) => {
        syntax += `    ${source} -->|${relation}| ${target}\n`;
      });
      
      return {
        type: 'flowchart',
        syntax
      };
    }
  }
  
  // Default return null if we couldn't generate anything relevant
  return null;
}
