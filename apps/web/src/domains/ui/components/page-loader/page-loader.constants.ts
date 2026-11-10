/** Event fired on `window` (and class set on <html>) when the page is ready and any loader fades out. */
export const PAGE_LOADED_EVENT = 'cityturfer:loaded';
export const PAGE_LOADED_CLASS = 'loaded';

/** Set on <html> by the boot script when the page is still not ready after LOADER_SHOW_MS: this shows the loader. */
export const LOADER_ACTIVE_CLASS = 'loader-active';

/** The loader only appears if the page and fonts are still not ready after this long (ms). */
export const LOADER_SHOW_MS = 180;

/** The page is released after this long even if a font is slow (ms). */
export const LOADER_MAX_MS = 1500;

/**
 * Runs in <head> before the first paint. The loader is hidden by default in CSS (so without
 * JavaScript there is none), and this script decides about it:
 * - reduced motion, or a back/forward or reload navigation: no loader, the page is `loaded` at once;
 * - otherwise, once the document is parsed (DOMContentLoaded) and the fonts are ready, it adds
 *   `loaded` to <html> and tells HeroMotion to start the entrance. Only if that takes longer than
 *   LOADER_SHOW_MS does it add `loader-active`, which shows the loader (it then fades out on
 *   `loaded`). LOADER_MAX_MS is the cap. Images are not waited for.
 * The loader is aria-hidden and never makes the page inert: assistive tech reads the page at once.
 */
export const LOADER_BOOT_SCRIPT = `(()=>{var d=document.documentElement,done=false;try{function go(){if(done)return;done=true;d.classList.add('${PAGE_LOADED_CLASS}');window.dispatchEvent(new Event('${PAGE_LOADED_EVENT}'))}var n=window.performance&&performance.getEntriesByType&&performance.getEntriesByType('navigation')[0];if((window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)||(n&&(n.type==='back_forward'||n.type==='reload'))){d.classList.add('${PAGE_LOADED_CLASS}');return}setTimeout(function(){if(!done)d.classList.add('${LOADER_ACTIVE_CLASS}')},${LOADER_SHOW_MS});setTimeout(go,${LOADER_MAX_MS});var fonts=document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve();var parsed=new Promise(function(r){if(document.readyState!=='loading')r();else document.addEventListener('DOMContentLoaded',function(){r()},{once:true})});Promise.all([fonts,parsed]).then(go,go)}catch(e){d.classList.add('${PAGE_LOADED_CLASS}')}})();`;
