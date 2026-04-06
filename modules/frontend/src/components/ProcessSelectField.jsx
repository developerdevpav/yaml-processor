import { Check, ChevronDown } from '@untitledui/icons';
import { twMerge } from 'tailwind-merge';
import { Button, ListBox, ListBoxItem, Popover, Select, SelectValue } from 'react-aria-components';

const EMPTY_KEY = '__empty__';

const triggerClassName = twMerge(
  'flex w-full min-h-11 items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-left text-sm text-slate-900 shadow-sm outline-none transition',
  'focus-visible:border-[#9e77ed] focus-visible:ring-4 focus-visible:ring-[#f4ebff]',
  'expanded:border-[#9e77ed] disabled:cursor-not-allowed disabled:opacity-60',
  'expanded:[&_svg:last-child]:rotate-180',
);

const popoverClassName =
  'min-w-[--trigger-width] overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-[0_12px_32px_rgba(16,24,40,0.12)]';

const listBoxClassName = 'max-h-60 overflow-auto py-1 outline-none';

function itemClassName({ isFocused, isSelected }) {
  return twMerge(
    'flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none',
    isFocused && 'bg-slate-50',
    isSelected && 'bg-[#f4ebff] text-slate-900',
  );
}

/**
 * Select in the spirit of Untitled UI (React Aria + Tailwind + @untitledui/icons).
 * @see https://www.untitledui.com/react/components/select
 */
export function ProcessSelectField({
  id,
  className,
  value,
  onChange,
  options,
  placeholder,
  isDisabled = false,
}) {
  const selectedKey = value ? value : EMPTY_KEY;
  const normalizedOptions = options.map((option) =>
    typeof option === 'string' ? { value: option, label: option } : option
  );

  return (
    <Select
      className={twMerge('w-full', className)}
      selectedKey={selectedKey}
      onSelectionChange={(key) => {
        const next = key == null ? EMPTY_KEY : String(key);
        onChange(next === EMPTY_KEY ? '' : next);
      }}
      disallowEmptySelection
      placeholder={placeholder}
      isDisabled={isDisabled}
    >
      <Button id={id} className={triggerClassName}>
        <SelectValue
          className={({ isPlaceholder }) =>
            twMerge('min-w-0 flex-1 truncate', isPlaceholder && 'text-slate-400')
          }
        />
        <ChevronDown size={16} aria-hidden className="shrink-0 text-slate-400 transition duration-200" />
      </Button>
      <Popover className={popoverClassName} offset={6}>
        <ListBox className={listBoxClassName}>
          <ListBoxItem id={EMPTY_KEY} textValue={placeholder} className={itemClassName}>
            {({ isSelected }) => (
              <>
                <span className="min-w-0 flex-1 truncate text-slate-500">{placeholder}</span>
                {isSelected ? <Check size={16} className="shrink-0 text-[#7f56d9]" aria-hidden /> : <span className="h-4 w-4 shrink-0" />}
              </>
            )}
          </ListBoxItem>
          {normalizedOptions.map((opt) => (
            <ListBoxItem key={opt.value} id={opt.value} textValue={opt.label} className={itemClassName}>
              {({ isSelected }) => (
                <>
                  <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                  {isSelected ? <Check size={16} className="shrink-0 text-[#7f56d9]" aria-hidden /> : <span className="h-4 w-4 shrink-0" />}
                </>
              )}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}
