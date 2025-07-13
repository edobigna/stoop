
import React from 'react';
import { Link } from 'react-router-dom';
import { HiOutlineArrowLeft } from 'react-icons/hi2';

const TermsPage: React.FC = () => {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-3xl mx-auto bg-white p-6 sm:p-10 rounded-xl shadow-xl border border-gray-200/70">
        <Link 
            to="/auth" 
            className="inline-flex items-center text-sm text-stoop-green hover:text-stoop-green-dark mb-6 group"
        >
            <HiOutlineArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
            Torna all'autenticazione
        </Link>
        <h1 className="text-3xl font-extrabold text-stoop-green-darker mb-6 tracking-tight">Termini e Condizioni di Stoop</h1>
        
        <div className="prose prose-sm sm:prose-base max-w-none text-gray-700 space-y-4">
          <p className="text-xs text-gray-500">Ultimo aggiornamento: {new Date().toLocaleDateString('it-IT', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

          <p>Benvenuto in Stoop!</p>

          <p>Questi termini e condizioni delineano le regole e i regolamenti per l'uso del sito web e dell'applicazione mobile di Stoop.</p>

          <p>Accedendo a questa app, assumiamo che accetti questi termini e condizioni. Non continuare a utilizzare Stoop se non accetti di rispettare tutti i termini e le condizioni indicati in questa pagina.</p>

          <h2 className="text-xl font-semibold text-stoop-green-darker !mt-6 !mb-3">1. Definizioni</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>"App" si riferisce all'applicazione mobile Stoop.</li>
            <li>"Utente", "Tu" e "Tuo" si riferiscono a te, la persona che accede a questa app e accetta i termini e condizioni della Società.</li>
            <li>"La Società", "Noi Stessi", "Noi", "Nostro" e "Ci" si riferiscono alla nostra applicazione Stoop.</li>
          </ul>

          <h2 className="text-xl font-semibold text-stoop-green-darker !mt-6 !mb-3">2. Utilizzo dell'App</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Devi avere almeno 18 anni per utilizzare questa app o l'età minima richiesta nella tua giurisdizione per stipulare contratti vincolanti.</li>
            <li>Sei responsabile di garantire che le informazioni del tuo account siano accurate e mantenute riservate.</li>
            <li>L'uso dell'app per scopi illegali o non autorizzati è severamente proibito.</li>
          </ul>

          <h2 className="text-xl font-semibold text-stoop-green-darker !mt-6 !mb-3">3. Contenuti Generati dagli Utenti</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Pubblicando contenuti (annunci, messaggi, ecc.), concedi alla Società una licenza non esclusiva, mondiale, perpetua, irrevocabile, esente da royalty, sublicenziabile per utilizzare, riprodurre, adattare, pubblicare, tradurre e distribuire i tuoi contenuti su qualsiasi media.</li>
            <li>Sei l'unico responsabile dei contenuti che pubblichi. I tuoi contenuti non devono violare i diritti di terzi, essere diffamatori, osceni o illegali.</li>
            <li>Ci riserviamo il diritto di rimuovere qualsiasi contenuto ritenuto inappropriato a nostra esclusiva discrezione.</li>
          </ul>

          <h2 className="text-xl font-semibold text-stoop-green-darker !mt-6 !mb-3">4. Oggetti Offerti e Ritirati</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Stoop App è una piattaforma per facilitare la condivisione di oggetti gratuiti. Non siamo responsabili della qualità, sicurezza o legalità degli oggetti offerti.</li>
            <li>Gli accordi per il ritiro degli oggetti sono presi esclusivamente tra gli utenti. Consigliamo cautela e buon senso quando si organizzano incontri.</li>
            <li>La Società non è coinvolta nelle transazioni tra utenti.</li>
          </ul>

          <h2 className="text-xl font-semibold text-stoop-green-darker !mt-6 !mb-3">5. Limitazione di Responsabilità</h2>
          <p>Nella misura massima consentita dalla legge applicabile, escludiamo tutte le dichiarazioni, garanzie e condizioni relative alla nostra app e all'uso di questa app. Non saremo responsabili per eventuali perdite o danni diretti, indiretti, incidentali, speciali o consequenziali derivanti da o in connessione con l'uso della nostra app.</p>

          <h2 className="text-xl font-semibold text-stoop-green-darker !mt-6 !mb-3">6. Modifiche ai Termini</h2>
          <p>Ci riserviamo il diritto di modificare questi termini e condizioni in qualsiasi momento. Ti informeremo di eventuali modifiche pubblicando i nuovi termini e condizioni sull'app. Si consiglia di rivedere periodicamente questi termini per eventuali modifiche.</p>

          <h2 className="text-xl font-semibold text-stoop-green-darker !mt-6 !mb-3">7. Legge Applicabile</h2>
          <p>Questi termini e condizioni sono regolati e interpretati in conformità con le leggi italiane, e tu ti sottometti irrevocabilmente alla giurisdizione esclusiva dei tribunali italiani.</p>

          <h3 className="text-lg font-semibold text-stoop-green-darker !mt-6 !mb-3">Contattaci</h3>
          <p>Se hai domande su questi Termini, ti preghiamo di contattarci a: stoopingofficial@gmail.com.</p>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;
