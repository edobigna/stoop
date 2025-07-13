
import React, { useState, FormEvent } from 'react';
import { firebaseApi } from '../services/firebaseApi';
import { useToast } from '../contexts/ToastContext';
import { ReportReason } from '../types';
import { REPORT_REASONS } from '../constants';
import LoadingSpinner from './LoadingSpinner';
import { HiOutlineXMark, HiOutlineFlag, HiOutlineChevronDown } from 'react-icons/hi2';

interface ReportModalProps {
  adId: string;
  adTitle: string;
  adOwnerId: string;
  reporterId: string;
  isOpen: boolean;
  onClose: () => void;
}

const ReportModal: React.FC<ReportModalProps> = ({
  adId,
  adTitle,
  adOwnerId,
  reporterId,
  isOpen,
  onClose,
}) => {
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!reason) {
      showToast("Seleziona un motivo per la segnalazione.", "error");
      return;
    }
    setIsSubmitting(true);
    try {
      await firebaseApi.createReport(adId, reporterId, adOwnerId, adTitle, reason, details);
      showToast("Segnalazione inviata con successo. Grazie!", "success");
      onClose();
    } catch (err: any) {
      showToast(err.message || "Errore nell'invio della segnalazione.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ease-in-out"
      onClick={onClose} // Close when clicking on the overlay
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 sm:p-8 space-y-5 transform transition-all duration-300 ease-in-out scale-95 opacity-0 animate-modalEnter"
        onClick={e => e.stopPropagation()} // Prevent closing when clicking inside the modal
      >
        <div className="flex justify-between items-center">
          <h2 id="report-modal-title" className="text-xl font-semibold text-stoop-green-darker flex items-center">
            <HiOutlineFlag className="w-6 h-6 mr-2 text-red-500" />
            Segnala Annuncio: {adTitle}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Chiudi modale di segnalazione"
          >
            <HiOutlineXMark className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">Motivo della segnalazione *</label>
            <div className="relative custom-select-wrapper">
              <select
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value as ReportReason)}
                required
                className="pr-10" // Ensure padding for the arrow
              >
                <option value="" disabled>Seleziona un motivo...</option>
                {REPORT_REASONS.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <div className="custom-select-arrow text-gray-500">
                  <HiOutlineChevronDown className="w-5 h-5" />
              </div>
            </div>
          </div>

          {reason === ReportReason.OTHER && (
            <div>
              <label htmlFor="details" className="block text-sm font-medium text-gray-700 mb-1">Dettagli aggiuntivi *</label>
              <textarea
                id="details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                required={reason === ReportReason.OTHER}
                placeholder="Fornisci maggiori informazioni..."
              />
            </div>
          )}
          {reason && reason !== ReportReason.OTHER && (
             <div>
              <label htmlFor="detailsOptional" className="block text-sm font-medium text-gray-700 mb-1">Dettagli aggiuntivi (Opzionale)</label>
              <textarea
                id="detailsOptional"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                placeholder="Fornisci maggiori informazioni se necessario..."
              />
            </div>
          )}

          <div className="flex flex-col sm:flex-row-reverse gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto flex items-center justify-center px-6 py-2.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-500 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-60 transition-opacity"
            >
              {isSubmitting ? <LoadingSpinner size="sm" color="border-white" /> : 'Invia Segnalazione'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto flex items-center justify-center px-6 py-2.5 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-stoop-green-dark transition-colors"
            >
              Annulla
            </button>
          </div>
        </form>
      </div>
      <style>{`
        @keyframes modalEnter {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-modalEnter {
          animation: modalEnter 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default ReportModal;
