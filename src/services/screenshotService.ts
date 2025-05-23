
import html2canvas from 'html2canvas';

export interface Screenshot {
  id: string;
  url: string;
  caption: string;
  componentName?: string;
  stepNumber?: number;
  annotations?: {
    type: 'arrow' | 'highlight' | 'circle';
    x: number;
    y: number;
    width?: number;
    height?: number;
    text?: string;
  }[];
}

export interface ScreenshotCapture {
  element: HTMLElement;
  caption: string;
  componentName?: string;
  stepNumber?: number;
}

class ScreenshotService {
  private screenshots: Map<string, Screenshot> = new Map();

  async captureElement(capture: ScreenshotCapture): Promise<Screenshot> {
    try {
      const canvas = await html2canvas(capture.element, {
        useCORS: true,
        allowTaint: true,
        scale: 1,
        backgroundColor: '#ffffff'
      });

      const dataUrl = canvas.toDataURL('image/png', 0.8);
      
      const screenshot: Screenshot = {
        id: `screenshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        url: dataUrl,
        caption: capture.caption,
        componentName: capture.componentName,
        stepNumber: capture.stepNumber,
        annotations: []
      };

      this.screenshots.set(screenshot.id, screenshot);
      return screenshot;
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
      throw new Error('Screenshot capture failed');
    }
  }

  async captureBySelector(selector: string, caption: string, componentName?: string): Promise<Screenshot | null> {
    const element = document.querySelector(selector) as HTMLElement;
    if (!element) {
      console.warn(`Element not found for selector: ${selector}`);
      return null;
    }

    return this.captureElement({
      element,
      caption,
      componentName
    });
  }

  async captureWorkflow(steps: Array<{selector: string; caption: string; delay?: number}>): Promise<Screenshot[]> {
    const screenshots: Screenshot[] = [];
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      
      if (step.delay) {
        await new Promise(resolve => setTimeout(resolve, step.delay));
      }
      
      const screenshot = await this.captureBySelector(
        step.selector, 
        step.caption, 
        `step-${i + 1}`
      );
      
      if (screenshot) {
        screenshot.stepNumber = i + 1;
        screenshots.push(screenshot);
      }
    }
    
    return screenshots;
  }

  getScreenshot(id: string): Screenshot | undefined {
    return this.screenshots.get(id);
  }

  getAllScreenshots(): Screenshot[] {
    return Array.from(this.screenshots.values());
  }

  // Pre-defined screenshot workflows for common user questions
  async captureRepositorySettings(): Promise<Screenshot[]> {
    return this.captureWorkflow([
      {
        selector: 'header',
        caption: 'Navigate to the header area',
        delay: 500
      },
      {
        selector: '[data-testid="settings-button"], button[aria-label*="Settings"], a[href*="settings"]',
        caption: 'Click on the Settings button',
        delay: 1000
      }
    ]);
  }

  async captureQuestionInput(): Promise<Screenshot[]> {
    return this.captureWorkflow([
      {
        selector: '[data-testid="question-input"], input[placeholder*="question"], textarea[placeholder*="question"]',
        caption: 'Type your question in the input field'
      },
      {
        selector: 'button[type="submit"], button[aria-label*="Ask"], button:has-text("Ask")',
        caption: 'Click the Ask button to submit your question'
      }
    ]);
  }
}

export const screenshotService = new ScreenshotService();
