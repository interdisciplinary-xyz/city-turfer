export type RenderErrorProps = {
  /** Re-render the part of the page that crashed (Next's error boundary `retry`). */
  onRetry: () => void;
};
