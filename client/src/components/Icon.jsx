// The site's one icon set: outline, 1.5 stroke, round ends, drawn on a
// 24-unit grid. Sizes: 16 in text and tables, 20 in buttons and the header,
// 24 for feature rows. Icons are decorative (aria-hidden); the button or link
// around them carries the label.
const P = {
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>,
  bag: <><path d="M5 8h14l-1.1 11.6a1.5 1.5 0 0 1-1.5 1.4H7.6a1.5 1.5 0 0 1-1.5-1.4L5 8z" /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" /></>,
  user: <><circle cx="12" cy="8" r="3.8" /><path d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" /></>,
  heart: <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z" />,
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  'arrow-left': <path d="M19 12H5M11 6l-6 6 6 6" />,
  'arrow-right': <path d="M5 12h14M13 6l6 6-6 6" />,
  'arrow-up': <path d="M12 19V5M6 11l6-6 6 6" />,
  'arrow-down': <path d="M12 5v14M6 13l6 6 6-6" />,
  'chevron-down': <path d="M6 9l6 6 6-6" />,
  'chevron-left': <path d="M15 6l-6 6 6 6" />,
  'chevron-right': <path d="M9 6l6 6-6 6" />,
  external: <path d="M14 5h5v5M19 5l-8 8M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  alert: <><path d="M12 4.5l8.5 15h-17L12 4.5z" /><path d="M12 10v4.2M12 17h.01" /></>,
  error: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.8v5M12 16h.01" /></>,
  truck: <><path d="M3 6.5h11v9.5H3zM14 10h4l3 3.2V16h-7" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></>,
  package: <><path d="M4 7.5l8-4 8 4v9l-8 4-8-4z" /><path d="M4 7.5l8 4 8-4M12 11.5v9" /></>,
  card: <><rect x="3" y="6.5" width="18" height="11" rx="1.5" /><path d="M3 10.5h18M7 14.5h4" /></>,
  gift: <><rect x="4" y="10" width="16" height="10" rx="1" /><path d="M3 7h18v3H3zM12 7v13M12 7c-1.5-3-5-3-5-1s3 1 5 1c2 0 5 1 5-1s-3.5-2-5 1" /></>,
  chat: <path d="M5 5.5h14v10H10l-5 4z" />,
  send: <path d="M5 12h14M13 6l6 6-6 6" />,
  pencil: <path d="M15.5 4.5l4 4L9 19H5v-4L15.5 4.5z" />,
  trash: <path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  copy: <><rect x="8" y="8" width="11" height="11" rx="1.5" /><path d="M5 15V6.5A1.5 1.5 0 0 1 6.5 5H15" /></>,
  star: <path d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6z" />,
  refresh: <path d="M19 12a7 7 0 1 1-2.1-5M19 4.5V8h-3.5" />,
  grid: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 10h16M10 10v10" /></>,
  'sign-out': <path d="M14 5h5v14h-5M10 8l-4 4 4 4M6 12h10" />,
  menu: <path d="M4 8h16M4 16h16" />,
};

export default function Icon({ name, size = 20, filled = false, className = '', ...rest }) {
  const shape = P[name];
  if (!shape) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`icon${className ? ` ${className}` : ''}`}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {shape}
    </svg>
  );
}
