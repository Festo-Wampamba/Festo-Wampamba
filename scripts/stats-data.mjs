import { USERNAME } from './graph.mjs';
const DAY = 86_400_000;
export function statsRange(now = new Date()) {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - 364);
  return { from: start.toISOString(), to: now.toISOString() };
}
const integer = (value) => Number.isSafeInteger(value) && value >= 0;

export function streakStats(days) {
  let longest = 0;
  let run = 0;
  for (const day of days) {
    run = day.contributionCount > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  let index = days.length - 1;
  if (days[index]?.contributionCount === 0) index--;
  const through = days[index]?.contributionCount > 0 ? days[index].date : null;
  let current = 0;
  while (index >= 0 && days[index--].contributionCount > 0) current++;
  return { current, longest, through };
}

export function normalizeStats(user, repositories, now = new Date()) {
  const period = statsRange(now);
  const collection = user?.contributionsCollection;
  const days = (collection?.contributionCalendar?.weeks ?? []).flatMap((week) => week.contributionDays ?? [])
    .filter((day) => day.date >= period.from.slice(0, 10) && day.date <= period.to.slice(0, 10)).sort((a, b) => a.date.localeCompare(b.date));
  if (days.length !== 365 || days.some((day, index) => day.date !== new Date(Date.parse(period.from) + index * DAY).toISOString().slice(0, 10) || !integer(day.contributionCount))) {
    throw new Error('Incomplete or invalid annual contribution calendar.');
  }
  const activity = {
    contributions: days.reduce((sum, day) => sum + day.contributionCount, 0),
    commits: collection.totalCommitContributions,
    pullRequests: collection.totalPullRequestContributions,
    issues: collection.totalIssueContributions,
    reviews: collection.totalPullRequestReviewContributions,
    activeDays: days.filter((day) => day.contributionCount > 0).length,
  };
  if (Object.values(activity).some((value) => !integer(value)) || !integer(user.followers?.totalCount)) throw new Error('Invalid profile activity counters.');
  const languageBytes = new Map();
  let stars = 0;
  for (const repo of repositories) {
    if (!integer(repo.stargazerCount) || repo.languages?.pageInfo?.hasNextPage !== false || !Array.isArray(repo.languages?.edges)) throw new Error('Incomplete repository language data.');
    stars += repo.stargazerCount;
    for (const edge of repo.languages.edges) {
      if (!integer(edge.size) || typeof edge.node?.name !== 'string') throw new Error('Invalid language data.');
      const name = edge.node.name;
      const prior = languageBytes.get(name) ?? { name, bytes: 0, color: /^#[0-9a-f]{6}$/i.test(edge.node.color ?? '') ? edge.node.color : '#8794a5' };
      prior.bytes += edge.size;
      languageBytes.set(name, prior);
    }
  }
  const languages = [...languageBytes.values()].sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name));
  const totalBytes = languages.reduce((sum, language) => sum + language.bytes, 0);
  const weekly = [];
  for (const day of days) {
    const monday = new Date(`${day.date}T00:00:00Z`);
    monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
    const from = monday.toISOString().slice(0, 10);
    if (weekly.at(-1)?.from !== from) weekly.push({ from, to: day.date, count: 0 });
    weekly.at(-1).to = day.date;
    weekly.at(-1).count += day.contributionCount;
  }
  return {
    schemaVersion: 1, username: USERNAME, updatedAt: now.toISOString(), period,
    public: { repositories: repositories.length, stars, followers: user.followers.totalCount },
    activity, streak: streakStats(days),
    languages: languages.map((language) => ({ ...language, share: totalBytes ? language.bytes / totalBytes : 0 })),
    totalLanguageBytes: totalBytes, recentWeeks: weekly.slice(-13), recentDays: days.slice(-28),
  };
}

// Community grade compatible with github-readme-stats, not an official GitHub rating.
// Formula reference: https://github.com/anuraghazra/github-readme-stats/blob/master/src/calculateRank.js
export function calculateGrade({ commits, pullRequests, issues, reviews, stars, followers }) {
  const exp = (value, median) => 1 - 2 ** (-value / median);
  const log = (value, median) => value / (median + value);
  const percentile = Math.max(0, Math.min(100, 100 * (1 - (
    2 * exp(commits, 250) + 3 * exp(pullRequests, 50) + exp(issues, 25) +
    exp(reviews, 2) + 4 * log(stars, 50) + log(followers, 10)
  ) / 12)));
  const thresholds = [1, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100];
  const level = ['S', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C'][thresholds.findIndex((value) => percentile <= value)];
  return { level, percentile, achievedA: ['S', 'A+', 'A'].includes(level) };
}

export function accountHistory(calendarDays, createdAt, now = new Date()) {
  const start = createdAt.slice(0, 10);
  const end = now.toISOString().slice(0, 10);
  const days = calendarDays.filter((day) => day.date >= start && day.date <= end).sort((a, b) => a.date.localeCompare(b.date));
  const expected = Math.round((Date.parse(end) - Date.parse(start)) / DAY) + 1;
  if (!Number.isFinite(expected) || expected < 1 || days.length !== expected || days.some((day, index) =>
    day.date !== new Date(Date.parse(start) + index * DAY).toISOString().slice(0, 10) || !integer(day.contributionCount))) {
    throw new Error('Incomplete account contribution history.');
  }
  let run = 0, longest = 0, longestFrom = null, longestTo = null;
  for (let index = 0; index < days.length; index++) {
    run = days[index].contributionCount ? run + 1 : 0;
    if (run > longest) {
      longest = run;
      longestFrom = days[index - run + 1].date;
      longestTo = days[index].date;
    }
  }
  const current = streakStats(days);
  return {
    from: start, to: end, contributions: days.reduce((sum, day) => sum + day.contributionCount, 0),
    current: current.current, currentFrom: current.through ? new Date(Date.parse(current.through) - (current.current - 1) * DAY).toISOString().slice(0, 10) : null,
    currentTo: current.through, longest, longestFrom, longestTo,
  };
}

export async function fetchStats({ token, now = new Date(), fetcher = fetch }) {
  if (!token) throw new Error('Set GH_TOKEN or GITHUB_TOKEN to refresh GitHub stats.');
  const { from, to } = statsRange(now);
  let cursor = null;
  let profile;
  const repositories = [];
  const seen = new Set();
  for (let page = 0; page < 10; page++) {
    const response = await fetcher('https://api.github.com/graphql', {
      method: 'POST', signal: AbortSignal.timeout(30_000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'festo-profile-stats' },
      body: JSON.stringify({
        query: `query($login:String!,$from:DateTime!,$to:DateTime!,$cursor:String){user(login:$login){
          createdAt followers{totalCount} pullRequests{totalCount} issues{totalCount}
          repositoriesContributedTo(first:1,contributionTypes:[COMMIT,ISSUE,PULL_REQUEST,REPOSITORY]){totalCount}
          contributionsCollection(from:$from,to:$to){totalCommitContributions totalPullRequestContributions totalIssueContributions totalPullRequestReviewContributions contributionCalendar{weeks{contributionDays{date contributionCount}}}}
          repositories(first:100,after:$cursor,privacy:PUBLIC,ownerAffiliations:[OWNER],isFork:false,orderBy:{field:NAME,direction:ASC}){totalCount pageInfo{hasNextPage endCursor} nodes{stargazerCount languages(first:100,orderBy:{field:SIZE,direction:DESC}){pageInfo{hasNextPage} edges{size node{name color}}}}}
        }}`, variables: { login: USERNAME, from, to, cursor },
      }),
    });
    if (!response.ok) throw new Error(`GitHub stats request failed (HTTP ${response.status}).`);
    const result = await response.json();
    if (result.errors?.length) throw new Error('GitHub rejected the profile statistics query.');
    const user = result.data?.user;
    const connection = user?.repositories;
    if (!connection || !Array.isArray(connection.nodes) || !connection.pageInfo || !integer(connection.totalCount)) throw new Error('GitHub returned incomplete profile statistics.');
    profile ??= user;
    repositories.push(...connection.nodes);
    if (!connection.pageInfo.hasNextPage) {
      if (repositories.length !== connection.totalCount) throw new Error('Repository count changed during refresh; retry later.');
      const snapshot = normalizeStats(profile, repositories, now);
      const counters = { pullRequests: profile.pullRequests?.totalCount, issues: profile.issues?.totalCount, contributedTo: profile.repositoriesContributedTo?.totalCount };
      if (Object.values(counters).some((value) => !integer(value)) || !Number.isFinite(Date.parse(profile.createdAt))) throw new Error('Incomplete account totals.');
      const years = now.getUTCFullYear() - new Date(profile.createdAt).getUTCFullYear() + 1;
      if (years < 1 || years > 30) throw new Error('Account history exceeds the bounded refresh limit.');
      const allDays = [];
      for (let year = new Date(profile.createdAt).getUTCFullYear(); year <= now.getUTCFullYear(); year++) {
        const historyResponse = await fetcher('https://api.github.com/graphql', {
          method: 'POST', signal: AbortSignal.timeout(30_000),
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'festo-profile-stats' },
          body: JSON.stringify({ query: `query($login:String!,$from:DateTime!,$to:DateTime!){user(login:$login){contributionsCollection(from:$from,to:$to){contributionCalendar{weeks{contributionDays{date contributionCount}}}}}}`,
            variables: { login: USERNAME, from: `${year}-01-01T00:00:00Z`, to: year === now.getUTCFullYear() ? now.toISOString() : `${year}-12-31T23:59:59Z` } }),
        });
        if (!historyResponse.ok) throw new Error(`GitHub history request failed (HTTP ${historyResponse.status}).`);
        const historyResult = await historyResponse.json();
        const weeks = historyResult.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
        if (historyResult.errors?.length || !Array.isArray(weeks)) throw new Error('GitHub returned incomplete account history.');
        allDays.push(...weeks.flatMap((week) => week.contributionDays ?? []).filter((day) => day.date?.startsWith(`${year}-`)));
      }
      snapshot.schemaVersion = 2;
      snapshot.account = { createdAt: profile.createdAt, ...counters };
      snapshot.history = accountHistory(allDays, profile.createdAt, now);
      snapshot.grade = calculateGrade({ commits: snapshot.activity.commits, pullRequests: counters.pullRequests, issues: counters.issues, reviews: snapshot.activity.reviews, stars: snapshot.public.stars, followers: snapshot.public.followers });
      return snapshot;
    }
    cursor = connection.pageInfo.endCursor;
    if (!cursor || seen.has(cursor)) throw new Error('Invalid repository pagination cursor.');
    seen.add(cursor);
  }
  throw new Error('Profile exceeds the bounded repository refresh limit.');
}
