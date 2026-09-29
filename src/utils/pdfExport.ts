import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const oklabToRgb = (l: number, a: number, b: number): [number, number, number] => {
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.2914855414 * b;

  const l_3 = l_ * l_ * l_;
  const m_3 = m_ * m_ * m_;
  const s_3 = s_ * s_ * s_;

  const r_l = +4.0767416621 * l_3 - 3.3077115913 * m_3 + 0.2309699292 * s_3;
  const g_l = -1.2684380046 * l_3 + 2.6097574011 * m_3 - 0.3413193965 * s_3;
  const b_l = -0.0041960863 * l_3 - 0.7034186147 * m_3 + 1.7076147010 * s_3;

  const f = (x: number) => {
    return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(Math.max(0, x), 1 / 2.4) - 0.055;
  };

  const r = Math.max(0, Math.min(255, Math.round(f(r_l) * 255)));
  const g = Math.max(0, Math.min(255, Math.round(f(g_l) * 255)));
  const bComp = Math.max(0, Math.min(255, Math.round(f(b_l) * 255)));

  return [r, g, bComp];
};

const oklchToRgb = (l: number, c: number, h: number): [number, number, number] => {
  const hRad = (isNaN(h) ? 0 : h * Math.PI) / 180;
  const chroma = isNaN(c) ? 0 : c;
  const lightness = isNaN(l) ? 0 : l;

  const a = chroma * Math.cos(hRad);
  const b = chroma * Math.sin(hRad);

  return oklabToRgb(lightness, a, b);
};

const replaceUnsafeColors = (val: string): string => {
  if (!val || typeof val !== 'string') return val;
  return val.replace(/(oklch|oklab|lch|lab)\(([^)]+)\)/gi, (match, type, params) => {
    const cleanParams = params.replace(/\//g, ' ').trim();
    const parts = cleanParams.split(/[\s,]+/);
    if (parts.length > 0) {
      const lStr = parts[0] || '0';
      const p1Str = parts[1] || '0';
      const p2Str = parts[2] || '0';
      const aStr = parts[3] || '1';

      let l = parseFloat(lStr);
      if (lStr.includes('%') || type.toLowerCase() === 'lab' || type.toLowerCase() === 'lch') {
        l = l / 100;
      }

      let p1 = parseFloat(p1Str);
      if (p1Str.includes('%')) {
        p1 = p1 / 100;
      }

      let p2 = parseFloat(p2Str);
      if (p2Str.includes('%')) {
        p2 = p2 / 100;
      }

      let opacity = 1.0;
      if (aStr) {
        opacity = parseFloat(aStr);
        if (aStr.includes('%')) {
          opacity = opacity / 100;
        }
      }
      if (isNaN(opacity)) {
        opacity = 1.0;
      }

      if (!isNaN(l)) {
        let r = 0, g = 0, b = 0;
        const lowerType = type.toLowerCase();
        if (lowerType === 'oklab' || lowerType === 'lab') {
          [r, g, b] = oklabToRgb(l, p1, p2);
        } else {
          [r, g, b] = oklchToRgb(l, p1, p2);
        }
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
      }
    }
    return 'rgb(0, 0, 0)';
  });
};

export const generateCanvasWithOklchFallback = async (element: HTMLElement, options: any = {}) => {
  const userOnClone = options.onclone;

  const originalGetComputedStyle = window.getComputedStyle;
  const originalDescriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');

  const cssBlocks: { element: HTMLStyleElement; originalText: string }[] = [];
  const linkElements: { element: HTMLLinkElement; originalDisabled: boolean }[] = [];
  const cleanStyleTag = document.createElement('style');
  cleanStyleTag.id = 'html2canvas-oklch-clean-styles';
  let unifiedCssText = '';

  const restoredInlineStyles: { element: HTMLElement; originalCssText: string }[] = [];

  try {
    // 1. Convert Style Tags
    const styles = Array.from(document.querySelectorAll('style'));
    for (const styleTag of styles) {
      if (styleTag.id === 'html2canvas-oklch-clean-styles') continue;
      const text = styleTag.textContent || '';
      if (text.includes('oklch') || text.includes('oklab') || text.includes('lch') || text.includes('lab')) {
        cssBlocks.push({ element: styleTag, originalText: text });
        const cleanedText = replaceUnsafeColors(text);
        unifiedCssText += '\n' + cleanedText;
        styleTag.disabled = true;
      }
    }

    // 2. Convert External Link Stylesheets
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    for (const link of links) {
      const linkTag = link as HTMLLinkElement;
      const isDisabled = linkTag.disabled;
      linkElements.push({ element: linkTag, originalDisabled: isDisabled });
      try {
        if (linkTag.href && linkTag.href.startsWith(window.location.origin)) {
          const response = await fetch(linkTag.href);
          if (response.ok) {
            const cssText = await response.text();
            if (cssText.includes('oklch') || cssText.includes('oklab') || cssText.includes('lch') || cssText.includes('lab')) {
              const cleanedText = replaceUnsafeColors(cssText);
              unifiedCssText += '\n' + cleanedText;
              linkTag.disabled = true;
            }
          }
        }
      } catch (err) {
        /* ignore cross-origin */
      }
    }

    if (unifiedCssText) {
      cleanStyleTag.textContent = unifiedCssText;
      document.head.appendChild(cleanStyleTag);
    }

    // 3. Patch getComputedStyle globally so html2canvas color reader gets rgba()
    window.getComputedStyle = function (el: any, pseudo: any) {
      const style = originalGetComputedStyle(el, pseudo);
      return new Proxy(style, {
        get(target, prop) {
          if (prop === 'getPropertyValue') {
            return function (propertyName: string) {
              const value = target.getPropertyValue(propertyName);
              return replaceUnsafeColors(value);
            };
          }
          const value = Reflect.get(target, prop);
          if (typeof value === 'string') return replaceUnsafeColors(value);
          if (typeof value === 'function') return value.bind(target);
          return value;
        }
      });
    };

    // 4. Patch contentWindow getter for iframes created by html2canvas
    if (originalDescriptor && originalDescriptor.get) {
      const originalGetter = originalDescriptor.get;
      Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
        get() {
          const win = originalGetter.call(this);
          if (win && !(win as any).__getComputedStylePatched) {
            (win as any).__getComputedStylePatched = true;
            const originalIframeGetComputedStyle = win.getComputedStyle;
            win.getComputedStyle = function (el: any, pseudo: any) {
              const style = originalIframeGetComputedStyle(el, pseudo);
              return new Proxy(style, {
                get(target, prop) {
                  if (prop === 'getPropertyValue') {
                    return function (propertyName: string) {
                      const value = target.getPropertyValue(propertyName);
                      return replaceUnsafeColors(value);
                    };
                  }
                  const value = Reflect.get(target, prop);
                  if (typeof value === 'string') return replaceUnsafeColors(value);
                  if (typeof value === 'function') return value.bind(target);
                  return value;
                }
              });
            };
          }
          return win;
        },
        configurable: true
      });
    }

    // 5. Replace inline styles
    const elements = element.querySelectorAll('*');
    const allElements = [element, ...Array.from(elements)];
    for (const el of allElements) {
      if (el instanceof HTMLElement && el.style && el.style.cssText) {
        const cssText = el.style.cssText;
        if (cssText.includes('oklch') || cssText.includes('oklab') || cssText.includes('lch') || cssText.includes('lab')) {
          restoredInlineStyles.push({ element: el, originalCssText: cssText });
          el.style.cssText = replaceUnsafeColors(cssText);
        }
      }
    }

    return await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      imageTimeout: 0,
      ...options,
      onclone: (clonedDoc: Document, clonedElement: HTMLElement) => {
        try {
          const clonedStyles = Array.from(clonedDoc.querySelectorAll('style'));
          clonedStyles.forEach((styleTag) => {
            if (styleTag.textContent && (styleTag.textContent.includes('oklch') || styleTag.textContent.includes('oklab') || styleTag.textContent.includes('lch') || styleTag.textContent.includes('lab'))) {
              styleTag.textContent = replaceUnsafeColors(styleTag.textContent);
            }
          });

          const clonedElements = clonedDoc.querySelectorAll('*');
          clonedElements.forEach((el) => {
            if (el instanceof HTMLElement && el.style && el.style.cssText) {
              if (el.style.cssText.includes('oklch') || el.style.cssText.includes('oklab') || el.style.cssText.includes('lch') || el.style.cssText.includes('lab')) {
                el.style.cssText = replaceUnsafeColors(el.style.cssText);
              }
            }
          });
        } catch (err) {
          console.warn('Error processing oklch fallback in cloned document:', err);
        }

        if (typeof userOnClone === 'function') {
          userOnClone(clonedDoc, clonedElement);
        }
      }
    });
  } finally {
    window.getComputedStyle = originalGetComputedStyle;
    if (originalDescriptor) Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', originalDescriptor);
    for (const entry of restoredInlineStyles) entry.element.style.cssText = entry.originalCssText;
    for (const block of cssBlocks) block.element.disabled = false;
    for (const link of linkElements) link.element.disabled = link.originalDisabled;
    if (cleanStyleTag.parentNode) cleanStyleTag.parentNode.removeChild(cleanStyleTag);
  }
};

export const exportElementToPdf = async (element: HTMLElement, fileName: string) => {
  const originalWidth = element.style.width;
  const originalMinWidth = element.style.minWidth;
  const originalMaxWidth = element.style.maxWidth;
  const originalPadding = element.style.padding;
  const originalMargin = element.style.margin;
  const originalDisplay = element.style.display;
  const originalVisibility = element.style.visibility;
  const originalPosition = element.style.position;
  const originalScrollX = window.scrollX;
  const originalScrollY = window.scrollY;

  try {
    // standard vertical A4 format resolution (794px width)
    element.style.width = '794px';
    element.style.minWidth = '794px';
    element.style.maxWidth = '794px';
    element.style.margin = '0 auto';
    element.style.padding = '16px 24px';
    element.style.display = 'block';
    element.style.visibility = 'visible';
    element.style.position = 'relative';
    element.style.overflow = 'hidden';

    await new Promise((resolve) => setTimeout(resolve, 300));

    const canvas = await generateCanvasWithOklchFallback(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
      imageTimeout: 0,
      removeContainer: true
    });

    // Restore styling
    element.style.width = originalWidth;
    element.style.minWidth = originalMinWidth;
    element.style.maxWidth = originalMaxWidth;
    element.style.padding = originalPadding;
    element.style.margin = originalMargin;
    element.style.display = originalDisplay;
    element.style.visibility = originalVisibility;
    element.style.position = originalPosition;

    window.scrollTo(originalScrollX, originalScrollY);

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 8;
    const pWidth = pageWidth - margin * 2;
    const ratio = pWidth / canvas.width;
    const imgWidth = pWidth;

    let currentY = 0;
    let pageNum = 0;
    const pagePixels = Math.floor((pageHeight - margin * 2) * (canvas.width / pWidth));

    while (currentY < canvas.height) {
      if (pageNum > 0) {
        pdf.addPage();
      }

      const sliceHeight = Math.min(pagePixels, Math.floor(canvas.height - currentY));
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceHeight;
      const ctx = sliceCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(canvas, 0, currentY, canvas.width, sliceHeight, 0, 0, sliceCanvas.width, sliceHeight);
      }

      const pageImgData = sliceCanvas.toDataURL('image/png', 1.0);
      const sliceImgWidth = imgWidth;
      const sliceImgHeight = sliceHeight * ratio;

      pdf.addImage(pageImgData, 'PNG', margin, margin, sliceImgWidth, sliceImgHeight, undefined, 'FAST');

      pdf.setFontSize(9);
      pdf.setTextColor(120);
      const pageNumberText = `Page ${pageNum + 1}`;
      pdf.text(pageNumberText, pageWidth / 2, pageHeight - margin + 4, { align: 'center' });

      currentY += pagePixels;
      pageNum++;
    }

    pdf.save(fileName);
  } catch (err) {
    console.error('Failed to export PDF:', err);
    // Restore element styling
    element.style.width = originalWidth;
    element.style.minWidth = originalMinWidth;
    element.style.maxWidth = originalMaxWidth;
    element.style.padding = originalPadding;
    element.style.margin = originalMargin;
    element.style.display = originalDisplay;
    element.style.visibility = originalVisibility;
    element.style.position = originalPosition;
    throw err;
  }
};
