'use strict';
const TAIPEI_OFFSET = 8 * 60 * 60 * 1000;
function invalid(message) { return { success: false, message }; }
function parseScheduleInput(input, { now = Date.now() } = {}) {
  if (typeof input !== 'string' || input.length > 1000) return invalid('請輸入使用日期與時間。');
  let value = input.normalize('NFKC').trim().toLowerCase();
  if (/^(永久|永久使用|不限期|無期限|无限期|permanent|forever)$/.test(value)) {
    return { success: true, kind: 'permanent', time_zone: 'Asia/Taipei' };
  }
  value = value.replace(/[–—−~～至到]/g, '-').replace(/：/g, ':');
  const localToday = new Date(now + TAIPEI_OFFSET);
  for (const [word, offset] of [['今天', 0], ['今日', 0], ['明天', 1], ['明日', 1], ['後天', 2]]) {
    const day = new Date(localToday.getTime() + offset * 86400000);
    value = value.replaceAll(word, day.toISOString().slice(0, 10));
  }
  const dates = [];
  value = value.replace(/(?<!\d)(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})\s*日?|(?<!\d)(\d{4})(\d{2})(\d{2})(?!\d)/g,
    (match, y, m, d, cy, cm, cd) => {
      dates.push([Number(y || cy), Number(m || cm), Number(d || cd)]);
      return ' DATE ';
    });
  const times = [];
  value = value.replace(/(?<![\d:])(上午|下午|晚上|早上|中午|凌晨|am|pm)?\s*(\d{1,2})(?::(\d{2})|點(?:(\d{1,2})分?|半)?|時(?:(\d{1,2})分?)?)(?:\s*(am|pm))?(?![\d:])/g,
    (match, prefix, h, minutes, pointMinutes, hourMinutes, suffix) => {
      let hour = Number(h);
      const period = prefix || suffix;
      const minute = match.includes('半') ? 30 : Number(minutes || pointMinutes || hourMinutes || 0);
      if (period) {
        if (hour < 1 || hour > 12) hour = NaN;
        else hour = hour % 12 + (/下午|晚上|中午|pm/.test(period) ? 12 : 0);
      }
      times.push([hour, minute]);
      return ' TIME ';
    });
  const tokens = value.replace(/[\s,，;；-]+/g, ' ').trim();
  if (!['DATE TIME TIME', 'DATE TIME DATE TIME'].includes(tokens) || times.length !== 2) {
    return invalid('請提供完整開始與結束時間，例如 20261116 8:00-10:00，跨日請填兩個日期，也可輸入「永久」。');
  }
  function timestamp(date, time) {
    const [year, month, day] = date;
    const [hour, minute] = time;
    if (year < 1900 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31 || !Number.isInteger(hour) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return NaN;
    const utc = Date.UTC(year, month - 1, day, hour, minute);
    const check = new Date(utc);
    if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return NaN;
    return utc - TAIPEI_OFFSET;
  }
  const start = timestamp(dates[0], times[0]);
  const end = timestamp(dates[1] || dates[0], times[1]);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return invalid('日期或時間不存在，請確認日期、0～23 時與 0～59 分。');
  if (end <= start) return invalid('結束時間必須晚於開始時間，跨日使用請填寫結束日期。');
  return { success: true, kind: 'scheduled', start_at: new Date(start).toISOString(), end_at: new Date(end).toISOString(), time_zone: 'Asia/Taipei' };
}
module.exports = { parseScheduleInput };
