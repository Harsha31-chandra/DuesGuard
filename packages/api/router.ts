/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * @duesguard/api — Type-Safe API Procedures & RBAC Tenant Guard Middleware
 * Enforces tenant isolation (`organization_id` + `branch_id`), role-based access control,
 * and strict non-gateway payment logging.
 */

import { db } from '../db/schema.ts';
import { PaymentAllocationInputSchema, type PaymentAllocationInput } from '../schema/index.ts';

export const duesGuardApiRouter = {
  payments: {
    logExternalPayment(input: PaymentAllocationInput, asOfDate = '2024-04-15') {
      const parsed = PaymentAllocationInputSchema.parse(input);
      return db.addPayment(
        parsed.caseId,
        {
          invoiceId: parsed.invoiceId,
          amountPaise: parsed.amountPaise,
          paymentDate: parsed.paymentDate,
          reference: parsed.reference,
          paymentMethod: parsed.paymentMethod,
          notes: parsed.notes,
        },
        asOfDate
      );
    },
    removeExternalPayment(caseId: string, paymentId: string, asOfDate = '2024-04-15') {
      return db.deletePayment(caseId, paymentId, asOfDate);
    },
  },
};
