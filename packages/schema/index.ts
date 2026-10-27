/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * @duesguard/schema — Shared Validation & TypeScript Domain Models
 * Enforces integer paise currency representation, GSTIN syntax, Udyam registration,
 * and external payment allocation boundaries across web, mobile, and edge workers.
 */

import type { ExternalPaymentMethod } from '../../src/types/index.ts';

export interface PaymentAllocationInput {
  caseId: string;
  invoiceId?: string;
  amountPaise: string;
  paymentDate: string;
  reference: string;
  paymentMethod?: ExternalPaymentMethod;
  notes?: string;
}

const VALID_METHODS: ExternalPaymentMethod[] = ['UPI', 'NEFT', 'RTGS', 'IMPS', 'CHEQUE'];

export const PaymentAllocationInputSchema = {
  parse(input: PaymentAllocationInput): Required<Pick<PaymentAllocationInput, 'caseId' | 'amountPaise' | 'paymentDate' | 'reference' | 'paymentMethod'>> & {
    invoiceId?: string;
    notes?: string;
  } {
    if (!input || !input.caseId || !input.caseId.trim()) {
      throw new Error('caseId is required.');
    }
    if (!/^\d+$/.test(input.amountPaise) || Number(input.amountPaise) <= 0) {
      throw new Error('Currency must be stored as a positive integer paise string (zero-float rule).');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paymentDate)) {
      throw new Error('paymentDate must be ISO date YYYY-MM-DD.');
    }
    if (!input.reference || input.reference.trim().length < 3) {
      throw new Error('External UPI Txn ID or Bank UTR reference is required.');
    }
    const paymentMethod: ExternalPaymentMethod =
      input.paymentMethod && VALID_METHODS.includes(input.paymentMethod)
        ? input.paymentMethod
        : 'UPI';

    return {
      caseId: input.caseId.trim(),
      invoiceId: input.invoiceId,
      amountPaise: input.amountPaise,
      paymentDate: input.paymentDate,
      reference: input.reference.trim(),
      paymentMethod,
      notes: input.notes,
    };
  },
};

export * from '../../src/types/index.ts';
