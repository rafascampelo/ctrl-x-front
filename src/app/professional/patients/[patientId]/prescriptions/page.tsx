import { CareArea } from "@/features/care/care-area";
import { ProfessionalPrescriptions } from "@/features/prescriptions/professional-prescriptions";

export const metadata = { title: "Prescrição de exercícios" };

export default async function ProfessionalPatientPrescriptionsPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  return (
    <CareArea
      role="PROFESSIONAL"
      title="Prescrição de exercícios"
      description="Elabore e acompanhe as rotinas de exercícios para este paciente."
    >
      <ProfessionalPrescriptions patientId={patientId} />
    </CareArea>
  );
}