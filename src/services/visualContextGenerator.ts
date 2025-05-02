
/**
 * Service for generating visual representations of code processes
 */

interface ProcessStep {
  id: string;
  description: string;
  conditions?: Array<{
    description: string;
    action: string;
    targetId?: string;
  }>;
  nextId?: string;
}

interface VisualContext {
  type: 'flowchart' | 'component' | 'state';
  syntax: string;
}

/**
 * Determines what type of visual representation is most appropriate
 * @param feature - Feature name or description
 * @param knowledgeItems - Related knowledge items
 * @returns The appropriate visual type
 */
export function determineVisualType(
  feature: string,
  knowledgeItems: any[]
): 'flowchart' | 'component' | 'state' {
  // Simple heuristic - could be improved with more sophisticated analysis
  if (feature.toLowerCase().includes('process') || 
      feature.toLowerCase().includes('flow') ||
      knowledgeItems.some(item => item.content?.toLowerCase().includes('step'))) {
    return 'flowchart';
  }
  
  if (feature.toLowerCase().includes('component') || 
      feature.toLowerCase().includes('ui')) {
    return 'component';
  }
  
  if (feature.toLowerCase().includes('state') || 
      feature.toLowerCase().includes('status')) {
    return 'state';
  }
  
  // Default to flowchart
  return 'flowchart';
}

/**
 * Extracts process steps from knowledge items
 * @param feature - Feature name or description
 * @param knowledgeItems - Related knowledge items
 * @returns Array of process steps
 */
export function extractProcessSteps(
  feature: string,
  knowledgeItems: any[]
): ProcessStep[] {
  // This is a simplified implementation
  // In a real implementation, this would use more sophisticated NLP
  
  // For demo purposes, create some example steps based on the feature
  
  if (feature.toLowerCase().includes('subscription')) {
    return [
      {
        id: 'start',
        description: 'User selects subscription plan',
        nextId: 'payment'
      },
      {
        id: 'payment',
        description: 'Process payment through Stripe',
        conditions: [
          {
            description: 'Payment successful',
            action: 'Create subscription',
            targetId: 'activate'
          },
          {
            description: 'Payment failed',
            action: 'Show error message',
            targetId: 'start'
          }
        ]
      },
      {
        id: 'activate',
        description: 'Activate member subscription',
        nextId: 'access'
      },
      {
        id: 'access',
        description: 'Grant access to premium content'
      }
    ];
  }
  
  if (feature.toLowerCase().includes('post') || feature.toLowerCase().includes('content')) {
    return [
      {
        id: 'create',
        description: 'Author creates post content',
        nextId: 'visibility'
      },
      {
        id: 'visibility',
        description: 'Set post visibility',
        conditions: [
          {
            description: 'Public',
            action: 'Available to all visitors',
            targetId: 'publish'
          },
          {
            description: 'Members-only',
            action: 'Available to registered members',
            targetId: 'publish'
          },
          {
            description: 'Paid members',
            action: 'Available to paid subscribers only',
            targetId: 'publish'
          }
        ]
      },
      {
        id: 'publish',
        description: 'Publish post',
        nextId: 'access'
      },
      {
        id: 'access',
        description: 'Reader accesses content based on membership status'
      }
    ];
  }
  
  // Generic process if no specific feature recognized
  return [
    {
      id: 'step1',
      description: 'Start process',
      nextId: 'step2'
    },
    {
      id: 'step2',
      description: 'Process data',
      conditions: [
        {
          description: 'Valid data',
          action: 'Continue processing',
          targetId: 'step3'
        },
        {
          description: 'Invalid data',
          action: 'Error handling',
          targetId: 'step1'
        }
      ]
    },
    {
      id: 'step3',
      description: 'Complete process'
    }
  ];
}

/**
 * Generates a flowchart in mermaid syntax
 * @param feature - Feature name or description
 * @param knowledgeItems - Related knowledge items
 * @returns Visual context with mermaid syntax
 */
export function generateFlowchart(
  feature: string,
  knowledgeItems: any[]
): VisualContext {
  // Extract process steps
  const steps = extractProcessSteps(feature, knowledgeItems);
  
  // Generate mermaid flowchart
  let mermaidSyntax = 'graph TD\n';
  
  // Add all nodes
  steps.forEach(step => {
    mermaidSyntax += `  ${step.id}["${step.description}"]\n`;
  });
  
  // Add connections
  steps.forEach(step => {
    // Add direct next step connection
    if (step.nextId) {
      mermaidSyntax += `  ${step.id} --> ${step.nextId}\n`;
    }
    
    // Add conditional branches
    if (step.conditions) {
      step.conditions.forEach((condition, index) => {
        const conditionId = `${step.id}_cond${index}`;
        mermaidSyntax += `  ${step.id} -- "${condition.description}" --> ${conditionId}\n`;
        mermaidSyntax += `  ${conditionId}["${condition.action}"]\n`;
        
        // Connect to target if specified
        if (condition.targetId) {
          mermaidSyntax += `  ${conditionId} --> ${condition.targetId}\n`;
        }
      });
    }
  });
  
  return {
    type: 'flowchart',
    syntax: mermaidSyntax
  };
}

/**
 * Creates a component diagram (placeholder implementation)
 * @param feature - Feature name
 * @param knowledgeItems - Related knowledge items
 */
export function generateComponentDiagram(
  feature: string,
  knowledgeItems: any[]
): VisualContext {
  // Simplified placeholder implementation
  return {
    type: 'component',
    syntax: 'graph LR\n  A[Component A] --> B[Component B]\n  B --> C[Component C]'
  };
}

/**
 * Creates a state diagram (placeholder implementation)
 * @param feature - Feature name
 * @param knowledgeItems - Related knowledge items
 */
export function generateStateDiagram(
  feature: string,
  knowledgeItems: any[]
): VisualContext {
  // Simplified placeholder implementation
  return {
    type: 'state',
    syntax: 'stateDiagram-v2\n  [*] --> Active\n  Active --> Inactive\n  Inactive --> [*]'
  };
}

/**
 * Main entry point for generating visual representations
 * @param feature - Feature name or description
 * @param knowledgeItems - Related knowledge items
 * @returns Visual representation or null if not applicable
 */
export function generateVisualContext(
  feature: string,
  knowledgeItems: any[]
): VisualContext | null {
  // Determine the type of visual needed
  const visualType = determineVisualType(feature, knowledgeItems);
  
  switch (visualType) {
    case 'component':
      return generateComponentDiagram(feature, knowledgeItems);
    case 'flowchart':
      return generateFlowchart(feature, knowledgeItems);
    case 'state':
      return generateStateDiagram(feature, knowledgeItems);
    default:
      return null;
  }
}
