import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowClockwise, Buildings, Eye, Trash, WarningCircle } from '@phosphor-icons/react';
import { apiClient } from '../api/client.js';
import AppDialog from '../components/AppDialog.jsx';
import Layout from '../components/Layout.jsx';
import { buildVoidScope, VOID_BUILDINGS } from '../utils/voidAllScope.js';

function scopeLabel(scope) {
  return `${VOID_BUILDINGS[scope.building].label}, ${scope.allFloors ? 'all floors' : `floor ${scope.floor}`}`;
}

export default function AdminVoidAll() {
  const [building, setBuilding] = useState('gisbert');
  const [floor, setFloor] = useState('all');
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [confirming, setConfirming] = useState(false);
  const previewRequestRef = useRef(null);

  useEffect(() => () => previewRequestRef.current?.abort(), []);

  function changeScope(nextBuilding, nextFloor) {
    previewRequestRef.current?.abort();
    setBuilding(nextBuilding);
    setFloor(nextFloor);
    setPreview(null);
    setResult(null);
    setError('');
    setBusy('');
  }

  async function requestPreview() {
    const controller = new AbortController();
    previewRequestRef.current?.abort();
    previewRequestRef.current = controller;
    const scope = buildVoidScope(building, floor);
    setBusy('preview');
    setError('');
    setPreview(null);
    setResult(null);
    try {
      const counts = await apiClient('/api/reservations/void-all/preview', {
        method: 'POST',
        body: JSON.stringify(scope),
        signal: controller.signal,
      });
      if (!controller.signal.aborted) setPreview({ ...counts, scope });
    } catch (requestError) {
      if (requestError.name !== 'AbortError') {
        setError(requestError.message || 'The reservation counts could not be loaded.');
      }
    } finally {
      if (!controller.signal.aborted) setBusy('');
    }
  }

  async function runVoidAll(scope) {
    setBusy('void');
    setError('');
    try {
      const summary = await apiClient('/api/reservations/void-all', {
        method: 'POST',
        body: JSON.stringify(scope),
      });
      setResult({ ...summary, scope });
      setPreview(null);
      setConfirming(false);
    } catch (requestError) {
      setConfirming(false);
      setError(requestError.message || 'The reservations could not be voided. Check the current counts and try again.');
      setPreview(null);
    } finally {
      setBusy('');
    }
  }

  return (
    <Layout>
      <div className="mx-auto max-w-3xl">
        <Link to="/admin" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#063a64] hover:underline">
          <ArrowLeft size={17} weight="bold" />
          Admin dashboard
        </Link>

        <section className="ui-surface-band p-5 sm:p-6">
          <div className="ui-kicker mb-3"><Buildings size={18} weight="fill" />Reservation management</div>
          <h1 className="ui-page-title">Void active reservations</h1>
          <p className="ui-muted mt-2">Choose a library and floor, then review how many pending and confirmed reservations would end.</p>
        </section>

        <section className="mt-6 border-y border-slate-200 bg-white py-6" aria-label="Void reservation scope">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-800">
              Library
              <select value={building} disabled={busy === 'void'} onChange={(event) => changeScope(event.target.value, 'all')} className="mt-2 block h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-100">
                {Object.entries(VOID_BUILDINGS).map(([value, option]) => <option key={value} value={value}>{option.label}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-800">
              Floor
              <select value={floor} disabled={busy === 'void'} onChange={(event) => changeScope(building, event.target.value)} className="mt-2 block h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-100">
                <option value="all">All floors</option>
                {VOID_BUILDINGS[building].floors.map((value) => <option key={value} value={value}>Floor {value}</option>)}
              </select>
            </label>
          </div>

          <button type="button" onClick={requestPreview} disabled={Boolean(busy)} className="ui-button-secondary mt-5 disabled:opacity-50">
            <Eye size={18} weight="bold" />
            {busy === 'preview' ? 'Checking reservations...' : 'Preview counts'}
          </button>

          {error && <p className="ui-alert-danger mt-5" role="alert">{error}</p>}

          {preview && (
            <div className="mt-6 border-t border-slate-200 pt-5">
              <h2 className="text-sm font-semibold text-slate-950">Preview for {scopeLabel(preview.scope)}</h2>
              <div className="mt-4 grid grid-cols-3 gap-3" aria-label="Reservations in scope">
                <Count label="Pending" value={preview.pending} />
                <Count label="Confirmed" value={preview.confirmed} />
                <Count label="Total" value={preview.total} />
              </div>
              {preview.total > 0 ? (
                <button type="button" onClick={() => setConfirming(true)} className="ui-button-danger mt-5 bg-red-700 text-white hover:bg-red-800">
                  <Trash size={18} weight="bold" />
                  Void {preview.total} {preview.total === 1 ? 'reservation' : 'reservations'}
                </button>
              ) : (
                <p className="mt-5 text-sm text-slate-600">There are no active reservations in this scope.</p>
              )}
            </div>
          )}

          {result && (
            <div className="mt-6 border-t border-slate-200 pt-5" role="status">
              <h2 className="text-sm font-semibold text-slate-950">Latest result for {scopeLabel(result.scope)}</h2>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <Count label="Voided" value={result.voided} />
                <Count label="Skipped" value={result.skipped} />
                <Count label="Failed" value={result.failed} />
              </div>
              {result.skipped > 0 && <p className="mt-3 text-xs text-slate-600">Skipped reservations ended through another action during the batch.</p>}
              {result.failed > 0 && (
                <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-red-800">
                  <WarningCircle size={19} weight="duotone" />
                  <span>Some reservations could not be voided. Review the current counts before retrying.</span>
                  <button type="button" disabled={Boolean(busy)} onClick={requestPreview} className="ui-button-secondary border-red-300 text-red-800 disabled:opacity-50">
                    <ArrowClockwise size={17} weight="bold" />
                    Preview retry
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      <AppDialog
        open={confirming}
        tone="danger"
        title="Void these reservations?"
        description={preview ? `End up to ${preview.total} active reservations in ${scopeLabel(preview.scope)} and release their seats. Affected students will be notified.` : ''}
        confirmLabel="Void reservations"
        cancelLabel="Keep reservations"
        busy={busy === 'void'}
        dismissible={busy !== 'void'}
        onConfirm={() => runVoidAll(preview.scope)}
        onClose={() => setConfirming(false)}
      />
    </Layout>
  );
}

function Count({ label, value }) {
  return (
    <div className="min-w-0 border-l-2 border-[#0c6097] bg-slate-50 px-3 py-3">
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-slate-950">{value}</p>
    </div>
  );
}
