/** Event fired on `window` (and class set on <html>) when the page loader starts to fade out. */
export const PAGE_LOADED_EVENT = 'cityturfer:loaded';
export const PAGE_LOADED_CLASS = 'loaded';

/** Set on <html> by the boot script while the loader covers the page; INERT_ROOT_SCRIPT checks it. */
export const LOADER_ACTIVE_CLASS = 'loader-active';

/** Id of the wrapper around the page content that is `inert` while the loader is up. */
export const PAGE_ROOT_ID = 'page-root';

/** The loader never stays longer than this, even if a font is slow (ms). */
export const LOADER_MAX_MS = 1500;

/**
 * The CSS safety net (globals.css, "Page loader") hides the loader after this long if the boot
 * script never runs. Keep it above LOADER_MAX_MS.
 */
export const LOADER_CSS_FALLBACK_S = 2.5;

/**
 * Runs in <head> before the first paint: once the document is parsed (DOMContentLoaded) and the
 * fonts are ready (or after LOADER_MAX_MS at the latest), adds `loaded` to <html>, which fades the
 * loader out in CSS, makes the page content interactive again and tells HeroMotion to start the
 * entrance. Images are not waited for. If this script never runs, a CSS animation hides the
 * loader anyway (globals.css, "Page loader") and INERT_ROOT_SCRIPT never makes anything inert.
 */
export const LOADER_BOOT_SCRIPT = `(()=>{var d=document.documentElement,done=false;function release(){var r=document.getElementById('${PAGE_ROOT_ID}');if(r)r.inert=false}try{d.classList.add('${LOADER_ACTIVE_CLASS}');function go(){if(done)return;done=true;d.classList.add('${PAGE_LOADED_CLASS}');release();window.dispatchEvent(new Event('${PAGE_LOADED_EVENT}'))}setTimeout(go,${LOADER_MAX_MS});var fonts=document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve();var parsed=new Promise(function(r){if(document.readyState!=='loading')r();else document.addEventListener('DOMContentLoaded',function(){r()},{once:true})});Promise.all([fonts,parsed]).then(go,go)}catch(e){d.classList.add('${PAGE_LOADED_CLASS}');release()}})();`;

/**
 * Runs as the first child of the page-content wrapper: keeps keyboard and assistive tech out of
 * the content while the loader covers it. Does nothing if the loader is not active (boot script
 * missing) or has already finished, so the page can never be left inert.
 */
export const INERT_ROOT_SCRIPT = `(()=>{var d=document.documentElement,s=document.currentScript,r=s&&s.parentElement;if(r&&d.classList.contains('${LOADER_ACTIVE_CLASS}')&&!d.classList.contains('${PAGE_LOADED_CLASS}'))r.inert=true})();`;
