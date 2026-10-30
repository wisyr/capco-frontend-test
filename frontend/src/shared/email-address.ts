/**
 * The shape the API accepts for email addresses: text, @, and a domain
 * containing a dot, with no whitespace. Stricter checks would reject
 * addresses the API allows, such as internationalized domains.
 */
export const emailAddressPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
