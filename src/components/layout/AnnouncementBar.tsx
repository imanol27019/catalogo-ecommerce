import { ANNOUNCEMENT_MESSAGE, MIN_ORDER_QTY, MIN_ORDER_TOTAL } from '../../config/site.config';
import { describeOrderMinimum } from '../../utils/orderMinimum';

export function AnnouncementBar() {
  const message = ANNOUNCEMENT_MESSAGE ?? describeOrderMinimum(MIN_ORDER_QTY, MIN_ORDER_TOTAL);

  if (!message) return null;

  return (
    <div className="bg-stone-900 px-4 py-2 text-center text-xs font-semibold tracking-wide text-white sm:text-sm">
      {message}
    </div>
  );
}
