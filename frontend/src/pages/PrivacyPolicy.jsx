import { ShieldCheck } from '@phosphor-icons/react';
import LegalPage, { LegalList, LegalSection } from '../components/LegalPage.jsx';

const sections = [
  { id: 'information', label: 'Information we collect' },
  { id: 'use', label: 'How we use it' },
  { id: 'google-data', label: 'Google user data' },
  { id: 'sharing', label: 'When we share it' },
  { id: 'retention', label: 'Retention and security' },
  { id: 'choices', label: 'Your choices' },
  { id: 'updates', label: 'Policy updates' },
  { id: 'contact', label: 'Contact us' },
];

export default function PrivacyPolicy() {
  return (
    <LegalPage
      icon={ShieldCheck}
      eyebrow="Your information"
      title="Privacy Policy"
      summary="This policy explains what AdDU Seats collects, why it is needed, and who can see it when you use the library seating service."
      description="Learn how AdDU Seats collects, uses, stores, and shares account and reservation information."
      sections={sections}
      relatedPath="/terms"
      relatedLabel="Terms of Service"
    >
      <LegalSection id="information" title="Information we collect">
        <p>AdDU Seats collects only the information needed to identify authorized users and operate seat reservations.</p>
        <LegalList>
          <li><strong className="text-slate-800">Google account information:</strong> your Google account identifier, name, and email address when you sign in.</li>
          <li><strong className="text-slate-800">University identification:</strong> the last four characters of your student ID when this is recorded for front-desk verification.</li>
          <li><strong className="text-slate-800">Reservation activity:</strong> selected seat, building, floor, reservation status, entry verification, breaks, QR re-verification, reports, and check-out timestamps.</li>
          <li><strong className="text-slate-800">Technical information:</strong> temporary OAuth session data, browser-stored sign-in and QR handoff data, and operational logs used to keep the service reliable and secure.</li>
        </LegalList>
      </LegalSection>

      <LegalSection id="use" title="How we use information">
        <LegalList>
          <li>Authenticate users and restrict protected actions to eligible accounts.</li>
          <li>Create and manage reservations, entry checks, breaks, returns, and check-outs.</li>
          <li>Help authorized library staff verify reservations and investigate apparently vacant seats.</li>
          <li>Protect the service from duplicate reservations, misuse, and unauthorized access.</li>
          <li>Produce aggregate occupancy reports and improve library space planning and service reliability.</li>
        </LegalList>
      </LegalSection>

      <LegalSection id="google-data" title="Google user data">
        <p>Google sign-in provides AdDU Seats with your basic profile and email information. We use it only for authentication, account administration, and the library workflows described in this policy. AdDU Seats does not request access to Google Drive, Gmail, Calendar, contacts, or other Google content.</p>
        <p>We do not use Google user data for advertising, and we do not sell it. You can remove AdDU Seats from your Google Account connections at any time.</p>
      </LegalSection>

      <LegalSection id="sharing" title="When we share information">
        <p>Authorized library staff and administrators can view the account and reservation details needed for front-desk verification, occupancy management, and support. When you submit a ghost-seat report, administrators can see your name and student ID suffix while reviewing that report.</p>
        <p>Service providers that host the application, database, cache, or authentication flow may process information only to provide those services. We may also disclose information when required by law or an applicable university policy.</p>
      </LegalSection>

      <LegalSection id="retention" title="Retention and security">
        <p>Account, reservation, flag, and occupancy records are kept only as long as reasonably needed for library operations, system integrity, service evaluation, and applicable institutional recordkeeping requirements. AdDU Seats does not currently publish a fixed deletion schedule.</p>
        <p>We use authenticated requests, role-based access, short-lived OAuth handoff codes, and other reasonable safeguards. No online service can guarantee absolute security.</p>
      </LegalSection>

      <LegalSection id="choices" title="Your choices">
        <LegalList>
          <li>You can browse public floor maps without signing in.</li>
          <li>You can sign out to remove the active AdDU Seats sign-in token from that browser.</li>
          <li>You can revoke the Google connection from your Google Account settings.</li>
          <li>You can contact University Library Services to ask about access, correction, or deletion of your account information, subject to applicable recordkeeping requirements.</li>
        </LegalList>
      </LegalSection>

      <LegalSection id="updates" title="Policy updates">
        <p>We may update this policy when the service or its data practices change. The effective date on this page will show the latest published version.</p>
      </LegalSection>

      <LegalSection id="contact" title="Contact us">
        <p>For privacy questions or account requests, email <a href="mailto:univ.library@addu.edu.ph" className="font-semibold text-[#063a64] hover:underline">univ.library@addu.edu.ph</a> or use the <a href="https://library.addu.edu.ph/contact/" target="_blank" rel="noreferrer" className="font-semibold text-[#063a64] hover:underline">University Libraries contact directory</a>.</p>
      </LegalSection>
    </LegalPage>
  );
}
