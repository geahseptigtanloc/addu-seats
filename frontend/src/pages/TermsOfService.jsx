import { FileText } from '@phosphor-icons/react';
import LegalPage, { LegalList, LegalSection } from '../components/LegalPage.jsx';

const sections = [
  { id: 'service', label: 'Using the service' },
  { id: 'reservations', label: 'Reservation rules' },
  { id: 'breaks', label: 'Breaks and returns' },
  { id: 'reports', label: 'Seat reports' },
  { id: 'conduct', label: 'Acceptable use' },
  { id: 'availability', label: 'Service availability' },
  { id: 'enforcement', label: 'Enforcement and changes' },
  { id: 'contact', label: 'Contact us' },
];

export default function TermsOfService() {
  return (
    <LegalPage
      icon={FileText}
      eyebrow="Service rules"
      title="Terms of Service"
      summary="These terms describe the practical rules for using AdDU Seats and keeping library seating fair and available."
      description="Review the terms for using AdDU Seats, including reservation, break, verification, and reporting rules."
      sections={sections}
      relatedPath="/privacy"
      relatedLabel="Privacy Policy"
    >
      <LegalSection id="service" title="Using the service">
        <p>AdDU Seats is a library seat reservation and occupancy service for Ateneo de Davao University. Public visitors may browse floor maps. Reserving a seat and using other protected features requires an eligible Google account and a valid AdDU Seats session.</p>
        <p>By signing in or using a protected feature, you agree to follow these terms and applicable University Library rules. Keep your account access private and provide accurate information during verification.</p>
      </LegalSection>

      <LegalSection id="reservations" title="Reservation rules">
        <LegalList>
          <li>Create a reservation by scanning the physical QR code at the seat or table you intend to use.</li>
          <li>Keep only one active reservation at a time and do not reserve a seat for another person.</li>
          <li>Present the receipt code and your university ID to the front desk within the entry period shown in the app.</li>
          <li>A reservation becomes active only after front-desk approval. A pending or apparently available status does not guarantee use until confirmation.</li>
          <li>Check out when you leave so the seat becomes available to others.</li>
        </LegalList>
      </LegalSection>

      <LegalSection id="breaks" title="Breaks and returns">
        <p>Use the in-app break control before leaving an occupied seat. Break time can be extended only within the limits shown in the app, up to the current 15-minute allowance.</p>
        <p>Return before the countdown ends and scan the physical seat QR code to verify your presence. An expired break may end the reservation. The 30-minute cooldown applies after the full 15-minute allowance is used.</p>
      </LegalSection>

      <LegalSection id="reports" title="Seat reports">
        <p>You may flag an occupied seat only when it appears vacant. You cannot flag your own reservation. The reservation holder receives a chance to verify their presence, and an administrator may confirm the report and void the reservation after review.</p>
        <p>False, repeated, or retaliatory reports may lead to access restrictions. Administrators can see who submitted a report for accountability.</p>
      </LegalSection>

      <LegalSection id="conduct" title="Acceptable use">
        <p>Do not share accounts, copy or alter QR codes, bypass front-desk checks, interfere with timers or live seat states, scrape the service, or use it in a way that prevents others from accessing library seating fairly.</p>
      </LegalSection>

      <LegalSection id="availability" title="Service availability">
        <p>Seat information is updated as the system receives reservation and front-desk activity, but brief delays or outages can occur. Library staff may end reservations or take seating out of service when required for safety, maintenance, policy enforcement, or operational needs.</p>
      </LegalSection>

      <LegalSection id="enforcement" title="Enforcement and changes">
        <p>University Library Services may limit or suspend access when these terms or library rules are violated. We may update the service and these terms as operations change. The effective date on this page will show the latest published version.</p>
      </LegalSection>

      <LegalSection id="contact" title="Contact us">
        <p>For questions about these terms or the seating service, email <a href="mailto:univ.library@addu.edu.ph" className="font-semibold text-[#063a64] hover:underline">univ.library@addu.edu.ph</a> or use the <a href="https://library.addu.edu.ph/contact/" target="_blank" rel="noreferrer" className="font-semibold text-[#063a64] hover:underline">University Libraries contact directory</a>.</p>
      </LegalSection>
    </LegalPage>
  );
}
