import { CareArea } from "@/features/care/care-area";
import { ProfessionalClinicalRecords } from "@/features/clinical-records/professional-clinical-records";

export const metadata = { title: "Prontuário clínico" };

export default async function ProfessionalPatientRecordsPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  return (
    <CareArea
      role="PROFESSIONAL"
      title="Prontuário clínico digital"
      description="Registre avaliações estruturadas, salve rascunhos, finalize atendimentos e adicione adendos."
    >
      <ProfessionalClinicalRecords patientId={patientId} />
    </CareArea>
  );
}