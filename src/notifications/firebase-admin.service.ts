/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  cert,
  getApps,
  initializeApp,
  type ServiceAccount,
} from 'firebase-admin/app';
import {
  getMessaging,
  type BatchResponse,
  type SendResponse,
} from 'firebase-admin/messaging';
import type { AppEnv } from '../config/env';

type ServiceAccountJson = {
  project_id?: string;
  projectId?: string;
  client_email?: string;
  clientEmail?: string;
  private_key?: string;
  privateKey?: string;
  [k: string]: unknown;
};

@Injectable()
export class FirebaseAdminService {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private initialized = false;

  constructor(private readonly config: ConfigService<AppEnv, true>) {
    this.tryInit();
  }

  /**
   * Indica si Firebase Admin quedó inicializado (env + credenciales válidas).
   */
  isConfigured(): boolean {
    return this.initialized;
  }

  private tryInit(): void {
    if (this.initialized) return;

    // Si ya hay una app inicializada (hot reload / tests), reutilizar.
    if (getApps().length > 0) {
      this.initialized = true;
      return;
    }

    const base64 = this.config.get('FIREBASE_SERVICE_ACCOUNT_BASE64', {
      infer: true,
    });
    const json = this.config.get('FIREBASE_SERVICE_ACCOUNT_JSON', {
      infer: true,
    });

    const raw = (
      base64 ? Buffer.from(base64, 'base64').toString('utf8') : json
    )?.trim();

    if (!raw) {
      // Es opcional: no lo tratamos como error.
      this.logger.log(
        'Firebase Admin no configurado (FIREBASE_SERVICE_ACCOUNT_* vacío). Saltando envío FCM.',
      );
      return;
    }

    let parsed: ServiceAccountJson;
    try {
      parsed = JSON.parse(raw) as ServiceAccountJson;
    } catch {
      this.logger.error(
        'Firebase Admin: FIREBASE_SERVICE_ACCOUNT_* no es JSON válido',
      );
      return;
    }

    // firebase-admin espera la private_key con saltos de línea reales.
    // Si viene escapada con \n, lo normalizamos.
    if (typeof parsed.private_key === 'string') {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }
    if (typeof parsed.privateKey === 'string') {
      parsed.privateKey = parsed.privateKey.replace(/\\n/g, '\n');
    }

    try {
      const projectId =
        typeof parsed.project_id === 'string'
          ? parsed.project_id
          : typeof parsed.projectId === 'string'
            ? parsed.projectId
            : '';
      const clientEmail =
        typeof parsed.client_email === 'string'
          ? parsed.client_email
          : typeof parsed.clientEmail === 'string'
            ? parsed.clientEmail
            : '';
      const privateKey =
        typeof parsed.private_key === 'string'
          ? parsed.private_key
          : typeof parsed.privateKey === 'string'
            ? parsed.privateKey
            : '';

      if (!projectId || !clientEmail || !privateKey) {
        this.logger.error(
          'Firebase Admin: faltan campos requeridos en FIREBASE_SERVICE_ACCOUNT_* (project_id/client_email/private_key)',
        );
        return;
      }

      const serviceAccount: ServiceAccount = {
        projectId,
        clientEmail,
        privateKey,
      };

      initializeApp({ credential: cert(serviceAccount) });
      this.initialized = true;
      this.logger.log('Firebase Admin inicializado correctamente');
    } catch (err) {
      this.logger.error(
        'Error inicializando Firebase Admin (credenciales inválidas o mal formateadas)',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /**
   * Envía una notificación a múltiples tokens FCM.
   * - Firebase limita multicast a 500 tokens por request.
   */
  async sendToFcmTokens(input: {
    tokens: string[];
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }): Promise<{
    successCount: number;
    failureCount: number;
    invalidTokens: string[];
    errorCodeCounts: Record<string, number>;
    errorMessageSamples: Record<string, string>;
  }> {
    if (!this.initialized) {
      return {
        successCount: 0,
        failureCount: input.tokens.length,
        invalidTokens: [],
        errorCodeCounts: {},
        errorMessageSamples: {},
      };
    }

    const tokens = input.tokens.map((t) => String(t).trim()).filter(Boolean);
    if (tokens.length === 0) {
      return {
        successCount: 0,
        failureCount: 0,
        invalidTokens: [],
        errorCodeCounts: {},
        errorMessageSamples: {},
      };
    }

    const data: Record<string, string> | undefined = input.data
      ? Object.fromEntries(
          Object.entries(input.data).map(([k, v]) => [k, String(v)]),
        )
      : undefined;

    const chunk = <T>(arr: T[], size: number) => {
      const out: T[][] = [];
      for (let i = 0; i < arr.length; i += size)
        out.push(arr.slice(i, i + size));
      return out;
    };

    let successCount = 0;
    let failureCount = 0;
    const invalidTokens: string[] = [];
    const errorCodeCounts: Record<string, number> = {};
    const errorMessageSamples: Record<string, string> = {};

    for (const group of chunk(tokens, 500)) {
      try {
        const res: BatchResponse = await getMessaging().sendEachForMulticast({
          tokens: group,
          notification: {
            title: input.title,
            body: input.body,
          },
          data,
          android: {
            priority: 'high',
            notification: {
              channelId: 'default',
              sound: 'default',
            },
          },
        });

        successCount += res.successCount;
        failureCount += res.failureCount;

        res.responses.forEach((r: SendResponse, idx: number) => {
          if (r.success) return;
          const code = r.error?.code ?? 'unknown';

          const msg =
            typeof (r.error as any)?.message === 'string'
              ? String((r.error as any).message)
              : undefined;
          if (msg && !errorMessageSamples[code]) {
            errorMessageSamples[code] = msg;
          }

          errorCodeCounts[code] = (errorCodeCounts[code] ?? 0) + 1;
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token'
          ) {
            invalidTokens.push(group[idx]);
          }
        });
      } catch (err) {
        this.logger.error(
          'Error enviando multicast FCM',
          err instanceof Error ? err.stack : String(err),
        );

        errorCodeCounts['exception'] =
          (errorCodeCounts['exception'] ?? 0) + group.length;

        if (!errorMessageSamples['exception']) {
          errorMessageSamples['exception'] =
            err instanceof Error ? err.message : String(err);
        }
        failureCount += group.length;
      }
    }

    return {
      successCount,
      failureCount,
      invalidTokens,
      errorCodeCounts,
      errorMessageSamples,
    };
  }
}
