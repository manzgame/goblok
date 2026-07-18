interface PlatformIconProps {
  id: string;
  className?: string;
}

export function PlatformIcon({ id, className = "" }: PlatformIconProps) {
  const common = { className, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true } as const;

  switch (id) {
    case "youtube":
      return <svg {...common}><rect x="2" y="5" width="20" height="14" rx="5" fill="currentColor"/><path d="m10 9 6 3-6 3V9Z" fill="var(--icon-cut, white)"/></svg>;
    case "tiktok":
    case "douyin":
      return <svg {...common}><path d="M14.4 3c.5 2.7 2 4.3 4.6 4.7v3.4a9.2 9.2 0 0 1-4.5-1.4v6.1a6.2 6.2 0 1 1-5.4-6.1v3.5a2.8 2.8 0 1 0 2 2.7V3h3.3Z" fill="currentColor"/></svg>;
    case "instagram":
      return <svg {...common}><rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2"/><circle cx="17.4" cy="6.7" r="1.2" fill="currentColor"/></svg>;
    case "facebook":
      return <svg {...common}><path d="M13.8 22v-8h2.8l.5-3.2h-3.3V8.7c0-.9.3-1.7 1.7-1.7h1.8V4.1c-.3 0-1.4-.1-2.6-.1-2.6 0-4.4 1.6-4.4 4.5v2.3H7.5V14h2.8v8h3.5Z" fill="currentColor"/></svg>;
    case "x":
      return <svg {...common}><path d="M4 3h4.7l4.1 5.5L17.6 3H20l-6.1 7.2L20.5 21h-4.7l-4.7-6.3L5.7 21H3.2l6.8-8L4 3Zm3.5 2 9.4 14h1.7L9.2 5H7.5Z" fill="currentColor"/></svg>;
    case "spotify":
      return <svg {...common}><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M7 9.1c3.7-1 8.1-.7 11.1.9M7.8 12.2c3.2-.8 6.8-.5 9.5.8M8.5 15.1c2.4-.6 5.3-.4 7.5.6" stroke="var(--icon-cut, white)" strokeWidth="1.7" strokeLinecap="round"/></svg>;
    case "soundcloud":
      return <svg {...common}><path d="M2 14.4c0-1 .8-1.8 1.8-1.8.2 0 .5 0 .7.1.6-2.6 2.9-4.5 5.7-4.5.7 0 1.4.1 2 .4A5.2 5.2 0 0 1 22 11.2a3.4 3.4 0 0 1-1.4 6.5H4.1A3.3 3.3 0 0 1 2 14.4Z" fill="currentColor"/></svg>;
    case "pinterest":
      return <svg {...common}><path d="M12 2a10 10 0 0 0-3.6 19.3c-.1-1.6 0-3.4.4-4.9l1.3-5.5s-.3-.8-.3-1.9c0-1.8 1-3.1 2.3-3.1 1.1 0 1.6.8 1.6 1.8 0 1.1-.7 2.8-1.1 4.4-.3 1.3.7 2.4 2 2.4 2.4 0 4-3 4-6.5 0-2.7-2.2-4.8-5.7-4.8-4.1 0-6.7 3-6.7 6.3 0 1.1.3 1.9.8 2.6.2.2.2.4.1.7l-.3 1.1c-.1.4-.4.5-.8.4-2.1-.9-3-3.4-3-6.1C3 4.8 6.8 2 12 2Z" fill="currentColor"/></svg>;
    case "reddit":
      return <svg {...common}><circle cx="12" cy="13" r="8" fill="currentColor"/><circle cx="9" cy="13" r="1.2" fill="var(--icon-cut, white)"/><circle cx="15" cy="13" r="1.2" fill="var(--icon-cut, white)"/><path d="M8.7 16c1.8 1.2 4.8 1.2 6.6 0" stroke="var(--icon-cut, white)" strokeWidth="1.4" strokeLinecap="round"/><path d="m13.2 5.2 1-2.2 3.2.7" stroke="currentColor" strokeWidth="1.5"/><circle cx="18.3" cy="4" r="1.7" fill="currentColor"/></svg>;
    case "vimeo":
      return <svg {...common}><path d="M21.4 7.1c-.1 3.2-2.4 7.7-7 13.4-2.3 1.8-4.2 1.1-5.6-1.9L6 8.3c-.5-1.7-1-2.5-1.7-2.5-.2 0-.9.4-2 1.2L1 5.4l3.8-3.3c1.7-1.4 3.1-1.5 4.2-.2.7.8 1.2 2.8 1.7 6.1.6 3.6 1 5.8 1.4 6.5.4.9.9 1.3 1.4 1.3.4 0 1-.6 1.8-1.8.8-1.2 1.2-2.1 1.3-2.7.1-1-.3-1.5-1.3-1.5-.5 0-1 .1-1.5.3 1-3.3 2.9-4.9 5.7-4.8 1.4 0 2 .6 1.9 1.8Z" fill="currentColor"/></svg>;
    case "dailymotion":
      return <svg {...common}><path d="M17.8 2v6.5A7.3 7.3 0 1 0 20.7 14V2h-2.9ZM12.6 17.7a3.7 3.7 0 1 1 0-7.4 3.7 3.7 0 0 1 0 7.4Z" fill="currentColor"/></svg>;
    case "bilibili":
      return <svg {...common}><path d="m8 4 2 3h4l2-3M5 7h14a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M8 13v2M16 13v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
    case "capcut":
      return <svg {...common}><path d="M4 6h16l-6 5 6 5H4l6-5-6-5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="m4 4 16 16M20 4 4 20" stroke="currentColor" strokeWidth="1.5"/></svg>;
    case "threads":
      return <svg {...common}><path d="M12.2 2C6.4 2 3 5.5 3 11.8 3 18.3 6.5 22 12.4 22c4.7 0 8.1-2.6 8.1-6.4 0-2.7-1.6-4.5-4.3-5.3-.4-3.1-2-4.7-5-4.7-2 0-3.7.8-4.8 2.2l2.3 1.6c.6-.8 1.4-1.2 2.5-1.2 1.4 0 2.1.6 2.4 1.8h-1.4c-3.4 0-5.5 1.7-5.5 4.4 0 2.5 2 4.2 4.8 4.2 2.7 0 4.4-1.4 4.8-3.8 1 .5 1.5 1.3 1.5 2.3 0 2.1-2.1 3.5-5.3 3.5-4.3 0-6.7-2.8-6.7-7.8 0-4.9 2.3-7.6 6.5-7.6 3.4 0 5.5 1.7 6.2 5l2.7-.8C19.9 4.7 16.7 2 12.2 2Zm-.8 14c-1.2 0-2-.6-2-1.6 0-1.1 1-1.8 2.8-1.8h1.6v.5c0 1.8-.9 2.9-2.4 2.9Z" fill="currentColor"/></svg>;
    case "telegram":
      return <svg {...common}><path d="M21.4 3.2 18.2 20c-.2 1.2-.9 1.5-1.9.9l-4.9-3.6-2.3 2.3c-.3.3-.5.5-1 .5l.4-5 9.1-8.2c.4-.4-.1-.6-.6-.2L5.7 13.8.9 12.3c-1-.3-1-1 .2-1.5L20 3.5c.9-.3 1.7.2 1.4-.3Z" fill="currentColor"/></svg>;
    case "likee":
      return <svg {...common}><path d="M12 21S3 15.8 3 9.2C3 5.8 5.5 3 8.7 3c1.6 0 2.8.7 3.3 1.7C12.5 3.7 13.7 3 15.3 3 18.5 3 21 5.8 21 9.2 21 15.8 12 21 12 21Z" fill="currentColor"/></svg>;
    default:
      return <svg {...common}><path d="M10.4 13.6a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.7 1.7M13.6 10.4a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.7-1.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
  }
}
