import 'server-only';

import { type CredentialProvider, type ExternalIdentity, isLdapEnabled } from './providers';

/**
 * LDAP / Active Directory bind provider.
 *
 * Flow: bind as the service account -> search for the user by email ->
 * re-bind as that user's DN with the supplied password. A successful second
 * bind is the proof of credential.
 *
 * `ldapts` is an optionalDependency; if it is not installed the provider
 * reports itself disabled instead of crashing the app.
 */

function attr(entry: Record<string, unknown>, key: string | undefined): string | null {
  if (!key) return null;
  const v = entry[key];
  if (Array.isArray(v)) return v.length ? String(v[0]) : null;
  return v == null ? null : String(v);
}

export const ldapProvider: CredentialProvider = {
  id: 'LDAP',
  get enabled() {
    return isLdapEnabled();
  },

  async verify(email, password): Promise<ExternalIdentity | null> {
    if (!isLdapEnabled()) return null;

    let Client: typeof import('ldapts').Client;
    try {
      ({ Client } = await import('ldapts'));
    } catch {
      console.warn('[auth] AUTH_LDAP_ENABLED is true but the `ldapts` package is not installed.');
      return null;
    }

    const url = process.env.LDAP_URL!;
    const searchBase = process.env.LDAP_SEARCH_BASE!;
    const filterTemplate = process.env.LDAP_SEARCH_FILTER ?? '(&(objectClass=user)(mail={{email}}))';
    const filter = filterTemplate.replace('{{email}}', escapeLdapFilter(email));

    const nameAttr = process.env.LDAP_ATTR_NAME ?? 'displayName';
    const staffAttr = process.env.LDAP_ATTR_STAFF_ID ?? 'employeeID';
    const deptAttr = process.env.LDAP_ATTR_DEPARTMENT ?? 'department';

    const searchClient = new Client({ url, timeout: 8000, connectTimeout: 8000 });
    let dn: string | null = null;
    let entry: Record<string, unknown> | null = null;

    try {
      await searchClient.bind(process.env.LDAP_BIND_DN!, process.env.LDAP_BIND_PASSWORD ?? '');
      const { searchEntries } = await searchClient.search(searchBase, {
        scope: 'sub',
        filter,
        attributes: ['dn', 'mail', nameAttr, staffAttr, deptAttr],
      });
      if (searchEntries.length !== 1) return null;
      entry = searchEntries[0] as unknown as Record<string, unknown>;
      dn = String(entry.dn);
    } catch (err) {
      console.error('[auth] LDAP search failed:', err);
      return null;
    } finally {
      await searchClient.unbind().catch(() => undefined);
    }

    if (!dn || !entry) return null;

    // Empty passwords must never be accepted: many directories treat an
    // empty bind password as an anonymous bind and return success.
    if (!password) return null;

    const bindClient = new Client({ url, timeout: 8000, connectTimeout: 8000 });
    try {
      await bindClient.bind(dn, password);
    } catch {
      return null; // wrong password
    } finally {
      await bindClient.unbind().catch(() => undefined);
    }

    return {
      provider: 'LDAP',
      externalId: dn,
      email: (attr(entry, 'mail') ?? email).toLowerCase(),
      name: attr(entry, nameAttr) ?? email.split('@')[0],
      staffId: attr(entry, staffAttr),
      department: attr(entry, deptAttr),
    };
  },
};

/** RFC 4515 escaping so an email can't inject filter syntax. */
function escapeLdapFilter(input: string): string {
  return input.replace(/[\\*()\0]/g, (c) => {
    switch (c) {
      case '\\':
        return '\\5c';
      case '*':
        return '\\2a';
      case '(':
        return '\\28';
      case ')':
        return '\\29';
      default:
        return '\\00';
    }
  });
}
