// Where to send the user after logging in. Only same-site paths are allowed, so a crafted
// ?next= link can't bounce people to another website.
export function safeNext(raw: string | null | undefined, fallback = '/dashboard') {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
  return raw;
}

export function loginUrlForCurrentPage() {
  const here = window.location.pathname + window.location.search;
  return `/login?next=${encodeURIComponent(here)}`;
}
