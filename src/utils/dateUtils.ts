export function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

export function getYesterdayDate() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}
