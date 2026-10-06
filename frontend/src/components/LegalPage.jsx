import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CalendarBlank, EnvelopeSimple } from '@phosphor-icons/react';
import Layout from './Layout.jsx';

const CONTACT_EMAIL = 'univ.library@addu.edu.ph';

export function LegalSection({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-28 border-b border-slate-200 pb-8 last:border-0 last:pb-0">
      <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-7 text-slate-600">{children}</div>
    </section>
  );
}

export function LegalList({ children }) {
  return <ul className="list-disc space-y-2 pl-5 marker:text-[#c49a22]">{children}</ul>;
}

export default function LegalPage({
  icon: Icon,
  eyebrow,
  title,
  summary,
  description,
  sections,
  relatedPath,
  relatedLabel,
  children,
}) {
  useEffect(() => {
    const previousTitle = document.title;
    const metaDescription = document.querySelector('meta[name="description"]');
    const previousDescription = metaDescription?.getAttribute('content');

    document.title = `${title} | AdDU Seats`;
    metaDescription?.setAttribute('content', description);

    return () => {
      document.title = previousTitle;
      if (previousDescription) metaDescription?.setAttribute('content', previousDescription);
    };
  }, [description, title]);

  return (
    <Layout>
      <div className="mx-auto max-w-6xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#063a64]">
          <ArrowLeft size={17} weight="bold" />
          Back to seat maps
        </Link>

        <header className="mt-5 overflow-hidden rounded-[8px] border border-white/10 bg-[linear-gradient(135deg,#032946_0%,#063a64_68%,#0b4d7a_100%)] px-6 py-8 text-white shadow-[0_22px_64px_rgba(3,41,70,0.2)] sm:px-9 sm:py-10">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[8px] border border-white/20 bg-white/10 text-amber-200">
              <Icon size={26} weight="duotone" />
            </span>
            <div>
              <p className="text-sm font-semibold text-amber-200">{eyebrow}</p>
              <h1 className="mt-2 text-3xl font-semibold leading-tight sm:text-[36px]">{title}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-blue-100/80 sm:text-base">{summary}</p>
            </div>
          </div>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start" aria-label={`${title} details`}>
            <div className="ui-panel p-5">
              <p className="ui-label">On this page</p>
              <nav className="mt-3 flex flex-col border-l border-slate-200" aria-label={`${title} sections`}>
                {sections.map((section) => (
                  <a key={section.id} href={`#${section.id}`} className="border-l-2 border-transparent py-2 pl-4 text-sm font-medium text-slate-600 hover:border-[#c49a22] hover:text-[#063a64]">
                    {section.label}
                  </a>
                ))}
              </nav>
            </div>

            <div className="ui-soft-panel p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <CalendarBlank size={18} weight="duotone" className="text-[#063a64]" />
                Effective date
              </div>
              <p className="mt-2 text-sm text-slate-600">October 6, 2026</p>
              <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <EnvelopeSimple size={18} weight="duotone" className="text-[#063a64]" />
                Questions
              </div>
              <a href={`mailto:${CONTACT_EMAIL}`} className="mt-2 block break-all text-sm font-semibold text-[#063a64] hover:underline">{CONTACT_EMAIL}</a>
            </div>
          </aside>

          <article className="ui-panel space-y-8 p-6 sm:p-8 lg:p-10">
            {children}
            <div className="flex flex-col gap-3 border-t border-slate-200 pt-7 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-slate-500">Ateneo de Davao University Library Services</span>
              <Link to={relatedPath} className="text-sm font-semibold text-[#063a64] hover:underline">Read the {relatedLabel}</Link>
            </div>
          </article>
        </div>
      </div>
    </Layout>
  );
}
