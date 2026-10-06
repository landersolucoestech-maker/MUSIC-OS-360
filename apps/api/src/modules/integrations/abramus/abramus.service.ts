import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { promises as dns } from 'node:dns';
import { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../../../database/database.module';
import { EncryptionService }    from '../../../core/security/encryption.service';
import { IntegrationBaseService } from '../integration-base.service';
import { redactDiagnosticText } from '../../../core/filters/redact-diagnostic';
import { DEFAULT_TIMEOUT_MS } from '../../../core/resilience/resilient-fetch';
import { pinnedHttpsFetch } from '../../../core/resilience/pinned-https-fetch';
import {
  assertPublicHttpsUrl,
  createPublicOnlyLookup,
  assertResolvesToPublicAddresses,
  UnsafeInputError,
} from '../../../core/resilience/safe-url';

const PROVIDER = 'abramus';

interface AbramusCreds {
  username: string;
  password: string;
  base_url: string;
}

@Injectable()
export class AbramusService extends IntegrationBaseService {
  constructor(
    @Inject(DATA_SOURCE) ds: DataSource | null,
    enc: EncryptionService,
  ) {
    super(ds, enc);
  }

  async configure(tenantId: string, username: string, password: string, baseUrl: string): Promise<void> {
    // The endpoint is tenant-supplied: nothing is stored or called until it is proven to be a public https host.
    const safeBaseUrl = await this.validatedBaseUrl(baseUrl);
    // Connected only after a real login succeeds: saving credentials is not a connection.
    await this.saveCredentials(tenantId, PROVIDER, { username, password, base_url: safeBaseUrl }, async () => {
      const token = await this.getAuthToken({ username, password, base_url: safeBaseUrl });
      if (!token) throw new Error('Abramus auth returned no token');
    });
  }

  async getProviderStatus(tenantId: string) {
    return this.getStatus(tenantId, PROVIDER);
  }

  async disconnectProvider(tenantId: string): Promise<void> {
    await this.disconnect(tenantId, PROVIDER);
  }

  /** Resolver used to prove the host is public; overridable so tests need no network. */
  protected resolveHost(name: string): Promise<string[]> {
    return dns.lookup(name, { all: true }).then((r) => r.map((a) => a.address));
  }

  /**
   * The endpoint is tenant-supplied, so the call resolves the name itself and refuses a private answer at connect
   * time: the address that was validated is the address that is connected (no second resolution to rebind).
   */
  protected fetch(url: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
    const lookup = createPublicOnlyLookup((name) => this.resolveHost(name));
    return this.cb.execute(() => pinnedHttpsFetch(url, init, { lookup, timeoutMs }));
  }

  private async validatedBaseUrl(raw: string): Promise<string> {
    try {
      const url = assertPublicHttpsUrl(raw, 'baseUrl');
      await assertResolvesToPublicAddresses(new URL(url).hostname, (n) => this.resolveHost(n));
      return url;
    } catch (error) {
      if (error instanceof UnsafeInputError) {
        throw new BadRequestException({ code: 'INTEGRATION_URL_NOT_ALLOWED', message: error.message });
      }
      throw error;
    }
  }

  /** The URL was validated, a redirect target was not: following it would reach an address that was never checked. */
  private assertNoRedirect(res: Response): void {
    if (res.status >= 300 && res.status < 400) throw new Error(`Abramus answered with a redirect (${res.status}), which is not followed`);
  }

  private async getAuthToken(creds: AbramusCreds): Promise<string> {
    const base = await this.validatedBaseUrl(creds.base_url);
    const res = await this.fetch(`${base}/api/v1/auth/login`, {
      method:  'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username: creds.username, password: creds.password }),
    });
    this.assertNoRedirect(res);
    if (!res.ok) throw new Error(`Abramus auth error: ${res.status}`);
    const d = await res.json() as any;
    return d.token ?? d.access_token ?? '';
  }

  private async request<T>(tenantId: string, path: string, init: RequestInit = {}): Promise<T> {
    const creds = await this.loadCredentials<AbramusCreds>(tenantId, PROVIDER);
    if (!creds) throw new Error('Abramus not configured for this tenant');
    const token = await this.getAuthToken(creds);
    const base = await this.validatedBaseUrl(creds.base_url);
    const res = await this.fetch(`${base}${path}`, {
      ...init,
      redirect: 'manual',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
        ...(init.headers as object ?? {}),
      },
    });
    this.assertNoRedirect(res);
    if (!res.ok) throw new Error(`Abramus API error ${res.status}: ${redactDiagnosticText(await res.text())}`);
    return res.json() as Promise<T>;
  }

  async searchArtist(tenantId: string, query: string, limit = 10) {
    return this.request(tenantId, `/api/v1/artists?q=${encodeURIComponent(query)}&limit=${limit}`);
  }

  async searchWork(tenantId: string, query: string, limit = 10) {
    return this.request(tenantId, `/api/v1/works?q=${encodeURIComponent(query)}&limit=${limit}`);
  }

  /**
   * Adapter boundary: the ONLY place that knows the Abramus external field names
   * (compositor/coautores/genero/duracao/editora — permanent external contract).
   */
  async registerWork(tenantId: string, work: {
    title: string; composer: string; co_composers?: string[]; iswc?: string;
    genre?: string; duration?: string; publisher?: string;
  }) {
    const externalBody = {
      title: work.title,
      compositor: work.composer,
      iswc: work.iswc,
      genero: work.genre,
      duracao: work.duration,
      editora: work.publisher,
      coautores: work.co_composers,
    };
    return this.request(tenantId, '/api/v1/works', { method: 'POST', body: JSON.stringify(externalBody) });
  }

  async getStatements(tenantId: string, period?: string, limit = 20) {
    // The Abramus external contract names this query parameter `periodo`.
    const qs = new URLSearchParams({ limit: String(limit), ...(period ? { periodo: period } : {}) });
    return this.request(tenantId, `/api/v1/statements?${qs}`);
  }
}
