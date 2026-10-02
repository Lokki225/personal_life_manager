// The guide, which leads on to the finance pages.
const DEFAULT_DESTINATION = '/learn'
const PLACEHOLDER_ORIGIN = 'http://internal.invalid'
const MAX_LENGTH = 2000
// Browsers drop tabs and line breaks when resolving a URL, which would turn
// "/<tab>/evil.example" into "//evil.example".
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/

// Where to go after signing in. Only same-site paths are accepted, so a
// crafted login link cannot send the user to another website.
export function safeCallbackUrl(value: string | string[] | undefined): string {
  const path = Array.isArray(value) ? value[0] : value

  if (!path || path.length > MAX_LENGTH || !path.startsWith('/') || CONTROL_CHARACTERS.test(path)) {
    return DEFAULT_DESTINATION
  }

  let url: URL

  try {
    url = new URL(path, PLACEHOLDER_ORIGIN)
  } catch {
    return DEFAULT_DESTINATION
  }

  if (url.origin !== PLACEHOLDER_ORIGIN || url.pathname.startsWith('//')) {
    return DEFAULT_DESTINATION
  }

  // The general ways in all lead to the guide. Only a link to a particular
  // page is followed.
  if (['/', '/login', '/signup', '/finance'].includes(url.pathname)) {
    return DEFAULT_DESTINATION
  }

  return url.pathname + url.search + url.hash
}
