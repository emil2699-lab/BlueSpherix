/** Capture one base plane without making html2canvas clone the whole dashboard. */
export async function captureGlassContent(element: HTMLElement) {
  const { default: html2canvas } = await import("html2canvas");
  const frame = document.createElement("iframe");
  frame.title = "";
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = `position:fixed;left:-100000px;top:0;width:${innerWidth}px;height:${innerHeight}px;border:0;opacity:0;pointer-events:none`;
  document.body.append(frame);
  try {
    const target = frame.contentDocument!;
    target.documentElement.dataset.theme = document.documentElement.dataset.theme;
    target.documentElement.style.colorScheme = document.documentElement.style.colorScheme;
    // Preserve inherited theme selectors, custom properties and fonts. The
    // isolated document contains no scripts, other cards or hidden sections.
    const sheets = Array.from(document.head.querySelectorAll<HTMLStyleElement | HTMLLinkElement>('style, link[rel="stylesheet"]'));
    await Promise.all(sheets.map(source => new Promise<void>(resolve => {
      const copy = source.cloneNode(true) as HTMLStyleElement | HTMLLinkElement;
      if (copy instanceof HTMLLinkElement) {
        // instanceof uses the source realm before adoption into the iframe.
        copy.onload = () => resolve();
        copy.onerror = () => resolve();
      }
      target.head.append(copy);
      if (source instanceof HTMLStyleElement) resolve();
    })));
    const ancestors: HTMLElement[] = [];
    for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) ancestors.push(parent);
    let host = target.body;
    for (const source of ancestors.reverse()) {
      const copy = source.cloneNode(false) as HTMLElement;
      copy.style.cssText += ";display:block;position:static;padding:0;margin:0;border:0;transform:none;max-width:none;min-width:0;height:auto;animation:none";
      host.append(copy);
      host = copy;
    }
    const bounds = element.getBoundingClientRect();
    const copy = element.cloneNode(true) as HTMLElement;
    delete copy.dataset.iceLensRaster;
    delete copy.dataset.iceLensFallback;
    delete copy.dataset.iceLensActive;
    copy.style.cssText += `;width:${bounds.width}px;height:${bounds.height}px;flex:none;position:relative;margin:0;transform:none;animation:none;filter:none;opacity:1;max-width:none`;
    host.append(copy);
    const originalInputs = element.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea");
    copy.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea").forEach((input, index) => {
      if (!(input.tagName === "INPUT" && (input as HTMLInputElement).type === "file")) input.value = originalInputs[index].value;
      if (input.tagName === "INPUT") (input as HTMLInputElement).checked = (originalInputs[index] as HTMLInputElement).checked;
    });
    await target.fonts.ready;
    return await html2canvas(copy, {
      backgroundColor: null, logging: false, useCORS: true, removeContainer: true,
      imageTimeout: 1500, scale: Math.min(2, Math.max(devicePixelRatio || 1, 1.5)),
      windowWidth: innerWidth, windowHeight: innerHeight,
    });
  } finally {
    frame.remove();
  }
}
