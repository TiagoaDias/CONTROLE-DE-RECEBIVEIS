/**
 * Utilitário Robusto de Impressão Direta para Navegadores, Desktop, Mobile e Iframes
 * Permite imprimir diretamente o extrato, recibo ou contrato sem falhas,
 * preservando todas as cores, tabelas, fontes e logos do Tailwind.
 */

export function printHtmlContent(
  title: string,
  elementOrHtml: HTMLElement | string | null,
  fallbackToPdf?: () => void
): boolean {
  if (!elementOrHtml) {
    if (fallbackToPdf) {
      fallbackToPdf();
      return true;
    }
    if (typeof window !== 'undefined' && window.print) {
      try {
        window.print();
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  try {
    // 1. Garante que o estilo de impressão global esteja injetado no documento principal
    const printStyleId = 'haspaho-print-engine-styles';
    let styleEl = document.getElementById(printStyleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = printStyleId;
      styleEl.textContent = `
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 6mm 6mm 6mm;
          }
          html, body {
            background: #ffffff !important;
            color: #0f172a !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            height: auto !important;
            width: 100% !important;
          }
          /* Oculta tudo que está no body exceto o container exclusivo de impressão */
          body > *:not(#haspaho-print-container) {
            display: none !important;
            visibility: hidden !important;
          }
          #haspaho-print-container {
            display: block !important;
            visibility: visible !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 2mm !important;
            background: #ffffff !important;
            color: #0f172a !important;
            overflow: visible !important;
            box-shadow: none !important;
            border: none !important;
            z-index: 9999999 !important;
          }
          #haspaho-print-container * {
            visibility: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          .no-print, button, [role="button"] {
            display: none !important;
          }
        }
        @media screen {
          #haspaho-print-container {
            display: none !important;
          }
        }
      `;
      document.head.appendChild(styleEl);
    }

    // 2. Remove qualquer container de impressão antigo se existir
    const existingContainer = document.getElementById('haspaho-print-container');
    if (existingContainer) {
      existingContainer.remove();
    }

    // 3. Cria o container de impressão na raiz do body
    const printContainer = document.createElement('div');
    printContainer.id = 'haspaho-print-container';
    printContainer.setAttribute('data-print-title', title);

    if (typeof elementOrHtml === 'string') {
      printContainer.innerHTML = elementOrHtml;
    } else {
      printContainer.innerHTML = elementOrHtml.innerHTML;
    }

    document.body.appendChild(printContainer);

    // 4. Altera temporariamente o título do documento para o nome do arquivo impresso
    const originalTitle = document.title;
    if (title) {
      document.title = title;
    }

    // 5. Função de limpeza pós-impressão
    const cleanup = () => {
      document.title = originalTitle;
      const el = document.getElementById('haspaho-print-container');
      if (el) {
        el.remove();
      }
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup);

    // 6. Tenta acionar a caixa de diálogo nativa de impressão
    let printSuccess = false;
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      try {
        window.print();
        printSuccess = true;
      } catch (printErr) {
        console.warn('window.print() bloqueado pelo navegador:', printErr);
      }
    }

    // Se window.print() foi bloqueado pelo navegador/iframe, aciona o fallback em PDF
    if (!printSuccess && fallbackToPdf) {
      fallbackToPdf();
    }

    setTimeout(cleanup, 2500);
    return true;
  } catch (err) {
    console.error('Erro ao acionar impressora nativa:', err);
    if (fallbackToPdf) {
      fallbackToPdf();
      return true;
    }
    return false;
  }
}
