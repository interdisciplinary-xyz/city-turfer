import type { NoticeProps } from './notice.constants';

/** A calm, bordered message: empty states ("Nothing is backed up yet"), confirmations, outages. */
export function Notice({ tone = 'info', title, children, role }: NoticeProps) {
  return (
    <div className={`portal-notice portal-notice-${tone}`} role={role}>
      {title ? <p className='portal-notice-title'>{title}</p> : null}
      <div className='portal-notice-body'>{children}</div>
    </div>
  );
}
