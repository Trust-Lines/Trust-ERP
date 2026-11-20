// Every other Purelymail operation the IT → Mails screen offers, as an allow-list: each entry says
// who may run it (page.it to read, edit.it to change), how its input is checked, what goes in the
// audit log (never a password or app password) and what of the result the browser gets.
// Field names are Purelymail's own (spec: https://news.purelymail.com/api/index.html).
// Create mailbox / change password keep their own routes (./purelymail).

import { isMailboxAddress } from './purelymail';

type Payload = Record<string, unknown>;
type Clean = { value: Payload } | { error: string };

export interface PurelymailOp {
  need: 'manage' | 'edit';
  clean: (raw: Payload) => Clean;
  /** Audit entry for a change; `resource` is what it was done to. */
  audit?: (p: Payload) => { action: string; resource: string; value: Payload };
  /** What the browser gets back (default: nothing). */
  pick?: (result: Record<string, unknown>) => unknown;
}

const DOMAIN = /^(?=.{3,253}$)[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
const LOCAL = /^[a-z0-9._+-]{0,64}$/i;
const PHONE = /^\+?[0-9 ()-]{6,24}$/;

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const bool = (v: unknown) => (typeof v === 'boolean' ? v : undefined);
const address = (v: unknown) => { const a = str(v, 254).toLowerCase(); return isMailboxAddress(a) ? a : null; };
const domain = (v: unknown) => { const d = str(v, 253).toLowerCase(); return DOMAIN.test(d) ? d : null; };
const only = <T extends Payload>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Payload;

const needAddress = (key: string, raw: Payload): Clean => {
  const a = address(raw[key]);
  return a ? { value: { [key]: a } } : { error: 'Which mailbox?' };
};

export const PURELYMAIL_OPS: Record<string, PurelymailOp> = {
  // ── Mailboxes ──
  getUser: {
    need: 'manage',
    clean: raw => needAddress('userName', raw),
    pick: r => r,
  },
  modifyUser: {
    need: 'edit',
    clean: raw => {
      const userName = address(raw.userName);
      if (!userName) return { error: 'Which mailbox?' };
      const newUserName = raw.newUserName === undefined || raw.newUserName === '' ? undefined : address(raw.newUserName);
      if (newUserName === null) return { error: 'The new address isn’t valid' };
      const value = only({
        userName, newUserName: newUserName && newUserName !== userName ? newUserName : undefined,
        enableSearchIndexing: bool(raw.enableSearchIndexing),
        enablePasswordReset: bool(raw.enablePasswordReset),
        requireTwoFactorAuthentication: bool(raw.requireTwoFactorAuthentication),
      });
      return Object.keys(value).length > 1 ? { value } : { error: 'Nothing to change' };
    },
    audit: p => ({ action: 'it.mailbox_modified', resource: `purelymail:${p.userName}`, value: p }),
  },
  deleteUser: {
    need: 'edit',
    clean: raw => needAddress('userName', raw),
    audit: p => ({ action: 'it.mailbox_deleted', resource: `purelymail:${p.userName}`, value: p }),
  },
  upsertPasswordReset: {
    need: 'edit',
    clean: raw => {
      const userName = address(raw.userName);
      const type = raw.type === 'phone' ? 'phone' : raw.type === 'email' ? 'email' : null;
      const target = str(raw.target, 254);
      if (!userName) return { error: 'Which mailbox?' };
      if (!type) return { error: 'Pick email or phone' };
      if (type === 'email' ? !isMailboxAddress(target) : !PHONE.test(target)) return { error: type === 'email' ? 'Enter a valid email address' : 'Enter a valid phone number' };
      return { value: only({ userName, type, target, existingTarget: str(raw.existingTarget, 254) || undefined, description: str(raw.description, 100), allowMfaReset: bool(raw.allowMfaReset) ?? true }) };
    },
    audit: p => ({ action: 'it.mailbox_reset_method_saved', resource: `purelymail:${p.userName}`, value: { userName: p.userName, type: p.type } }),
  },
  deletePasswordReset: {
    need: 'edit',
    clean: raw => {
      const userName = address(raw.userName);
      const target = str(raw.target, 254);
      return userName && target ? { value: { userName, target } } : { error: 'Which reset method?' };
    },
    audit: p => ({ action: 'it.mailbox_reset_method_deleted', resource: `purelymail:${p.userName}`, value: { userName: p.userName } }),
  },
  createAppPassword: {
    need: 'edit',
    clean: raw => {
      const userHandle = address(raw.userHandle);
      return userHandle ? { value: { userHandle, name: str(raw.name, 80) } } : { error: 'Which mailbox?' };
    },
    audit: p => ({ action: 'it.mailbox_app_password_created', resource: `purelymail:${p.userHandle}`, value: { userHandle: p.userHandle, name: p.name } }),
    // Shown once to copy — never stored or logged.
    pick: r => ({ appPassword: typeof r.appPassword === 'string' ? r.appPassword : null }),
  },
  deleteAppPassword: {
    need: 'edit',
    clean: raw => {
      const userName = address(raw.userName);
      const appPassword = typeof raw.appPassword === 'string' ? raw.appPassword.trim() : '';
      if (!userName) return { error: 'Which mailbox?' };
      if (!appPassword || appPassword.length > 200) return { error: 'Paste the app password to revoke' };
      return { value: { userName, appPassword } };
    },
    audit: p => ({ action: 'it.mailbox_app_password_deleted', resource: `purelymail:${p.userName}`, value: { userName: p.userName } }),
  },

  // ── Routing ──
  listRoutingRules: { need: 'manage', clean: () => ({ value: {} }), pick: r => ({ rules: Array.isArray(r.rules) ? r.rules : [] }) },
  createRoutingRule: {
    need: 'edit',
    clean: raw => {
      const domainName = domain(raw.domainName);
      const matchUser = str(raw.matchUser, 64).toLowerCase();
      const targets = (Array.isArray(raw.targetAddresses) ? raw.targetAddresses : []).map(address);
      if (!domainName) return { error: 'Pick the domain' };
      if (!LOCAL.test(matchUser)) return { error: 'The address part may only use letters, numbers, dots, dashes, + and _' };
      if (!targets.length || targets.some(t => !t)) return { error: 'Enter one or more valid addresses to forward to' };
      if (targets.length > 20) return { error: 'At most 20 forwarding addresses' };
      return { value: { domainName, matchUser, prefix: raw.prefix === true, catchall: raw.catchall === true, targetAddresses: [...new Set(targets)] } };
    },
    audit: p => ({ action: 'it.mail_routing_created', resource: `purelymail:${p.matchUser || '*'}@${p.domainName}`, value: p }),
  },
  deleteRoutingRule: {
    need: 'edit',
    clean: raw => {
      const id = Number(raw.routingRuleId);
      return Number.isSafeInteger(id) && id > 0 ? { value: { routingRuleId: id } } : { error: 'Which rule?' };
    },
    audit: p => ({ action: 'it.mail_routing_deleted', resource: `purelymail_rule:${p.routingRuleId}`, value: p }),
  },

  // ── Domains ──
  listDomains: { need: 'manage', clean: () => ({ value: { includeShared: false } }), pick: r => ({ domains: Array.isArray(r.domains) ? r.domains : [] }) },
  getOwnershipCode: { need: 'edit', clean: () => ({ value: {} }), pick: r => ({ code: typeof r.code === 'string' ? r.code : null }) },
  addDomain: {
    need: 'edit',
    clean: raw => { const d = domain(raw.domainName); return d ? { value: { domainName: d } } : { error: 'Enter a domain like example.com' }; },
    audit: p => ({ action: 'it.mail_domain_added', resource: `purelymail_domain:${p.domainName}`, value: p }),
  },
  updateDomainSettings: {
    need: 'edit',
    clean: raw => {
      const name = domain(raw.name);
      if (!name) return { error: 'Which domain?' };
      const value = only({ name, allowAccountReset: bool(raw.allowAccountReset), symbolicSubaddressing: bool(raw.symbolicSubaddressing), recheckDns: bool(raw.recheckDns) });
      return Object.keys(value).length > 1 ? { value } : { error: 'Nothing to change' };
    },
    audit: p => ({ action: 'it.mail_domain_updated', resource: `purelymail_domain:${p.name}`, value: p }),
  },
  deleteDomain: {
    need: 'edit',
    clean: raw => { const d = domain(raw.name); return d ? { value: { name: d } } : { error: 'Which domain?' }; },
    audit: p => ({ action: 'it.mail_domain_deleted', resource: `purelymail_domain:${p.name}`, value: p }),
  },

  // ── Account ──
  checkAccountCredit: { need: 'manage', clean: () => ({ value: {} }), pick: r => ({ credit: typeof r.credit === 'string' ? r.credit : null }) },
};

