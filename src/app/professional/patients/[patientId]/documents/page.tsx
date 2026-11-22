import { CareArea } from "@/features/care/care-area";
import { PrivateDocuments } from "@/features/documents/private-documents";

export const metadata = { title: "Documentos do paciente" };

export default async function ProfessionalPatientDocumentsPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  return (
    <CareArea
      role="PROFESSIONAL"
      title="Documentos clínicos do paciente"
      description="Consulte, envie e revise laudos e exames autorizados para este acompanhamento."
    >
      <PrivateDocuments patientId={patientId} />
    </CareArea>
  );
}