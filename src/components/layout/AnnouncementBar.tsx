import { ANNOUNCEMENT_MESSAGE, MIN_ORDER_QTY, MIN_ORDER_TOTAL } from '../../config/site.config';
import { describeOrderMinimum } from '../../utils/orderMinimum';
import { HeartIcon } from '../ui/icons';

export function AnnouncementBar() {
  const message = ANNOUNCEMENT_MESSAGE ?? describeOrderMinimum(MIN_ORDER_QTY, MIN_ORDER_TOTAL);

  if (!message) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-plum-900 px-4 py-2 text-center text-xs font-semibold tracking-wide text-white sm:text-sm">
      <HeartIcon className="h-3 w-3 shrink-0 text-brand-300" />
      <span>{message}</span>
      <HeartIcon className="h-3 w-3 shrink-0 text-brand-300" />
    </div>
  );
}
