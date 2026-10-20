import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowClockwise, Buildings, CheckCircle, Eye, Info, Trash, WarningCircle } from '@phosphor-icons/react';
import { apiClient } from '../api/client.js';
import AppDialog from '../components/AppDialog.jsx';
import Layout from '../components/Layout.jsx';
import { buildVoidScope, VOID_BUILDINGS } from '../utils/voidAllScope.js';

function scopeLabel(scope) {
  if (scope.building === 'miguel_pro') return 'Miguel Pro Learning Commons';
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
      <div className="mx-auto max-w-5xl pb-8">
        <Link to="/admin" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#063a64] hover:underline">
          <ArrowLeft size={17} weight="bold" />
          Admin dashboard
        </Link>

        <header className="ui-surface-band p-5 sm:p-7">
          <div className="ui-kicker mb-3"><Buildings size={18} weight="fill" />Reservation management</div>
          <h1 className="ui-page-title">Void active reservations</h1>
          <p className="ui-muted mt-2 max-w-2xl">Release seats for an entire library or a Gisbert floor. Check the live counts before confirming.</p>
        </header>

        <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(310px,0.9fr)]">
          <section className="ui-panel overflow-hidden" aria-labelledby="scope-heading">
            <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
              <StepHeading number="1" title="Choose where to void" id="scope-heading" />
              <p className="mt-2 pl-11 text-sm leading-6 text-slate-600">Only pending and front-desk-confirmed reservations in this location are included.</p>
            </div>
            <div className="space-y-6 p-5 sm:p-6">
              <fieldset disabled={busy === 'void'}>
                <legend className="mb-3 text-sm font-semibold text-slate-800">Library</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(VOID_BUILDINGS).map(([value, option]) => (
                    <button key={value} type="button" aria-pressed={building === value} onClick={() => changeScope(value, 'all')}
                      className={`flex min-h-14 items-center justify-between gap-3 rounded-[8px] border px-4 py-3 text-left text-sm font-semibold disabled:cursor-not-allowed ${building === value ? 'border-[#0c6097] bg-[#e6f0f7] text-[#063a64] shadow-[inset_0_0_0_1px_#0c6097]' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'}`}>
                      {option.label}
                      {building === value && <CheckCircle size={20} weight="fill" className="shrink-0 text-[#0c6097]" />}
                    </button>
                  ))}
                </div>
              </fieldset>

              {building === 'gisbert' ? (
                <fieldset disabled={busy === 'void'}>
                  <legend className="mb-3 text-sm font-semibold text-slate-800">Coverage</legend>
                  <div className="flex flex-wrap gap-2">
                    {['all', ...VOID_BUILDINGS.gisbert.floors.map(String)].map((value) => (
                      <button key={value} type="button" aria-pressed={floor === value} onClick={() => changeScope(building, value)}
                        className={`min-h-10 rounded-[8px] border px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed ${floor === value ? 'border-[#063a64] bg-[#063a64] text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'}`}>
                        {value === 'all' ? 'All floors' : `Floor ${value}`}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ) : (
                <div className="ui-alert-info flex items-start gap-3"><Info size={19} weight="duotone" className="mt-0.5 shrink-0" /><span>Miguel Pro reservations are managed together as one learning commons.</span></div>
              )}

              <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="min-w-0 text-sm text-slate-600">Selected: <span className="font-semibold text-slate-900">{scopeLabel(buildVoidScope(building, floor))}</span></p>
                <button type="button" onClick={requestPreview} disabled={Boolean(busy)} className="ui-button-primary w-full shrink-0 sm:w-auto">
                  {busy === 'preview' ? <ArrowClockwise size={18} className="animate-spin" /> : <Eye size={18} weight="bold" />}
                  {busy === 'preview' ? 'Checking counts...' : preview ? 'Refresh counts' : 'Preview impact'}
                </button>
              </div>
            </div>
          </section>

          <section className="ui-panel overflow-hidden" aria-labelledby="review-heading" aria-live="polite">
            <div className="border-b border-slate-200 px-5 py-4 sm:px-6"><StepHeading number="2" title={result ? 'Latest result' : 'Review impact'} id="review-heading" /></div>
            <div className="p-5 sm:p-6">
              {error && (
                <div className="ui-alert-danger flex flex-col gap-3" role="alert">
                  <div className="flex items-start gap-3"><WarningCircle size={20} weight="duotone" className="mt-0.5 shrink-0" /><span>{error}</span></div>
                  <button type="button" onClick={requestPreview} disabled={Boolean(busy)} className="ui-button-secondary w-full border-red-300 text-red-800"><ArrowClockwise size={17} weight="bold" />Check counts again</button>
                </div>
              )}

              {busy === 'preview' && <div className="py-9 text-center text-sm text-slate-600" role="status"><ArrowClockwise size={30} className="mx-auto mb-3 animate-spin text-[#0c6097]" />Checking active reservations...</div>}

              {!preview && !result && !error && busy !== 'preview' && (
                <div className="py-7 text-center">
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-[8px] bg-[#e6f0f7] text-[#063a64]"><Eye size={27} weight="duotone" /></span>
                  <h3 className="mt-4 text-base font-semibold text-slate-950">Ready for a live preview</h3>
                  <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-600">Choose a location and preview its counts. No reservations change until you confirm.</p>
                </div>
              )}

              {preview && (
                <div>
                  <p className="text-sm font-semibold text-slate-950">{scopeLabel(preview.scope)}</p>
                  <p className="mt-1 text-xs text-slate-500">Counts at the time of this preview</p>
                  <div className="mt-5 grid grid-cols-3 gap-2" aria-label="Reservations in scope">
                    <Count label="Pending" value={preview.pending} />
                    <Count label="Confirmed" value={preview.confirmed} />
                    <Count label="Total" value={preview.total} emphasis />
                  </div>
                  {preview.total > 0 ? (
                    <>
                      <div className="ui-alert-warning mt-5 flex items-start gap-3"><WarningCircle size={19} weight="duotone" className="mt-0.5 shrink-0" /><span>Voiding ends current reservations in this scope, releases their seats, and notifies affected students.</span></div>
                      <button type="button" onClick={() => setConfirming(true)} className="ui-button-danger mt-5 w-full bg-red-700 text-white hover:bg-red-800"><Trash size={18} weight="bold" />Review and void</button>
                    </>
                  ) : (
                    <div className="mt-5 flex items-start gap-2 rounded-[8px] bg-emerald-50 px-4 py-3 text-sm text-emerald-900"><CheckCircle size={19} weight="fill" className="shrink-0" />No active reservations in this scope.</div>
                  )}
                </div>
              )}

              {result && (
                <div role="status">
                  <div className="flex items-start gap-3">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[8px] ${result.failed ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      {result.failed ? <WarningCircle size={22} weight="duotone" /> : <CheckCircle size={22} weight="fill" />}
                    </span>
                    <div><h3 className="text-base font-semibold text-slate-950">{result.failed ? 'Completed with failures' : 'Void request completed'}</h3><p className="mt-1 text-sm text-slate-600">{scopeLabel(result.scope)}</p></div>
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-2" aria-label="Void request result">
                    <Count label="Voided" value={result.voided} emphasis />
                    <Count label="Skipped" value={result.skipped} />
                    <Count label="Failed" value={result.failed} tone={result.failed ? 'danger' : undefined} />
                  </div>
                  {result.skipped > 0 && <p className="mt-4 text-sm leading-6 text-slate-600">Skipped reservations had already ended during the request.</p>}
                  {result.failed > 0 && <div className="ui-alert-danger mt-5"><p>Some reservations could not be voided. Check the current counts before retrying.</p><button type="button" disabled={Boolean(busy)} onClick={requestPreview} className="ui-button-secondary mt-3 w-full border-red-300 text-red-800 disabled:opacity-50"><ArrowClockwise size={17} weight="bold" />Preview retry</button></div>}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <AppDialog
        open={confirming}
        tone="danger"
        title="Void reservations in this location?"
        description={preview ? `This will end all currently active reservations in ${scopeLabel(preview.scope)} and release their seats. The preview showed ${preview.total} ${preview.total === 1 ? 'reservation' : 'reservations'}; the live count may have changed. Affected students will be notified.` : ''}
        confirmLabel="Void reservations"
        cancelLabel="Keep reservations"
        busy={busy === 'void'}
        dismissible={busy !== 'void'}
        onConfirm={() => preview && runVoidAll(preview.scope)}
        onClose={() => setConfirming(false)}
      />
    </Layout>
  );
}

function StepHeading({ number, title, id }) {
  return <div className="flex items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-[#e6f0f7] text-sm font-bold text-[#063a64]" aria-hidden="true">{number}</span><h2 id={id} className="ui-section-title">{title}</h2></div>;
}

function Count({ label, value, emphasis = false, tone }) {
  return (
    <div className={`min-w-0 rounded-[8px] border px-2 py-3 text-center sm:px-3 ${tone === 'danger' ? 'border-red-200 bg-red-50' : emphasis ? 'border-blue-200 bg-[#e6f0f7]' : 'border-slate-200 bg-slate-50'}`}>
      <p className={`text-[11px] font-semibold sm:text-xs ${tone === 'danger' ? 'text-red-800' : 'text-slate-600'}`}>{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums sm:text-2xl ${tone === 'danger' ? 'text-red-800' : 'text-slate-950'}`}>{value}</p>
    </div>
  );
}
