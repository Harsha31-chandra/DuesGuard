/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { db } from './src/services/database.ts';
import { runCaseAnalysisGraph } from './src/services/agentWorkflow.ts';
import { calculateCaseFinancialSummary, formatINR } from './src/services/finance.ts';
import { generateMultiTurnChatResponse } from './src/services/geminiService.ts';
import { workspaceAuth } from './src/services/workspaceAuth.ts';
import { demoQrService } from './src/services/demoQrService.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // JSON Body parsing with support for PDF base64 / documents
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // --- API ROUTE HANDLERS ---

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      version: '1.0.0',
      service: 'DuesGuard AI Financial Intelligence Engine',
      timestamp: new Date().toISOString(),
    });
  });

  // Get all cases
  app.get('/api/cases', (_req, res) => {
    const cases = db.getAllCases();
    res.json(cases);
  });

  // Create new case
  app.post('/api/cases', (req, res) => {
    try {
      const created = db.createCase(req.body);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Reset demo case
  app.post('/api/cases/reset-demo', (_req, res) => {
    db.seedDemoCase();
    const demo = db.getCaseById('case-001');
    res.json({ message: 'Demo reset to InnoSprint synthetic test pack.', case: demo });
  });

  // Get case by ID
  app.get('/api/cases/:id', (req, res) => {
    const caseRecord = db.getCaseById(req.params.id);
    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const documents = db.getDocuments(req.params.id);
    const invoices = db.getInvoices(req.params.id);
    const deliveries = db.getDeliveries(req.params.id);
    const purchaseOrders = db.getPurchaseOrders(req.params.id);
    const payments = db.getPayments(req.params.id);
    const findings = db.getFindings(req.params.id);
    const evidenceLinks = db.getEvidenceLinks(req.params.id);
    const latestAnalysis = db.getLatestAnalysisRun(req.params.id);
    const auditLogs = db.getAuditLogs(req.params.id);
    const chatHistory = db.getChatHistory(req.params.id);
    const tenants = db.getTenants();

    res.json({
      case: caseRecord,
      documents,
      invoices,
      deliveries,
      purchaseOrders,
      payments,
      findings,
      evidenceLinks,
      latestAnalysis,
      auditLogs,
      chatHistory,
      tenants,
    });
  });

  // Update case
  app.patch('/api/cases/:id', (req, res) => {
    const updated = db.updateCase(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Case not found' });
    }
    res.json(updated);
  });

  // Get documents
  app.get('/api/cases/:id/documents', (req, res) => {
    const documents = db.getDocuments(req.params.id);
    res.json(documents);
  });

  // Upload document
  app.post('/api/cases/:id/documents', (req, res) => {
    try {
      const doc = db.addDocument(req.params.id, req.body);
      res.status(201).json(doc);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Log external payment receipt (Evidence-Preparation Only — never executes UPI/gateway transfers)
  app.post('/api/cases/:id/payments', (req, res) => {
    try {
      const { amountPaise, paymentDate, reference, paymentMethod, invoiceId, notes, asOfDate } = req.body;
      if (!amountPaise || Number(amountPaise) <= 0) {
        return res.status(400).json({ error: 'Valid positive integer amountPaise is required.' });
      }
      const result = db.addPayment(
        req.params.id,
        {
          amountPaise: String(amountPaise),
          paymentDate,
          reference,
          paymentMethod,
          invoiceId,
          notes,
        },
        asOfDate || '2024-04-15'
      );
      res.status(201).json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Remove logged payment and recalculate ledger
  app.delete('/api/cases/:id/payments/:paymentId', (req, res) => {
    try {
      const asOfDate = (req.query.asOfDate as string) || '2024-04-15';
      const result = db.deletePayment(req.params.id, req.params.paymentId, asOfDate);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Run LangGraph Agent Analysis
  app.post('/api/cases/:id/analysis', async (req, res) => {
    try {
      const caseRecord = db.getCaseById(req.params.id);
      if (!caseRecord) {
        return res.status(404).json({ error: 'Case not found' });
      }

      const documents = db.getDocuments(req.params.id);
      const invoices = db.getInvoices(req.params.id);
      const purchaseOrders = db.getPurchaseOrders(req.params.id);
      const deliveries = db.getDeliveries(req.params.id);
      const payments = db.getPayments(req.params.id);
      const asOfDate = req.body.asOfDate || new Date().toISOString().split('T')[0];

      caseRecord.status = 'analyzing';

      // Execute LangGraph multi-agent pipeline
      const analysisRun = await runCaseAnalysisGraph(
        caseRecord,
        documents,
        invoices,
        purchaseOrders,
        deliveries,
        payments,
        asOfDate
      );

      // Persist analysis run and update database records
      db.saveAnalysisRun(analysisRun);
      caseRecord.status = 'in_review';

      res.json(analysisRun);
    } catch (err: any) {
      console.error('Error during case analysis:', err);
      res.status(500).json({ error: err.message || 'Analysis failed' });
    }
  });

  // Get analysis results
  app.get('/api/cases/:id/analysis/:analysisId', (req, res) => {
    const run = db.getAnalysisRun(req.params.analysisId);
    if (!run) {
      return res.status(404).json({ error: 'Analysis run not found' });
    }
    res.json(run);
  });

  // Update finding status / reviewer notes
  app.patch('/api/cases/:id/findings/:findingId', (req, res) => {
    const updated = db.updateFinding(req.params.id, req.params.findingId, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Finding not found' });
    }
    res.json(updated);
  });

  // Human-in-the-Loop Approval Checkpoint Gate
  app.post('/api/cases/:id/approve', (req, res) => {
    const { analysisId, reviewerName, reviewerDesignation, reviewerNotes } = req.body;
    if (!analysisId || !reviewerName) {
      return res.status(400).json({ error: 'analysisId and reviewerName are mandatory for approval' });
    }

    const approved = db.approveAnalysis({
      caseId: req.params.id,
      analysisId,
      reviewerName,
      reviewerDesignation: reviewerDesignation || 'MSME Financial Reviewer',
      reviewerNotes: reviewerNotes || 'Verified against uploaded tax invoices, purchase orders, and delivery proof.',
    });

    if (!approved) {
      return res.status(404).json({ error: 'Analysis run not found' });
    }

    res.json({
      message: 'Case analysis approved and sealed.',
      analysis: approved,
    });
  });

  // Generate Report
  app.post('/api/cases/:id/reports', (req, res) => {
    const { analysisId, reportType } = req.body;
    const caseRecord = db.getCaseById(req.params.id);
    const analysis = analysisId ? db.getAnalysisRun(analysisId) : db.getLatestAnalysisRun(req.params.id);

    if (!caseRecord || !analysis) {
      return res.status(404).json({ error: 'Case or Analysis not found' });
    }

    const reportId = `rep-${Date.now()}`;
    const report = {
      id: reportId,
      caseId: req.params.id,
      analysisId: analysis.id,
      reportType: (reportType as any) || 'internal_case_summary',
      version: 1,
      approvedBy: analysis.reviewerName || 'Authorized Signatory',
      approvedAt: analysis.reviewedAt || new Date().toISOString(),
      reviewerNotes: analysis.reviewerNotes || 'Audit-ready summary generated pursuant to MSMED Act 2006.',
      createdAt: new Date().toISOString(),
    };

    db.saveReport(report);
    res.json({ report, message: 'Report generated successfully.' });
  });

  // List reports
  app.get('/api/cases/:id/reports', (req, res) => {
    const reports = db.getReports(req.params.id);
    res.json(reports);
  });

  // Direct calculation endpoint
  app.post('/api/finance/calculate', (req, res) => {
    try {
      const { invoices, payments, deliveryDate, contractualDays, asOfDate } = req.body;
      const result = calculateCaseFinancialSummary({
        invoices: invoices || [],
        payments: payments || [],
        deliveryDate: deliveryDate || new Date().toISOString().split('T')[0],
        contractualDays: contractualDays || 30,
        asOfDate,
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Multi-Turn Gemini Chatbot endpoints
  app.get('/api/cases/:id/chat', (req, res) => {
    const history = db.getChatHistory(req.params.id);
    res.json(history);
  });

  app.delete('/api/cases/:id/chat', (req, res) => {
    const history = db.clearChatHistory(req.params.id);
    res.json(history);
  });

  app.post('/api/chat', async (req, res) => {
    try {
      const { caseId, message, modelTier, rolePersona } = req.body;
      if (!caseId || !message || !message.trim()) {
        return res.status(400).json({ error: 'caseId and non-empty message are required' });
      }

      const caseRecord = db.getCaseById(caseId);
      if (!caseRecord) {
        return res.status(404).json({ error: 'Case not found' });
      }

      const selectedTier = modelTier || 'gemini-3.8-flash';
      const selectedPersona = rolePersona || 'msme_evidence_analyst';
      const historyBefore = db.getChatHistory(caseId);

      // Record user message
      const userMsg = {
        id: `msg-user-${Date.now()}`,
        caseId,
        role: 'user' as const,
        text: message.trim(),
        timestamp: new Date().toISOString(),
        modelTier: selectedTier,
        rolePersona: selectedPersona,
      };
      db.appendChatMessage(caseId, userMsg);

      const invoices = db.getInvoices(caseId);
      const analysis = db.getLatestAnalysisRun(caseId) || null;

      const aiResult = await generateMultiTurnChatResponse({
        caseRecord,
        invoices,
        analysis,
        history: historyBefore,
        userMessage: message.trim(),
        modelTier: selectedTier,
        rolePersona: selectedPersona,
      });

      const modelMsg = {
        id: `msg-model-${Date.now()}`,
        caseId,
        role: 'model' as const,
        text: aiResult.replyText,
        timestamp: new Date().toISOString(),
        modelTier: selectedTier,
        resolvedModel: aiResult.resolvedModel,
        rolePersona: selectedPersona,
        latencyMs: aiResult.latencyMs,
        citations: aiResult.citations,
      };
      const updatedHistory = db.appendChatMessage(caseId, modelMsg);

      res.json({
        reply: modelMsg,
        history: updatedHistory,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Chat generation failed' });
    }
  });

  // Multi-Tenant & RBAC endpoints
  app.get('/api/tenants', (_req, res) => {
    res.json(db.getTenants());
  });

  app.post('/api/tenants/verify-isolation', (req, res) => {
    const { requestingTenantId, targetCaseId } = req.body;
    const result = db.verifyCrossTenantIsolation(
      requestingTenantId || 'tenant-srilakshmi-002',
      targetCaseId || 'case-001'
    );
    res.json(result);
  });

  // Private R2 Presigned Upload Lifecycle endpoints
  app.post('/api/storage/presign', (req, res) => {
    const { tenantId, caseId, filename, mimeType, fileSizeBytes } = req.body;
    const ticket = db.createPresignedUploadTicket({
      tenantId: tenantId || 'tenant-apex-001',
      caseId: caseId || 'case-001',
      filename: filename || 'Signed_POD_DC-4480.pdf',
      mimeType: mimeType || 'application/pdf',
      fileSizeBytes: fileSizeBytes || 245000,
    });
    res.json(ticket);
  });

  app.post('/api/storage/complete', (req, res) => {
    const { ticketId, fileHeaderMagicBytes, contentSnippet, filename, fileSizeBytes } = req.body;
    const verification = db.completeR2UploadVerification({
      ticketId: ticketId || 'r2-tkt-demo',
      fileHeaderMagicBytes: fileHeaderMagicBytes || '%PDF-1.7',
      contentSnippet: contentSnippet || 'SIGNED POD DC-4480',
      filename: filename || 'Signed_POD_DC-4480.pdf',
      fileSizeBytes: fileSizeBytes || 245000,
    });
    res.json(verification);
  });

  // --- AUTHENTICATION & MULTI-ORGANIZATION WORKSPACE ENDPOINTS ---
  app.get('/api/workspaces/current', (_req, res) => {
    res.json(workspaceAuth.getActiveWorkspaceSession());
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const result = workspaceAuth.authenticateUser({ email, password });
    res.status(result.success ? 200 : 401).json(result);
  });

  app.post('/api/auth/logout', (_req, res) => {
    const result = workspaceAuth.logoutUser();
    res.json(result);
  });

  app.post('/api/auth/register', (req, res) => {
    const result = workspaceAuth.registerUser(req.body);
    res.status(result.success ? 201 : 400).json(result);
  });

  app.post('/api/auth/verify-email', (req, res) => {
    const { email } = req.body;
    res.json(workspaceAuth.verifyEmailForAddress(email));
  });

  app.post('/api/auth/forgot-password', (req, res) => {
    const { email } = req.body;
    res.json(workspaceAuth.requestPasswordReset(email));
  });

  app.post('/api/auth/reset-password', (req, res) => {
    const result = workspaceAuth.completePasswordReset(req.body);
    res.status(result.success ? 200 : 400).json(result);
  });

  app.post('/api/auth/verify-2fa', (req, res) => {
    const { code } = req.body;
    const result = workspaceAuth.verifyTwoFactorChallenge({ code });
    res.status(result.success ? 200 : 400).json(result);
  });

  app.post('/api/workspaces/switch', (req, res) => {
    const { organizationId, branchId } = req.body;
    const result = workspaceAuth.switchWorkspace({ organizationId, branchId });
    res.status(result.success ? 200 : 403).json(result);
  });

  app.post('/api/organizations/onboard', (req, res) => {
    const result = workspaceAuth.createOrganizationWithInitialBranch(req.body);
    res.status(result.success ? 201 : 400).json(result);
  });

  app.post('/api/organizations/:id/branches', (req, res) => {
    const result = workspaceAuth.addBranchToOrganization({
      organizationId: req.params.id,
      ...req.body,
    });
    res.status(result.success ? 201 : 403).json(result);
  });

  app.get('/api/organizations/:id/members', (req, res) => {
    res.json(workspaceAuth.getOrganizationMembers(req.params.id));
  });

  app.post('/api/organizations/:id/members', (req, res) => {
    const result = workspaceAuth.inviteOrUpdateMember({
      organizationId: req.params.id,
      ...req.body,
    });
    res.status(result.success ? 200 : 403).json(result);
  });

  app.post('/api/workspaces/check-permission', (req, res) => {
    const { userId, organizationId, branchId, action } = req.body;
    const result = workspaceAuth.authorizeAction({
      userId,
      organizationId,
      branchId,
      action,
    });
    res.status(result.httpStatus).json(result);
  });

  // --- HACKATHON DEMO QR PAYMENT SYSTEM ENDPOINTS ---

  // 1. Generate Invoice-Linked QR Code (Enforces RBAC & SHA-256 Token Hashing)
  app.post('/api/demo-qr/generate', async (req, res) => {
    try {
      const originHeader = req.headers.origin;
      const hostHeader = req.get('host');
      const protocol =
        (req.headers['x-forwarded-proto'] as string)?.split(',')[0] || req.protocol || 'http';
      const detectedBaseUrl =
        req.body.baseUrl ||
        originHeader ||
        process.env.APP_URL ||
        (hostHeader ? `${protocol}://${hostHeader}` : 'http://localhost:3000');

      const result = await demoQrService.generateInvoiceQrCode({
        ...req.body,
        baseUrl: detectedBaseUrl,
      });
      res.status(201).json(result);
    } catch (err: any) {
      const status = err.httpStatus || 400;
      res.status(status).json({
        error: err.message || 'Failed to generate invoice QR code',
      });
    }
  });

  // 2. Revoke an Active QR Token
  app.post('/api/demo-qr/revoke', (req, res) => {
    try {
      const revoked = demoQrService.revokeQrToken(req.body);
      res.json({
        message: 'QR payment request token revoked.',
        token: revoked,
      });
    } catch (err: any) {
      const status = err.httpStatus || 400;
      res.status(status).json({ error: err.message || 'Failed to revoke QR token' });
    }
  });

  // 3. Reset Demo Payment Simulations for a Case / Invoice (Authorized Admin Action)
  app.post('/api/demo-qr/reset', (req, res) => {
    try {
      const result = demoQrService.resetDemoPaymentsForCase(req.body);
      res.json(result);
    } catch (err: any) {
      const status = err.httpStatus || 400;
      res.status(status).json({ error: err.message || 'Failed to reset demo QR data' });
    }
  });

  // 4. List Isolated Demo Payment Simulations for a Case
  app.get('/api/demo-qr/simulations/:caseId', (req, res) => {
    res.json(demoQrService.getCaseDemoSimulations(req.params.caseId));
  });

  // 5. Public Buyer QR Scanning Endpoint (Rate-Limited, Token Hash Validated)
  app.get('/api/demo-pay/:token', (req, res) => {
    try {
      const clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.ip ||
        'public-buyer-ip';
      const view = demoQrService.resolveBuyerPaymentToken(req.params.token, { clientIp });
      res.json(view);
    } catch (err: any) {
      const status = err.httpStatus || 404;
      res.status(status).json({ error: err.message || 'Invalid or expired QR token' });
    }
  });

  // 6. Public Buyer Simulated Payment Execution (Full / Partial Demo Mode Only)
  app.post('/api/demo-pay/:token/simulate', (req, res) => {
    try {
      const clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.ip ||
        'public-buyer-ip';
      const result = demoQrService.simulateBuyerDemoPayment(
        {
          token: req.params.token,
          paymentType: req.body.paymentType,
          partialAmountPaise: req.body.partialAmountPaise,
          payerNote: req.body.payerNote,
        },
        { clientIp }
      );
      res.status(201).json(result);
    } catch (err: any) {
      const status = err.httpStatus || 400;
      res.status(status).json({ error: err.message || 'Demo payment simulation failed' });
    }
  });

  // --- VITE DEV MIDDLEWARES ---
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DuesGuard AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
