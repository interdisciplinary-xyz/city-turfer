// Stand-in for `next/navigation` in the Swagger page's toolbar bundle: the toolbar only reads the
// current path, and this page is plain HTML, not a Next route.
export const usePathname = () => window.location.pathname;
