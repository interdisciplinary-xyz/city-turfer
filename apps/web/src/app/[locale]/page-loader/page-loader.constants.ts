/** Event fired on `window` (and class set on <html>) when the page loader starts to fade out. */
export const PAGE_LOADED_EVENT = 'cityturfer:loaded';
export const PAGE_LOADED_CLASS = 'loaded';

/** The loader never stays longer than this, even if an image or font is slow (ms). */
export const LOADER_MAX_MS = 3000;

/**
 * Runs in <head> before the first paint: once the window has loaded and the fonts are ready (or
 * after LOADER_MAX_MS at the latest), adds `loaded` to <html>, which fades the loader out in CSS,
 * and tells HeroMotion to start the entrance. If this script never runs, a CSS animation hides
 * the loader anyway (globals.css, "Page loader").
 */
export const LOADER_BOOT_SCRIPT = `(()=>{try{var d=document.documentElement,done=false;function go(){if(done)return;done=true;d.classList.add('${PAGE_LOADED_CLASS}');window.dispatchEvent(new Event('${PAGE_LOADED_EVENT}'))}var fonts=document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve();var loaded=new Promise(function(r){if(document.readyState==='complete')r();else window.addEventListener('load',function(){r()},{once:true})});Promise.all([fonts,loaded]).then(go,go);setTimeout(go,${LOADER_MAX_MS})}catch(e){document.documentElement.classList.add('${PAGE_LOADED_CLASS}')}})();`;
