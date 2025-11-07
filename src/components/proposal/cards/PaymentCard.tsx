"use client";

import { useState } from "react";
import { CreditCard, Calendar } from "lucide-react";

interface PaymentCardProps {
  data: {
    paymentTerms?: string;
    advancePayment?: number;
    progressPaymentCount?: number;
    finalPayment?: number;
    paymentInterval?: number;
    notes?: string;
  };
  onChange: (data: any) => void;
}

export function PaymentCard({ data, onChange }: PaymentCardProps) {
  const [formData, setFormData] = useState({
    paymentTerms: data?.paymentTerms || "hakkedis",
    advancePayment: data?.advancePayment || 0,
    progressPaymentCount: data?.progressPaymentCount || 12,
    finalPayment: data?.finalPayment || 0,
    paymentInterval: data?.paymentInterval || 30,
    notes: data?.notes || "",
  });

  const handleChange = (field: string, value: any) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onChange(updated);
  };

  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 px-6 py-4 border-b-2 border-cyan-500/40">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/20 rounded-lg">
            <CreditCard className="text-cyan-400" size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Ödeme Planı</h3>
            <p className="text-sm text-gray-400">Ödeme koşulları ve hakediş planı</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">

      {/* Payment Terms */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 space-y-4">
        <h4 className="text-white font-semibold">Ödeme Şekli</h4>

        <div>
          <label className="block text-sm text-gray-400 mb-2">Ödeme Türü</label>
          <select
            value={formData.paymentTerms}
            onChange={(e) => handleChange("paymentTerms", e.target.value)}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
          >
            <option value="hakkedis">Hakediş Sistemi</option>
            <option value="pesin">Peşin Ödeme</option>
            <option value="vadeli">Vadeli Ödeme</option>
            <option value="karma">Karma (Avans + Hakediş)</option>
          </select>
        </div>

        {(formData.paymentTerms === "karma" || formData.paymentTerms === "hakkedis") && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Avans Oranı (%)
                </label>
                <input
                  type="number"
                  value={formData.advancePayment}
                  onChange={(e) =>
                    handleChange("advancePayment", parseFloat(e.target.value) || 0)
                  }
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
                  placeholder="0"
                  min="0"
                  max="100"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Son Ödeme Oranı (%)
                </label>
                <input
                  type="number"
                  value={formData.finalPayment}
                  onChange={(e) =>
                    handleChange("finalPayment", parseFloat(e.target.value) || 0)
                  }
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
                  placeholder="0"
                  min="0"
                  max="100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Hakediş Sayısı
                </label>
                <input
                  type="number"
                  value={formData.progressPaymentCount}
                  onChange={(e) =>
                    handleChange("progressPaymentCount", parseInt(e.target.value) || 0)
                  }
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
                  placeholder="12"
                  min="1"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Hakediş Aralığı (gün)
                </label>
                <input
                  type="number"
                  value={formData.paymentInterval}
                  onChange={(e) =>
                    handleChange("paymentInterval", parseInt(e.target.value) || 0)
                  }
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
                  placeholder="30"
                  min="1"
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Payment Summary */}
      <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-cyan-400" />
          <h4 className="text-white font-semibold">Ödeme Özeti</h4>
        </div>

        <div className="space-y-3 text-sm">
          {formData.paymentTerms === "hakkedis" && (
            <>
              <div className="flex justify-between">
                <span className="text-gray-400">Hakediş Sayısı:</span>
                <span className="text-white font-medium">{formData.progressPaymentCount} adet</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Hakediş Aralığı:</span>
                <span className="text-white font-medium">{formData.paymentInterval} gün</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Son Ödeme:</span>
                <span className="text-white font-medium">%{formData.finalPayment}</span>
              </div>
            </>
          )}

          {formData.paymentTerms === "karma" && (
            <>
              <div className="flex justify-between">
                <span className="text-gray-400">Avans:</span>
                <span className="text-cyan-400 font-semibold">%{formData.advancePayment}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Hakediş:</span>
                <span className="text-white font-medium">
                  {formData.progressPaymentCount} × {formData.paymentInterval} gün
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Son Ödeme:</span>
                <span className="text-white font-medium">%{formData.finalPayment}</span>
              </div>
            </>
          )}

          {formData.paymentTerms === "pesin" && (
            <div className="flex justify-between">
              <span className="text-gray-400">Ödeme Şekli:</span>
              <span className="text-green-400 font-semibold">Peşin Ödeme</span>
            </div>
          )}

          {formData.paymentTerms === "vadeli" && (
            <div className="flex justify-between">
              <span className="text-gray-400">Vade:</span>
              <span className="text-yellow-400 font-semibold">{formData.paymentInterval} gün</span>
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="payment-notes" className="block text-sm text-gray-400 mb-2">Ek Notlar</label>
        <textarea
          id="payment-notes"
          name="payment-notes"
          value={formData.notes}
          onChange={(e) => handleChange("notes", e.target.value)}
          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none resize-none"
          placeholder="Ödeme ile ilgili özel şartlar, notlar..."
          rows={4}
        />
      </div>
      </div>
    </div>
  );
}
