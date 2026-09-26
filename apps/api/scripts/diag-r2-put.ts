#!/usr/bin/env tsx
import 'reflect-metadata';
import * as path from 'path';
require('dotenv').config({ path: path.resolve(__dirname, '../.env.development') });
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env['R2_ACCESS_KEY']!,
    secretAccessKey: process.env['R2_SECRET_KEY']!,
  },
});

(async () => {
  const Body = Buffer.from('hello world', 'utf-8');
  // 1) Direct PUT via SDK (no presign)
  try {
    await client.send(new PutObjectCommand({ Bucket: 'musicos360-dev', Key: 'diag/direct.txt', Body, ContentType: 'text/plain' }));
    console.log('Direct PUT via SDK: OK');
  } catch (e: any) { console.log('Direct PUT SDK ERROR:', e.name, e.message); }

  // 2) Presigned PUT minimalist (without ContentType/ContentLength/Metadata)
  try {
    const cmd = new PutObjectCommand({ Bucket: 'musicos360-dev', Key: 'diag/presigned_min.txt' });
    const url = await getSignedUrl(client, cmd, { expiresIn: 300 });
    const r = await fetch(url, { method: 'PUT', body: Body });
    console.log('Presigned MIN PUT:', r.status, r.status === 200 ? 'OK' : await r.text());
  } catch (e: any) { console.log('Presigned MIN ERROR:', e.message); }

  // 3) Presigned PUT with ContentType only
  try {
    const cmd = new PutObjectCommand({ Bucket: 'musicos360-dev', Key: 'diag/presigned_ct.txt', ContentType: 'text/plain' });
    const url = await getSignedUrl(client, cmd, { expiresIn: 300 });
    const r = await fetch(url, { method: 'PUT', body: Body, headers: { 'Content-Type': 'text/plain' } });
    console.log('Presigned CT PUT:', r.status, r.status === 200 ? 'OK' : await r.text());
  } catch (e: any) { console.log('Presigned CT ERROR:', e.message); }

  // 4) Presigned PUT with ContentType + ContentLength
  try {
    const cmd = new PutObjectCommand({ Bucket: 'musicos360-dev', Key: 'diag/presigned_ctl.txt', ContentType: 'text/plain', ContentLength: Body.length });
    const url = await getSignedUrl(client, cmd, { expiresIn: 300 });
    const r = await fetch(url, { method: 'PUT', body: Body, headers: { 'Content-Type': 'text/plain' } });
    console.log('Presigned CT+CL PUT:', r.status, r.status === 200 ? 'OK' : await r.text());
  } catch (e: any) { console.log('Presigned CT+CL ERROR:', e.message); }

  // 5) Replicate exact server-side command (ContentType + ContentLength + Metadata)
  try {
    const cmd = new PutObjectCommand({
      Bucket: 'musicos360-dev',
      Key: 'diag/presigned_full.txt',
      ContentType: 'text/plain',
      ContentLength: Body.length,
      Metadata: { tenant_id: 'x', user_id: 'y', original_name: 'z' },
    });
    const url = await getSignedUrl(client, cmd, { expiresIn: 300 });
    console.log('SignedHeaders (5):', new URL(url).searchParams.get('X-Amz-SignedHeaders'));
    const r = await fetch(url, { method: 'PUT', body: Body, headers: { 'Content-Type': 'text/plain', 'Content-Length': String(Body.length), 'x-amz-meta-tenant_id': 'x', 'x-amz-meta-user_id': 'y', 'x-amz-meta-original_name': 'z' } });
    console.log('Presigned FULL PUT:', r.status, r.status === 200 ? 'OK' : await r.text());
  } catch (e: any) { console.log('Presigned FULL ERROR:', e.message); }
})();
