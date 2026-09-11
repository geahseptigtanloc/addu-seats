import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Buildings, MapTrifold, ShieldCheck, Student } from '@phosphor-icons/react';
import { getGoogleAuthUrl } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { user, loading, loginWithToken, loginAsDemo } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [demoLoading, setDemoLoading] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');
    if (error) return;
    if (token) loginWithToken(token).then(() => navigate('/', { replace: true }));
  }, [searchParams, loginWithToken, navigate]);

  useEffect(() => {
    if (!loading && user && !demoLoading) navigate(user.role === 'admin' ? '/admin' : '/', { replace: true });
  }, [user, loading, demoLoading, navigate]);

  async function handleDemoSignIn(role) {
    setDemoLoading(role);
    await loginAsDemo(role);
    navigate(role === 'admin' ? '/admin' : '/', { replace: true });
  }

  const authError = searchParams.get('error');

  return (
    <main className="app-shell min-h-[100dvh] p-4 sm:p-6 lg:grid lg:place-items-center">
      <section className="mx-auto grid min-h-[640px] w-full max-w-6xl overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-[0_28px_90px_rgba(6,42,72,0.18)] lg:grid-cols-[0.9fr_1.1fr]">
        <div className="flex flex-col justify-between bg-[linear-gradient(145deg,#032946_0%,#063a64_60%,#0b4d7a_100%)] p-7 text-white sm:p-10">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-[8px] bg-white text-lg font-bold text-[#063a64] shadow-[0_10px_24px_rgba(3,41,70,0.24)]">A</span>
              <span><span className="block font-semibold">AdDU Seats</span><span className="block text-xs text-blue-100/70">University Libraries</span></span>
            </div>
            <div className="mt-12 hidden lg:block">
              <Buildings size={34} weight="duotone" className="text-amber-200" />
              <h1 className="mt-5 max-w-sm text-4xl font-semibold leading-tight">Library access with a clear front-desk handoff.</h1>
              <p className="mt-4 max-w-sm text-sm leading-7 text-blue-100/78">Reserve a mapped node, present your QR receipt, and manage the session from one workspace.</p>
              <LibraryPreview />
            </div>
          </div>
          <button type="button" onClick={() => navigate('/')} className="mt-8 inline-flex self-start items-center gap-2 text-sm font-semibold text-blue-100/80 hover:text-white">
            <ArrowLeft size={17} weight="bold" />
            Browse floor maps
          </button>
        </div>

        <div className="flex items-center p-6 sm:p-10 lg:p-12">
          <div className="w-full">
            <p className="ui-kicker"><MapTrifold size={18} weight="duotone" />Access workspace</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-slate-950">Choose an account</h2>
            <p className="ui-muted mt-2">Use a sample role now or continue with your university Google account.</p>

            {authError && <p className="ui-alert-danger mt-5">Sign-in failed. Please try again.</p>}

            <div className="mt-7 space-y-3">
              <DemoButton role="student" label="Student workspace" description="Reserve seats and manage study sessions" icon={Student} loading={demoLoading} onClick={handleDemoSignIn} />
              <DemoButton role="admin" label="Administrator workspace" description="Monitor floors and verify student entry" icon={ShieldCheck} loading={demoLoading} onClick={handleDemoSignIn} />
            </div>

            <div className="my-7 flex items-center gap-3 text-xs font-semibold uppercase text-slate-400"><span className="h-px flex-1 bg-slate-200" /><span>University account</span><span className="h-px flex-1 bg-slate-200" /></div>

            <button type="button" onClick={() => { window.location.href = getGoogleAuthUrl(); }} className="ui-button-secondary w-full">
              <GoogleIcon />
              Continue with Google
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function DemoButton({ role, label, description, icon: Icon, loading, onClick }) {
  return (
    <button type="button" onClick={() => onClick(role)} disabled={Boolean(loading)} className="group flex min-h-20 w-full items-center gap-4 rounded-[8px] border border-slate-200 bg-white p-4 text-left shadow-[0_12px_30px_rgba(14,35,56,0.06)] hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50/50 disabled:opacity-50 disabled:hover:translate-y-0">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[8px] bg-[#e6f0f7] text-[#063a64] group-hover:bg-blue-100"><Icon size={23} weight="duotone" /></span>
      <span className="min-w-0 flex-1"><span className="block font-semibold text-slate-950">{loading === role ? 'Opening workspace...' : label}</span><span className="mt-1 block text-xs text-slate-500">{description}</span></span>
      <ArrowRight size={19} weight="bold" className="shrink-0 text-slate-400 group-hover:translate-x-1 group-hover:text-[#063a64]" />
    </button>
  );
}

function LibraryPreview() {
  return (
    <div className="mt-8 overflow-hidden rounded-[8px] border border-white/14 bg-white/10 p-4 shadow-[0_18px_44px_rgba(3,41,70,0.24)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Gisbert Floor 2</p>
          <p className="mt-1 text-xs text-blue-100/65">130 mapped nodes</p>
        </div>
        <span className="rounded-[8px] bg-amber-200 px-3 py-1 text-xs font-semibold text-[#3d2d04]">Live map</span>
      </div>
      <div className="mt-4 grid grid-cols-[0.7fr_1fr] gap-3">
        <span className="h-28 rounded-[8px] border border-white/14 bg-white/12" />
        <span className="grid h-28 grid-cols-3 gap-2 rounded-[8px] border border-white/14 bg-white/12 p-3">
          <span className="rounded-[6px] bg-emerald-300/80" />
          <span className="rounded-[6px] bg-emerald-300/80" />
          <span className="rounded-[6px] bg-amber-200/90" />
          <span className="rounded-[6px] bg-white/45" />
          <span className="rounded-[6px] bg-red-300/80" />
          <span className="rounded-[6px] bg-emerald-300/80" />
        </span>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
