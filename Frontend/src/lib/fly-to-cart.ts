export function flyToCart(sourceEl: HTMLElement | null, targetSelector = "#cart-icon-anchor") {
  if (!sourceEl || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const target = document.querySelector<HTMLElement>(targetSelector);
  const sourceImage = sourceEl.querySelector<HTMLImageElement>("img");
  if (!target || !sourceImage) return;

  const startRect = sourceImage.getBoundingClientRect();
  const endRect = target.getBoundingClientRect();
  const clone = sourceImage.cloneNode(true) as HTMLImageElement;

  Object.assign(clone.style, {
    position: "fixed",
    left: `${startRect.left}px`,
    top: `${startRect.top}px`,
    width: `${startRect.width}px`,
    height: `${startRect.height}px`,
    borderRadius: "12px",
    objectFit: "cover",
    zIndex: "999",
    pointerEvents: "none",
    transition: "transform 550ms cubic-bezier(.22,1,.36,1), opacity 550ms ease",
    willChange: "transform, opacity",
  });
  document.body.appendChild(clone);

  window.requestAnimationFrame(() => {
    const dx = endRect.left + endRect.width / 2 - (startRect.left + startRect.width / 2);
    const dy = endRect.top + endRect.height / 2 - (startRect.top + startRect.height / 2);
    clone.style.transform = `translate(${dx}px, ${dy}px) scale(.12)`;
    clone.style.opacity = ".3";
  });

  const removeClone = () => clone.remove();
  clone.addEventListener("transitionend", removeClone, { once: true });
  window.setTimeout(removeClone, 700);
}
