import type { PlatformInfo } from "@/types/download";

const PLATFORM_RULES: Array<{
  id: string;
  name: string;
  shortName: string;
  hosts: string[];
}> = [
  { id: "youtube", name: "YouTube", shortName: "YT", hosts: ["youtube.com", "youtu.be", "youtube-nocookie.com"] },
  { id: "tiktok", name: "TikTok", shortName: "TT", hosts: ["tiktok.com"] },
  { id: "douyin", name: "Douyin", shortName: "DY", hosts: ["douyin.com", "iesdouyin.com"] },
  { id: "instagram", name: "Instagram", shortName: "IG", hosts: ["instagram.com"] },
  { id: "facebook", name: "Facebook", shortName: "FB", hosts: ["facebook.com", "fb.watch"] },
  { id: "x", name: "X / Twitter", shortName: "X", hosts: ["x.com", "twitter.com"] },
  { id: "spotify", name: "Spotify", shortName: "SP", hosts: ["spotify.com"] },
  { id: "soundcloud", name: "SoundCloud", shortName: "SC", hosts: ["soundcloud.com"] },
  { id: "pinterest", name: "Pinterest", shortName: "PIN", hosts: ["pinterest.com", "pin.it"] },
  { id: "reddit", name: "Reddit", shortName: "RD", hosts: ["reddit.com", "redd.it"] },
  { id: "vimeo", name: "Vimeo", shortName: "VM", hosts: ["vimeo.com"] },
  { id: "dailymotion", name: "Dailymotion", shortName: "DM", hosts: ["dailymotion.com", "dai.ly"] },
  { id: "bilibili", name: "Bilibili", shortName: "BI", hosts: ["bilibili.com", "b23.tv"] },
  { id: "capcut", name: "CapCut", shortName: "CC", hosts: ["capcut.com"] },
  { id: "threads", name: "Threads", shortName: "TH", hosts: ["threads.net"] },
  { id: "telegram", name: "Telegram", shortName: "TG", hosts: ["t.me", "telegram.me"] },
  { id: "likee", name: "Likee", shortName: "LK", hosts: ["likee.video", "likee.com"] },
];

function normalizeHostname(hostname: string) {
  return hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
}

export function detectPlatform(input: string): PlatformInfo {
  const cleanInput = input.trim();
  if (/^pinterest\s*:/i.test(cleanInput)) {
    return { id: "pinterest", name: "Pinterest", shortName: "PIN", hostname: "pinterest-search" };
  }

  let hostname = "";

  try {
    hostname = normalizeHostname(new URL(cleanInput).hostname);
  } catch {
    const fuzzy = cleanInput.toLowerCase();
    const match = PLATFORM_RULES.find((platform) =>
      platform.hosts.some((host) => fuzzy.includes(host)),
    );

    return match
      ? { ...match, hostname: match.hosts[0] }
      : { id: "generic", name: "Tautan media", shortName: "URL", hostname: "" };
  }

  const match = PLATFORM_RULES.find((platform) =>
    platform.hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`)),
  );

  return match
    ? { id: match.id, name: match.name, shortName: match.shortName, hostname }
    : { id: "generic", name: "Tautan media", shortName: "URL", hostname };
}

export const SUPPORTED_PLATFORMS = PLATFORM_RULES.map(({ id, name, shortName }) => ({
  id,
  name,
  shortName,
}));
