import { CareArea } from "@/features/care/care-area";
import { PrivateDocuments } from "@/features/documents/private-documents";

export const metadata = { title: "Meus documentos e exames" };

export default function PatientDocumentsPage() {
  return (
    <CareArea
      role="PATIENT"
      title="Documentos e exames"
      description="Envie laudos e exames de imagem com segurança e revise o texto extraído."
    >
      <PrivateDocuments />
    </CareArea>
  );
}