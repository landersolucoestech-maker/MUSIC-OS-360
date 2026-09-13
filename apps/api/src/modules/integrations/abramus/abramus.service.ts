import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../../../database/database.module';
import { EncryptionService }    from '../../../core/security/encryption.service';
import { IntegrationBaseService } from '../integration-base.service';

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
    await this.saveCredentials(tenantId, PROVIDER, { username, password, base_url: baseUrl });
  }

  async getProviderStatus(tenantId: string) {
    return this.getStatus(tenantId, PROVIDER);
  }

  async disconnectProvider(tenantId: string): Promise<void> {
    await this.disconnect(tenantId, PROVIDER);
  }

  private async getAuthToken(creds: AbramusCreds): Promise<string> {
    const res = await this.fetch(`${creds.base_url}/api/v1/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username: creds.username, password: creds.password }),
    });
    if (!res.ok) throw new Error(`Abramus auth error: ${res.status}`);
    const d = await res.json() as any;
    return d.token ?? d.access_token ?? '';
  }

  private async request<T>(tenantId: string, path: string, init: RequestInit = {}): Promise<T> {
    const creds = await this.loadCredentials<AbramusCreds>(tenantId, PROVIDER);
    if (!creds) throw new Error('Abramus não configurado para este tenant');
    const token = await this.getAuthToken(creds);
    const res = await this.fetch(`${creds.base_url}${path}`, {
      ...init,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
        ...(init.headers as object ?? {}),
      },
    });
    if (!res.ok) throw new Error(`Abramus API error ${res.status}: ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  async searchArtist(tenantId: string, query: string, limit = 10) {
    return this.request(tenantId, `/api/v1/artists?q=${encodeURIComponent(query)}&limit=${limit}`);
  }

  async searchWork(tenantId: string, query: string, limit = 10) {
    return this.request(tenantId, `/api/v1/works?q=${encodeURIComponent(query)}&limit=${limit}`);
  }

  async registerWork(tenantId: string, workData: {
    title: string; compositor: string; iswc?: string;
    genero?: string; duracao?: string; editora?: string; coautores?: string[];
  }) {
    return this.request(tenantId, '/api/v1/works', { method: 'POST', body: JSON.stringify(workData) });
  }

  async getStatements(tenantId: string, periodo?: string, limit = 20) {
    const qs = new URLSearchParams({ limit: String(limit), ...(periodo ? { periodo } : {}) });
    return this.request(tenantId, `/api/v1/statements?${qs}`);
  }
}
