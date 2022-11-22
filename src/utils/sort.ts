import moment = require("moment");
import { Order } from "./order";

function descendingComparator<T>(a: T, b: T, orderBy: keyof T) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let aVal: any = a[orderBy];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let bVal: any = b[orderBy];
  if (typeof a[orderBy] === "string") {
    aVal = (aVal as string).toUpperCase();
    bVal = (bVal as string).toUpperCase();
  }
  if (bVal < aVal) {
    return -1;
  }
  if (bVal > aVal) {
    return 1;
  }
  return 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getComparator<Key extends keyof any>(
  order: Order,
  orderBy: Key
): (
  a: { [key in Key]: number | string | moment.Moment },
  b: { [key in Key]: number | string | moment.Moment }
) => number {
  return order === "desc"
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy);
}

export { getComparator };
