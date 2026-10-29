import { renderCalendar } from './calendar.mjs';
export const USERNAME = 'Festo-Wampamba';
export const WINDOW_DAYS = 90;
const DAY_MS = 86_400_000;

export function dateRange(now = new Date()) {
  const end = new Date(now);
  const start = new Date(end);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - WINDOW_DAYS + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

export async function fetchDays({ token, now = new Date(), fetcher = fetch }) {
  if (!token) throw new Error('Set GH_TOKEN or GITHUB_TOKEN before refreshing the graph.');
  const { from, to } = dateRange(now);
  const response = await fetcher('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'festo-contribution-graph' },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      query: `query($login: String!, $from: DateTime!, $to: DateTime!) {
        user(login: $login) { contributionsCollection(from: $from, to: $to) {
          contributionCalendar { weeks { contributionDays { date contributionCount } } }
        } }
      }`,
      variables: { login: USERNAME, from, to },
    }),
  });
  if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}; keeping the saved graph.`);
  const result = await response.json();
  if (result.errors?.length) throw new Error('GitHub rejected the contribution query; keeping the saved graph.');
  const weeks = result.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
  if (!Array.isArray(weeks)) throw new Error('GitHub returned no contribution calendar.');
  return normalizeDays(weeks.flatMap((week) => week.contributionDays ?? []), now);
}

export function normalizeDays(days, now = new Date()) {
  const { from, to } = dateRange(now);
  const start = from.slice(0, 10);
  const end = to.slice(0, 10);
  const selected = days.filter((day) => day?.date >= start && day.date <= end).sort((a, b) => a.date.localeCompare(b.date));
  if (selected.length !== WINDOW_DAYS) throw new Error('Incomplete contribution calendar; keeping the saved graph.');
  selected.forEach((day, index) => {
    const expected = new Date(Date.parse(from) + index * DAY_MS).toISOString().slice(0, 10);
    if (day.date !== expected || !Number.isSafeInteger(day.contributionCount) || day.contributionCount < 0) {
      throw new Error('Invalid contribution data; keeping the saved graph.');
    }
  });
  return selected;
}

export function renderGraph(input, now = new Date()) {
  return renderCalendar(normalizeDays(input, now), USERNAME);
}
