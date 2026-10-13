import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, ShieldCheck } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext.jsx';

function safeReturnTo(value, user) {
  const fallback = user?.role === 'admin' ? '/admin' : user?.role === 'staff' ? '/frontdesk' : '/';
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/agree')) {
    return fallback;
  }
  return value;
}

export default function LegalAgreement() {
  const { user, loading, acceptLegal, logout } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const destination = safeReturnTo(searchParams.get('returnTo'), user);

  if (loading) {
    return <main className="grid min-h-[100dvh] place-items-center text-slate-500">Loading...</main>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.legalAcceptedAt) return <Navigate to={destination} replace />;

  const handleAgree = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await acceptLegal();
      navigate(destination, { replace: true });
    } catch {
      setError('We could not save your agreement. Please try again.');
      setSaving(false);
    }
  };

  return (
    <main className="app-shell min-h-[100dvh] px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <div className="mb-7 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-[8px] bg-[#063a64] text-lg font-bold text-white">A</span>
          <span className="font-semibold text-slate-900">AdDU Seats</span>
        </div>

        <section className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-[0_22px_64px_rgba(6,42,72,0.12)]">
          <div className="bg-[linear-gradient(135deg,#032946_0%,#063a64_100%)] px-6 py-8 text-white sm:px-9">
            <p className="text-sm font-semibold text-amber-200">Before you continue</p>
            <h1 className="mt-2 text-3xl font-semibold">Review and agree</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-blue-100/85">Please review our privacy notice and terms before using your AdDU Seats account. Your agreement is saved to your account, so you only need to do this once.</p>
          </div>

          <div className="space-y-5 p-6 sm:p-9">
            <section aria-labelledby="privacy-heading" className="rounded-[8px] border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center gap-3 text-[#063a64]">
                <ShieldCheck size={24} weight="duotone" />
                <h2 id="privacy-heading" className="text-lg font-semibold text-slate-900">Privacy Notice</h2>
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-600">We use your Google account name and email to sign you in, and record your seat reservation, verification, break, and report activity to operate the library seating service. Authorized library staff can see the details needed for front-desk checks and support. We also save the time you agree to these policies.</p>
              <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-semibold text-[#063a64] underline underline-offset-2">Read the full Privacy Policy</Link>
            </section>

            <section aria-labelledby="terms-heading" className="rounded-[8px] border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center gap-3 text-[#063a64]">
                <FileText size={24} weight="duotone" />
                <h2 id="terms-heading" className="text-lg font-semibold text-slate-900">Terms of Service</h2>
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-600">Use your own account and the physical QR at the seat you intend to use. A reservation starts only after front-desk approval. Follow the displayed entry, break, and return rules, and check out when you leave.</p>
              <Link to="/terms" target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-semibold text-[#063a64] underline underline-offset-2">Read the full Terms of Service</Link>
            </section>

            <p className="text-sm leading-6 text-slate-600">By selecting <strong>I agree</strong>, you confirm that you have reviewed and accept the Privacy Policy and Terms of Service.</p>
            {error && <p className="ui-alert-danger" role="alert">{error}</p>}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button type="button" onClick={handleAgree} disabled={saving} className="ui-button-primary justify-center disabled:cursor-wait disabled:opacity-60">
                {saving ? 'Saving...' : 'I agree'}
              </button>
              <button type="button" onClick={() => { logout(); navigate('/login', { replace: true }); }} className="ui-button-secondary justify-center">Sign out</button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
