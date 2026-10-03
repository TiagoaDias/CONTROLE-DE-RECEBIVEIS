import html2canvas from 'html2canvas';

export interface ScreenshotCaptureResult {
  success: boolean;
  imageUrl?: string;
  imageBlob?: Blob;
  fileName: string;
  error?: string;
}

/**
 * Captura exclusivamente o elemento do painel/documento aberto em alta resolução (2x)
 * e faz o download automático para a pasta Downloads/Galeria.
 */
export async function capturePanelScreenshot(
  targetElement: HTMLElement | null,
  fileNameBase: string
): Promise<ScreenshotCaptureResult> {
  const cleanBase = fileNameBase.replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();
  const fileName = `${cleanBase}_${Date.now()}.png`;

  if (!targetElement) {
    return {
      success: false,
      fileName,
      error: 'Elemento do documento não encontrado para captura.',
    };
  }

  try {
    const canvas = await html2canvas(targetElement, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      scrollY: 0,
      scrollX: 0,
      onclone: (clonedDoc) => {
        try {
          const sheets = clonedDoc.styleSheets;
          for (let i = 0; i < sheets.length; i++) {
            try {
              const rules = sheets[i].cssRules;
              for (let j = 0; j < rules.length; j++) {
                const rule = rules[j] as CSSStyleRule;
                if (rule && rule.style) {
                  for (let k = 0; k < rule.style.length; k++) {
                    const prop = rule.style[k];
                    const val = rule.style.getPropertyValue(prop);
                    if (val && typeof val === 'string' && val.includes('oklch')) {
                      rule.style.setProperty(prop, '#ffffff');
                    }
                  }
                }
              }
            } catch {
              // cross-origin
            }
          }

          const allEls = clonedDoc.querySelectorAll('*');
          allEls.forEach((el) => {
            const htmlEl = el as HTMLElement;
            if (htmlEl.style) {
              ['color', 'backgroundColor', 'borderColor', 'background', 'outlineColor'].forEach((p) => {
                const val = htmlEl.style[p as any];
                if (val && typeof val === 'string' && val.includes('oklch')) {
                  htmlEl.style[p as any] = '#0f172a';
                }
              });
            }
          });
        } catch {
          // ignore
        }
      }
    });

    const imageUrl = canvas.toDataURL('image/png', 1.0);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve({
            success: false,
            fileName,
            error: 'Falha ao converter canvas para blob PNG.',
          });
          return;
        }

        // 1. Download automático para a pasta de downloads / galeria
        try {
          const link = document.createElement('a');
          link.href = imageUrl;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          setTimeout(() => {
            try {
              document.body.removeChild(link);
            } catch {
              // ignore
            }
          }, 1000);
        } catch (downloadErr) {
          console.warn('Download link error:', downloadErr);
        }

        // 2. Tenta copiar automaticamente para o clipboard se suportado
        if (navigator.clipboard && window.ClipboardItem) {
          try {
            navigator.clipboard.write([
              new window.ClipboardItem({ 'image/png': blob }),
            ]).catch(() => {});
          } catch {
            // ignore
          }
        }

        resolve({
          success: true,
          imageUrl,
          imageBlob: blob,
          fileName,
        });
      }, 'image/png', 1.0);
    });
  } catch (err) {
    console.error('Erro no html2canvas ao capturar painel:', err);
    return {
      success: false,
      fileName,
      error: (err as Error)?.message || 'Erro ao renderizar imagem.',
    };
  }
}
