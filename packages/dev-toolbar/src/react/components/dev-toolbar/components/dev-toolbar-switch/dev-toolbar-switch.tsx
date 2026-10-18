import type { DevToolbarSwitch as DevToolbarSwitchProps } from '../../dev-toolbar.constants';

/** One host-app setting as a compact segmented control. */
export const DevToolbarSwitch = ({ id, label, value, options, onChange }: DevToolbarSwitchProps) => (
  <div
    role='radiogroup'
    aria-label={label}
    data-testid={`dev-toolbar-switch-${id}`}
    className='flex items-center gap-[4px]'
  >
    <span className='text-white/50'>{label}</span>
    <div className='flex overflow-hidden rounded-[4px] border border-white/15'>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type='button'
            role='radio'
            aria-checked={active}
            title={option.title}
            onClick={() => {
              if (!active) {
                onChange(option.value);
              }
            }}
            className={
              active
                ? 'bg-teal-400 px-[6px] text-neutral-950'
                : 'px-[6px] transition-colors hover:bg-white/10 hover:text-white'
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  </div>
);
