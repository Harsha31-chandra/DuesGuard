/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DuesGuard AI — Customer Directory & Product/Service SKU Catalogue
 * Merges the Customer & Product Management capabilities from VenkataSuresh-Maddi/duesgaurd
 * with Indian GST Place of Supply state jurisdiction and internal cost vs client selling margin analysis.
 */

import React, { useState } from 'react';
import {
  Users,
  Package,
  Plus,
  Trash2,
  Building2,
  MapPin,
  Mail,
  Phone,
  Receipt,
  CheckCircle2,
  X,
  Search,
} from 'lucide-react';
import type { CustomerRecord, ProductItemRecord } from '../types/index.ts';
import { formatINR, rupeesToPaise, validateGstin } from '../services/finance.ts';
import {
  INDIAN_STATES_AND_UTS,
  determineGstPlaceOfSupply,
} from '../services/erpBillingService.ts';

interface CustomersProductsViewProps {
  customers: CustomerRecord[];
  products: ProductItemRecord[];
  sellerState?: string;
  onAddCustomer: (customer: Partial<CustomerRecord>) => Promise<void>;
  onAddProduct: (product: Partial<ProductItemRecord>) => Promise<void>;
  onDeleteProduct: (productId: string) => Promise<void>;
  onOpenInvoiceForCustomer: (customerId: string) => void;
  onSendReminderForCustomer?: (customerId: string) => void;
}

export const CustomersProductsView: React.FC<CustomersProductsViewProps> = ({
  customers,
  products,
  sellerState = 'Karnataka',
  onAddCustomer,
  onAddProduct,
  onDeleteProduct,
  onOpenInvoiceForCustomer,
  onSendReminderForCustomer,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'customers' | 'products'>('customers');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCustModalOpen, setIsCustModalOpen] = useState(false);
  const [isProdModalOpen, setIsProdModalOpen] = useState(false);

  // Customer form state
  const [custName, setCustName] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custState, setCustState] = useState('Maharashtra');
  const [custGstin, setCustGstin] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custCreditDays, setCustCreditDays] = useState('30');
  const [custError, setCustError] = useState<string | null>(null);

  // Product form state
  const [prodName, setProdName] = useState('');
  const [prodSku, setProdSku] = useState('');
  const [prodHsn, setProdHsn] = useState('84834000');
  const [prodUnit, setProdUnit] = useState('PCS');
  const [prodCostRupees, setProdCostRupees] = useState('12000');
  const [prodSellingRupees, setProdSellingRupees] = useState('18500');
  const [prodGstRate, setProdGstRate] = useState('18');
  const [prodError, setProdError] = useState<string | null>(null);

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.state.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.gstin || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.hsnSacCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim() || !custEmail.trim()) {
      setCustError('Customer enterprise name and billing email are required.');
      return;
    }
    setCustError(null);
    await onAddCustomer({
      name: custName.trim(),
      email: custEmail.trim(),
      phone: custPhone.trim() || '+91 98200 11223',
      state: custState,
      gstin: custGstin.trim().toUpperCase(),
      billingAddress: custAddress.trim() || `${custState} Industrial Zone`,
      creditDays: Math.min(45, Math.max(1, Number(custCreditDays) || 30)),
    });
    setCustName('');
    setCustEmail('');
    setCustPhone('');
    setCustGstin('');
    setCustAddress('');
    setIsCustModalOpen(false);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim() || Number(prodSellingRupees) <= 0) {
      setProdError('Valid item name and positive selling price (INR) are required.');
      return;
    }
    setProdError(null);
    await onAddProduct({
      name: prodName.trim(),
      sku: prodSku.trim().toUpperCase() || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      hsnSacCode: prodHsn.trim() || '84834000',
      unit: prodUnit,
      costPricePaise: rupeesToPaise(prodCostRupees || '0'),
      sellingPricePaise: rupeesToPaise(prodSellingRupees),
      gstRatePercent: Number(prodGstRate),
    });
    setProdName('');
    setProdSku('');
    setIsProdModalOpen(false);
  };

  return (
    <div className="space-y-6" data-testid="customers-products-view">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
            ERP Master Data · Place of Supply GST Jurisdiction ({sellerState} Origin)
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mt-0.5">
            Customer Directory &amp; Product Catalogue
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Configure enterprise buyers with GST state rules (CGST+SGST vs IGST) and SKU catalogue with private cost margins.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            data-testid="open-add-customer-modal-btn"
            onClick={() => setIsCustModalOpen(true)}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Customer</span>
          </button>
          <button
            type="button"
            data-testid="open-add-product-modal-btn"
            onClick={() => setIsProdModalOpen(true)}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Product SKU</span>
          </button>
        </div>
      </div>

      {/* Interactive Filter Bar & Segmented Mode Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800 rounded-xl p-3">
        <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-lg">
          <button
            type="button"
            data-testid="subtab-customers-btn"
            onClick={() => setActiveSubTab('customers')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeSubTab === 'customers'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Customer Directory ({customers.length})</span>
          </button>
          <button
            type="button"
            data-testid="subtab-products-btn"
            onClick={() => setActiveSubTab('products')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeSubTab === 'products'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Product &amp; Service Catalogue ({products.length})</span>
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            aria-label="Search customers or products"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeSubTab === 'customers'
                ? 'Search customer, state, or GSTIN...'
                : 'Search SKU, item name, or HSN...'
            }
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* SUBTAB 1: CUSTOMER DIRECTORY */}
      {activeSubTab === 'customers' && (
        <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold">
                  <th className="py-3 px-4">Enterprise Buyer</th>
                  <th className="py-3 px-4">Contact &amp; Billing Email</th>
                  <th className="py-3 px-4">State &amp; GST Tax Rule</th>
                  <th className="py-3 px-4">GSTIN Checksum</th>
                  <th className="py-3 px-4 text-right">Credit Limit</th>
                  <th className="py-3 px-4 text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/70">
                {filteredCustomers.map((cust) => {
                  const supplyRule = determineGstPlaceOfSupply(sellerState, cust.state);
                  const gstCheck = validateGstin(cust.gstin);
                  return (
                    <tr
                      key={cust.id}
                      data-testid={`customer-row-${cust.id}`}
                      className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span>{cust.name}</span>
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 pl-5">
                          {cust.billingAddress}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-zinc-800 dark:text-zinc-200 font-mono">
                          <Mail className="w-3 h-3 text-zinc-400" />
                          <span>{cust.email}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 mt-0.5 font-mono">
                          <Phone className="w-3 h-3 text-zinc-400" />
                          <span>{cust.phone}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{cust.state}</span>
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {supplyRule === 'INTRA_STATE'
                            ? 'Intra-State · CGST + SGST'
                            : 'Inter-State · IGST Applicable'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        {cust.gstin ? (
                          <div>
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                              {cust.gstin}
                            </span>
                            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{gstCheck.syntaxValid ? 'Valid Format' : 'Review Format'}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-zinc-400">Unregistered / N/A</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-zinc-800 dark:text-zinc-200">
                        {cust.creditDays} Days (§15)
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {onSendReminderForCustomer && (
                            <button
                              type="button"
                              data-testid={`remind-customer-btn-${cust.id}`}
                              onClick={() => onSendReminderForCustomer(cust.id)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-300 transition inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                            >
                              <Mail className="w-3.5 h-3.5" />
                              <span>Remind</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onOpenInvoiceForCustomer(cust.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 transition inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            <span>Bill Customer</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 2: PRODUCT & SERVICE CATALOGUE */}
      {activeSubTab === 'products' && (
        <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold">
                  <th className="py-3 px-4">SKU &amp; Item Description</th>
                  <th className="py-3 px-4">HSN / SAC</th>
                  <th className="py-3 px-4">Unit</th>
                  <th className="py-3 px-4 text-right">Internal Cost (Private)</th>
                  <th className="py-3 px-4 text-right">Client Selling Price</th>
                  <th className="py-3 px-4 text-right">Unit Margin</th>
                  <th className="py-3 px-4 text-right">GST Rate</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/70">
                {filteredProducts.map((prod) => {
                  const cost = Number(prod.costPricePaise) || 0;
                  const sell = Number(prod.sellingPricePaise) || 0;
                  const marginPaise = String(Math.max(0, sell - cost));
                  const marginPct = sell > 0 ? Math.round(((sell - cost) / sell) * 100) : 0;
                  return (
                    <tr
                      key={prod.id}
                      data-testid={`product-row-${prod.id}`}
                      className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                          {prod.sku}
                        </div>
                        <div className="font-semibold text-zinc-900 dark:text-white mt-0.5">
                          {prod.name}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums text-zinc-600 dark:text-zinc-300">
                        {prod.hsnSacCode}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-zinc-600 dark:text-zinc-300">
                        {prod.unit}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                        {formatINR(prod.costPricePaise)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-zinc-900 dark:text-white">
                        {formatINR(prod.sellingPricePaise)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
                        +{formatINR(marginPaise)} ({marginPct}%)
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-zinc-800 dark:text-zinc-200">
                        {prod.gstRatePercent}%
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => onDeleteProduct(prod.id)}
                          aria-label={`Remove ${prod.name}`}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-500/10 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: ADD CUSTOMER */}
      {isCustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                  Register Enterprise Customer
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  State determines Intra-State (CGST+SGST) vs Inter-State (IGST) tax rules
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCustModalOpen(false)}
                aria-label="Close customer modal"
                className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {custError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400">
                {custError}
              </div>
            )}

            <form onSubmit={handleCreateCustomer} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Customer / Enterprise Name *
                </label>
                <input
                  type="text"
                  required
                  data-testid="input-customer-name"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  placeholder="e.g., Larsen & Toubro Heavy Engineering"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Accounts Payable Email *
                  </label>
                  <input
                    type="email"
                    required
                    data-testid="input-customer-email"
                    value={custEmail}
                    onChange={(e) => setCustEmail(e.target.value)}
                    placeholder="ap@larsentoubro.com"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    placeholder="+91 22 6752 5656"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Billing State (Place of Supply) *
                  </label>
                  <select
                    aria-label="Customer State"
                    data-testid="select-customer-state"
                    value={custState}
                    onChange={(e) => setCustState(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white"
                  >
                    {INDIAN_STATES_AND_UTS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Customer GSTIN (15-Digit)
                  </label>
                  <input
                    type="text"
                    value={custGstin}
                    onChange={(e) => setCustGstin(e.target.value)}
                    placeholder="27AAACL0140P1Z1"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Billing Address
                  </label>
                  <input
                    type="text"
                    value={custAddress}
                    onChange={(e) => setCustAddress(e.target.value)}
                    placeholder="Powai Campus, Saki Vihar Road, Mumbai"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Credit Days (≤45)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={45}
                    value={custCreditDays}
                    onChange={(e) => setCustCreditDays(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsCustModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="submit-customer-btn"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD PRODUCT / SERVICE */}
      {isProdModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                  Add Product / Service SKU
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Internal cost price remains private and is never printed on buyer tax invoices
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsProdModalOpen(false)}
                aria-label="Close product modal"
                className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {prodError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400">
                {prodError}
              </div>
            )}

            <form onSubmit={handleCreateProduct} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Item / Service Description *
                </label>
                <input
                  type="text"
                  required
                  data-testid="input-product-name"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  placeholder="e.g., CNC Hardened Spline Shaft Assembly"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    SKU Code
                  </label>
                  <input
                    type="text"
                    value={prodSku}
                    onChange={(e) => setProdSku(e.target.value)}
                    placeholder="SKU-SPL-901"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    HSN / SAC Code
                  </label>
                  <input
                    type="text"
                    value={prodHsn}
                    onChange={(e) => setProdHsn(e.target.value)}
                    placeholder="84834000"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Unit
                  </label>
                  <input
                    type="text"
                    value={prodUnit}
                    onChange={(e) => setProdUnit(e.target.value)}
                    placeholder="PCS, SETS, HRS"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Internal Cost (INR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={prodCostRupees}
                    onChange={(e) => setProdCostRupees(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Selling Price (INR) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    data-testid="input-product-selling"
                    value={prodSellingRupees}
                    onChange={(e) => setProdSellingRupees(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    GST Rate (%)
                  </label>
                  <select
                    aria-label="Applicable GST Rate"
                    value={prodGstRate}
                    onChange={(e) => setProdGstRate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-mono"
                  >
                    <option value="0">0% (Exempt)</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsProdModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="submit-product-btn"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer"
                >
                  Save SKU Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
