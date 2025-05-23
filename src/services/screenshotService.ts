
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
  private appIframe: HTMLIFrameElement | null = null;
  private hasShownCrossOriginWarning = false;

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

  private showCrossOriginError(): void {
    if (this.hasShownCrossOriginWarning) return;
    this.hasShownCrossOriginWarning = true;
    
    console.warn('Screenshots unavailable: Cannot capture from external applications due to browser security restrictions.');
  }

  private async createHiddenIframe(url: string): Promise<HTMLIFrameElement> {
    return new Promise((resolve, reject) => {
      const iframe = document.createElement('iframe');
      iframe.src = url;
      iframe.style.position = 'absolute';
      iframe.style.left = '-9999px';
      iframe.style.width = '1200px';
      iframe.style.height = '800px';
      iframe.style.border = 'none';
      
      iframe.onload = () => {
        // Test if we can access the iframe content
        try {
          const iframeDocument = iframe.contentDocument || iframe.contentWindow?.document;
          if (!iframeDocument) {
            throw new Error('Cannot access iframe content - cross-origin restriction');
          }
          console.log('Iframe loaded successfully');
          resolve(iframe);
        } catch (error) {
          this.showCrossOriginError();
          reject(new Error('Cross-origin access blocked by browser security policy'));
        }
      };
      
      iframe.onerror = () => {
        reject(new Error('Failed to load iframe'));
      };
      
      // Set a timeout for iframe loading
      setTimeout(() => {
        reject(new Error('Iframe loading timeout'));
      }, 10000);
      
      document.body.appendChild(iframe);
      this.appIframe = iframe;
    });
  }

  private async captureFromIframe(iframe: HTMLIFrameElement, caption: string, stepNumber?: number): Promise<Screenshot | null> {
    try {
      // Wait a bit for the page to fully render
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const iframeDocument = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDocument) {
        throw new Error('Cannot access iframe content');
      }

      const canvas = await html2canvas(iframeDocument.body, {
        useCORS: true,
        allowTaint: true,
        scale: 0.8,
        backgroundColor: '#ffffff',
        width: 1200,
        height: 800
      });

      const dataUrl = canvas.toDataURL('image/png', 0.8);
      
      const screenshot: Screenshot = {
        id: `screenshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        url: dataUrl,
        caption,
        stepNumber,
        annotations: []
      };

      this.screenshots.set(screenshot.id, screenshot);
      return screenshot;
    } catch (error) {
      console.error('Failed to capture iframe screenshot:', error);
      return null;
    }
  }

  private async navigateIframeToPath(iframe: HTMLIFrameElement, path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const currentUrl = new URL(iframe.src);
      const newUrl = `${currentUrl.origin}${path}`;
      
      iframe.onload = () => {
        setTimeout(resolve, 2000); // Wait for page to load
      };
      
      iframe.onerror = () => {
        reject(new Error(`Failed to navigate to ${path}`));
      };
      
      iframe.src = newUrl;
    });
  }

  private cleanupIframe(): void {
    if (this.appIframe && this.appIframe.parentNode) {
      this.appIframe.parentNode.removeChild(this.appIframe);
      this.appIframe = null;
    }
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

  async captureGhostAdminFlow(baseUrl: string, adminPath: string = '/ghost'): Promise<Screenshot[]> {
    const screenshots: Screenshot[] = [];
    
    try {
      console.log(`Attempting to capture Ghost admin at: ${baseUrl}${adminPath}`);
      
      // Create iframe and load Ghost admin
      const iframe = await this.createHiddenIframe(`${baseUrl}${adminPath}`);
      
      // Capture login/dashboard page
      const dashboardScreenshot = await this.captureFromIframe(
        iframe, 
        'Ghost Admin Dashboard - Main interface',
        1
      );
      if (dashboardScreenshot) screenshots.push(dashboardScreenshot);
      
      // Try to navigate to settings
      try {
        await this.navigateIframeToPath(iframe, `${adminPath}/#/settings`);
        const settingsScreenshot = await this.captureFromIframe(
          iframe,
          'Ghost Admin Settings - General settings page',
          2
        );
        if (settingsScreenshot) screenshots.push(settingsScreenshot);
      } catch (error) {
        console.warn('Could not capture settings page:', error);
      }
      
      // Try to navigate to design settings for theme/appearance
      try {
        await this.navigateIframeToPath(iframe, `${adminPath}/#/settings/design`);
        const designScreenshot = await this.captureFromIframe(
          iframe,
          'Ghost Admin Design Settings - Theme and appearance options',
          3
        );
        if (designScreenshot) screenshots.push(designScreenshot);
      } catch (error) {
        console.warn('Could not capture design settings:', error);
      }
      
    } catch (error) {
      console.error('Failed to capture Ghost admin screenshots:', error);
      
      if (error.message.includes('cross-origin') || error.message.includes('Cross-origin')) {
        this.showCrossOriginError();
      }
      
      // Try to detect if we're already on a Ghost site
      const isGhostSite = document.querySelector('meta[name="generator"]')?.getAttribute('content')?.includes('Ghost');
      if (isGhostSite) {
        console.log('Detected Ghost site, attempting local capture');
        return this.captureLocalGhostElements();
      }
    } finally {
      this.cleanupIframe();
    }
    
    return screenshots;
  }

  private async captureLocalGhostElements(): Promise<Screenshot[]> {
    const screenshots: Screenshot[] = [];
    
    // Try to capture any visible Ghost admin elements
    const adminSelectors = [
      '.gh-nav', // Ghost admin navigation
      '.gh-main', // Ghost admin main content
      '.gh-settings', // Settings sections
      '[data-test-nav="settings"]', // Settings navigation
      '.ember-view.settings', // Settings views
    ];
    
    for (const selector of adminSelectors) {
      try {
        const screenshot = await this.captureBySelector(
          selector,
          `Ghost Admin Interface - ${selector}`
        );
        if (screenshot) screenshots.push(screenshot);
      } catch (error) {
        console.warn(`Could not capture ${selector}:`, error);
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
